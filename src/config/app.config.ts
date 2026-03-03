import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../middleware/error-handler';
import authRoutes from '../modules/auth/auth.routes';
import batchesRoutes from '../modules/batches/batches.routes';
import cvsRoutes from '../modules/cvs/cvs.routes';
import jdRoutes from '../modules/job-descriptions/jd.routes';
import evaluationsRoutes from '../modules/evaluations/evaluations.routes';
import usersRoutes from '../modules/users/users.routes';
import { prisma } from './database.config';
import { env } from './env';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: { colorize: true, translateTime: 'HH:MM:ss' },
            }
          : undefined,
    },
  });

  // ─── Type provider (Zod) ──────────────────────────────────────
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_EXPIRES_IN },
  });

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CV Scan API',
        description: 'Rule-based NLP CV scoring system',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  // ─── DB lifecycle ─────────────────────────────────────────────
  app.addHook('onReady', async () => {
    await prisma.$connect();
    app.log.info('Database connected');
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // ─── Health routes ────────────────────────────────────────────
  app.get('/health', { schema: { tags: ['Health'] } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', { schema: { tags: ['Health'] } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'not ready', database: 'error' });
    }
  });

  // ─── API Routes ───────────────────────────────────────────────
  const prefix = env.API_PREFIX;

  await app.register(authRoutes, { prefix: `${prefix}/auth` });
  await app.register(jdRoutes, { prefix: `${prefix}/job-descriptions` });
  await app.register(cvsRoutes, { prefix: `${prefix}/cvs` });
  await app.register(evaluationsRoutes, { prefix: `${prefix}/evaluations` });
  await app.register(batchesRoutes, { prefix: `${prefix}/batches` });
  await app.register(usersRoutes, { prefix: `${prefix}/users` });

  // ─── Error handler ────────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ─── 404 handler ─────────────────────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Route not found',
    });
  });

  return app;
}
