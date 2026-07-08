import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      message = body?.message ?? body;
      code = body?.code ?? exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'UNIQUE_CONSTRAINT';
        message = `Duplicate value for ${(exception.meta?.target as string[])?.join(', ')}`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Record not found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        code = 'DB_ERROR';
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) this.logger.error(`${req.method} ${req.url}`, (exception as Error)?.stack);

    res.status(status).json({
      success: false,
      code,
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
