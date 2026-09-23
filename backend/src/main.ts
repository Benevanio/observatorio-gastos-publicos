import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import path from 'path';
import { municipalitiesRoutes } from './modules/municipalities/municipalities.routes';
import { procurementsRoutes } from './modules/procurements/procurements.routes';
import { contractsRoutes } from './modules/contracts/contracts.routes';
import { suppliersRoutes } from './modules/suppliers/suppliers.routes';
import { paymentsRoutes } from './modules/payments/payments.routes';
import { findingsRoutes } from './modules/findings/findings.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { collectionsRoutes } from './modules/collections/collections.routes';
import { importsRoutes } from './modules/imports/imports.routes';
import { exportsRoutes } from './modules/exports/exports.routes';
import { logsRoutes } from './modules/logs/logs.routes';
import { prisma } from './database/prisma';
import { CollectionWorker } from './modules/collections/collection.worker';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
  maxParamLength: 200,
});

async function bootstrap() {

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  try {
    await app.register(staticFiles, {
      root: frontendPath,
      prefix: '/',
      decorateReply: false,
    });
  } catch {
    app.log.info('Frontend static files not found, running in API-only mode');
  }

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API Routes
  await app.register(municipalitiesRoutes, { prefix: '/api/municipalities' });
  await app.register(procurementsRoutes, { prefix: '/api/procurements' });
  await app.register(contractsRoutes, { prefix: '/api/contracts' });
  await app.register(suppliersRoutes, { prefix: '/api/suppliers' });
  await app.register(paymentsRoutes, { prefix: '/api/payments' });
  await app.register(findingsRoutes, { prefix: '/api/findings' });
  await app.register(analyticsRoutes, { prefix: '/api/analytics' });
  await app.register(collectionsRoutes, { prefix: '/api/collections' });
  await app.register(importsRoutes, { prefix: '/api/imports' });
  await app.register(exportsRoutes, { prefix: '/api/exports' });
  await app.register(logsRoutes, { prefix: '/api/logs' });

  // SPA fallback
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    try {
      return reply.sendFile('index.html', frontendPath);
    } catch {
      return reply.status(404).send({ error: 'Not found' });
    }
  });

  // Start collection worker
  const worker = new CollectionWorker();
  worker.start();

  const port = parseInt(process.env.PORT || '3001');
  const host = process.env.HOST || '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`Server running at http://${host}:${port}`);
}

process.on('SIGTERM', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
