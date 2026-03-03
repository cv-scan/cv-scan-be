import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import {
  authResponseSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  tokenResponseSchema,
  userResponseSchema,
} from './auth.schema';
import { authService, type SignJwt } from './auth.service';

function makeSign(app: { jwt: { sign: (payload: { sub: string; email: string; role: string }) => string } }): SignJwt {
  return (payload) => app.jwt.sign(payload);
}

const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // POST /register
  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register new account',
        body: registerSchema,
        response: { 201: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.register(request.body, makeSign(app));
      return reply.status(201).send({
        user: { ...result.user, createdAt: result.user.createdAt.toISOString() },
        tokens: result.tokens,
      });
    },
  );

  // POST /login
  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login',
        body: loginSchema,
        response: { 200: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await authService.login(request.body, makeSign(app));
      return reply.send({
        user: { ...result.user, createdAt: result.user.createdAt.toISOString() },
        tokens: result.tokens,
      });
    },
  );

  // POST /refresh
  app.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Refresh access token',
        body: refreshTokenSchema,
        response: { 200: tokenResponseSchema },
      },
    },
    async (request, reply) => {
      const tokens = await authService.refresh(request.body.refreshToken, makeSign(app));
      return reply.send(tokens);
    },
  );

  // POST /logout
  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Logout (revoke refresh token)',
        body: logoutSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await authService.logout(request.body.refreshToken);
      return reply.status(204).send(null);
    },
  );

  // GET /me
  app.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get current user',
        response: { 200: userResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.getMe(request.user.sub);
      return reply.send({ ...user, createdAt: user.createdAt.toISOString() });
    },
  );
};

export default authRoutes;
