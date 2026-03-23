import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../utils/errors';

export function errorHandler(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  // Fastify validation errors (Zod / JSON Schema)
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'The request contains invalid data. Please check your input and try again.',
    });
  }

  // Known application errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.code ?? 'APP_ERROR',
      message: error.message,
    });
  }

  // Fastify errors (e.g. 404 from route not found)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const message =
      error.statusCode === 404 ? 'The requested endpoint does not exist.' : error.message;
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name,
      message,
    });
  }

  // Unknown errors
  reply.log.error(error);
  return reply.status(500).send({
    statusCode: 500,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong on our end. Please try again later.',
  });
}
