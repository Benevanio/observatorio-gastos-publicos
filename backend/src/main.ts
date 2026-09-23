import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { env, corsOrigins } from './config/env';
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
import { healthRoutes } from './modules/health/health.routes';
import { diagnosticsRoutes } from './modules/diagnostics/diagnostics.routes';
import { prisma } from './database/prisma';
import { closeRedis, getRedis } from './lib/redis';
import { PortalError } from './lib/portal/portal-error';
import { CollectionWorker } from './modules/collections/collection.worker';

const app = Fastify({
  logger: { level: env.logLevel },
  maxParamLength: 200,
  trustProxy: true,
});

let worker: CollectionWorker | null = null;

async function bootstrap() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL não definida. Dentro do Docker use o host "db", não "localhost".');
  }

  if (env.isProduction && env.corsOrigin === '*') {
    app.log.warn('CORS_ORIGIN="*" em produção. Defina a origem do frontend explicitamente.');
  }

  await app.register(cors, {
    origin: corsOrigins(),
    credentials: true,
  });

  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  await app.register(healthRoutes);
  await app.register(diagnosticsRoutes, { prefix: '/api/diagnostics' });

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

  app.setNotFoundHandler(async (request, reply) =>
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: `Rota não encontrada: ${request.method} ${request.url}`,
    })
  );

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados inválidos na requisição',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    if (error instanceof PortalError) {
      request.log.warn({ portal: error.toJSON() }, 'Falha ao acessar portal');
      return reply.status(502).send({
        error: error.code,
        message: error.message,
        portal: error.portal,
        endpoint: error.endpoint,
        durationMs: Math.round(error.durationMs),
        correlationId: error.correlationId,
      });
    }

    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500) request.log.error({ err: error }, 'Erro não tratado');

    return reply.status(status).send({
      error: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status >= 500 && env.isProduction ? 'Erro interno no servidor' : error.message,
    });
  });

  getRedis();

  if (env.collection.workerEnabled) {
    worker = new CollectionWorker();
    worker.start();
  } else {
    app.log.info('Collection worker desabilitado (COLLECTION_WORKER_ENABLED=false)');
  }

  await app.listen({ port: env.port, host: env.host });
  app.log.info(`API ouvindo em http://${env.host}:${env.port}`);
}

async function shutdown(signal: string) {
  app.log.info(`${signal} recebido, encerrando...`);
  try {
    worker?.stop();
    await app.close();
    await prisma.$disconnect();
    await closeRedis();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'Falha no shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

bootstrap().catch((err) => {
  console.error('[BOOTSTRAP_ERROR]', err);
  process.exit(1);
});
