import { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ message: 'Internal server error' });
}
