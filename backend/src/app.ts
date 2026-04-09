import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import repoRoutes from './routes/repos.routes.js';
import runRoutes from './routes/runs.routes.js';

export function buildApp() {
  const app = express();

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info(
        {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
        'HTTP request'
      );
    });
    next();
  });

  app.use(
    cors({
      origin: env.APP_ORIGIN,
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api', (_req, res) => {
    res.json({
      name: 'ActHub API',
      version: '1.0.0',
      docs: '/api/health',
    });
  });

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/repos', repoRoutes);
  app.use('/api/runs', runRoutes);

  if (env.NODE_ENV === 'production') {
    const webDistPath = path.resolve('dist');
    app.use(express.static(webDistPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(path.join(webDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
