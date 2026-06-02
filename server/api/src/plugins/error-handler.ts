import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export async function errorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | ZodError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const fastifyError = error as FastifyError;
    const code = fastifyError.statusCode || 500;

    if (code === 401) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: fastifyError.message || 'Authentication required',
      });
    }

    if (code === 403) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: fastifyError.message || 'Insufficient permissions',
      });
    }

    if (code === 404) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: fastifyError.message || 'Resource not found',
      });
    }

    if (code === 409) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: fastifyError.message,
      });
    }

    _request.log.error(error);
    return reply.status(code).send({
      statusCode: code,
      error: 'Internal Server Error',
      message: code === 500 ? 'An unexpected error occurred' : fastifyError.message,
    });
  });
}
