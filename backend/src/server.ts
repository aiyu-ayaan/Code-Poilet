import fs from 'node:fs/promises';
import path from 'node:path';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase } from './config/db.js';
import { startRunWorker } from './services/run-queue.service.js';

async function bootstrap() {
  await fs.mkdir(path.resolve(env.REPOS_ROOT), { recursive: true });
  await connectDatabase();

  const app = buildApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'ActHub backend listening');
  });

  startRunWorker();
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to start backend');
  process.exit(1);
});
