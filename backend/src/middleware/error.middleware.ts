import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { uniqueConstraintMessage } from '../lib/uniqueConstraintMessage';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(400).json({ status: 'error', message: uniqueConstraintMessage(err.meta?.target) });
    }
    if (err.code === 'P2022') {
      console.error('Prisma P2022 (column missing) — run migrations:', err.meta);
      return res.status(503).json({
        status: 'error',
        message:
          'Database is out of date. On the server, run: cd backend && npx prisma migrate deploy — then restart the API.',
      });
    }
  }

  const rawMsg = err instanceof Error ? err.message : String(err);
  if (/phone_normalized|column .* does not exist/i.test(rawMsg)) {
    console.error('DB schema mismatch (likely missing migration):', rawMsg);
    return res.status(503).json({
      status: 'error',
      message:
        'Database is out of date. From the backend folder run: npx prisma migrate deploy — then restart the API.',
    });
  }

  console.error('Unexpected error:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
