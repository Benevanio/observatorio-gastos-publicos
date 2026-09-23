import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import { diagnosePortal } from '../../lib/portal/portal-diagnostics';
import { portalMetrics } from '../../lib/portal/portal-metrics';
import { portalHttp } from '../../lib/portal/portal-http-client';

export async function diagnosticsRoutes(app: FastifyInstance) {
  app.get('/portals/metrics', async (_req, reply) => {
    return reply.send({
      ...portalMetrics.snapshot(),
      inFlight: portalHttp.limiterStats(),
    });
  });

  app.post('/portals/probe', async (req, reply) => {
    const { url } = (req.body ?? {}) as { url?: string };

    if (!url) {
      return reply.status(400).send({ error: 'Campo "url" é obrigatório' });
    }

    const result = await diagnosePortal(url);
    return reply.status(result.reachable ? 200 : 502).send(result);
  });

  app.post('/municipalities/:id/probe', async (req, reply) => {
    const { id } = req.params as { id: string };

    const municipality = await prisma.municipality.findUnique({ where: { id } });
    if (!municipality) {
      return reply.status(404).send({ error: 'Municipality not found' });
    }

    const url = municipality.transparencyPortalUrl;
    if (!url) {
      return reply.status(400).send({
        error: 'PORTAL_NOT_CONFIGURED',
        message: `${municipality.city}/${municipality.state} não possui transparencyPortalUrl cadastrada`,
      });
    }

    const result = await diagnosePortal(url);
    return reply.status(result.reachable ? 200 : 502).send({
      municipality: { id: municipality.id, city: municipality.city, state: municipality.state },
      ...result,
    });
  });
}
