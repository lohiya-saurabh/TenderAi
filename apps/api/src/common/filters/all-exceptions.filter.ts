/**
 * Global NestJS exception filter.
 *
 * Catches our domain HttpError subclasses and maps them to proper HTTP responses.
 * Eliminates the need for try/catch blocks in every controller method.
 */
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HttpError } from '@/common/errors/errors.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number;
    let message: string;

    if (exception instanceof HttpError) {
      // Our domain error classes (NotFoundError, ConflictError, etc.)
      status = exception.statusCode;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      // NestJS built-in exceptions
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message =
        typeof exResponse === 'string' ? exResponse : (exResponse as { message: string }).message;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      console.error('[AllExceptionsFilter] Unhandled error:', exception);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    response.status(status).json({ message });
  }
}
