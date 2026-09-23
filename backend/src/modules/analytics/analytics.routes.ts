import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import { TransparencyAnalyzer } from './transparency.analyzer';

export async function analyticsRoutes(app: FastifyInstance) {
  // Overview dashboard stats
  app.get('/overview', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const yearFilter = year ? parseInt(year) : undefined;

    const [
      procurementStats,
      contractCount,
      paymentStats,
      findingCount,
      supplierCount,
      modalityDistribution,
      monthlyProcurements,
    ] = await Promise.all([
      prisma.procurement.aggregate({
        where: {
          ...(municipalityId && { municipalityId }),
          ...(yearFilter && { year: yearFilter }),
        },
        _count: true,
        _sum: { estimatedValue: true, awardedValue: true },
      }),
      prisma.contract.count({
        where: { ...(municipalityId && { municipalityId }) },
      }),
      prisma.payment.aggregate({
        where: { ...(municipalityId && { municipalityId }) },
        _count: true,
        _sum: { value: true },
      }),
      prisma.analysisFinding.count({
        where: {
          ...(municipalityId && { municipalityId }),
          dismissed: false,
        },
      }),
      // Unique suppliers in contracts
      prisma.contract.groupBy({
        by: ['supplierId'],
        where: {
          ...(municipalityId && { municipalityId }),
          supplierId: { not: null },
        },
      }),
      // Modality distribution
      prisma.procurement.groupBy({
        by: ['modality'],
        where: {
          ...(municipalityId && { municipalityId }),
          ...(yearFilter && { year: yearFilter }),
          modality: { not: null },
        },
        _count: true,
        _sum: { awardedValue: true },
      }),
      // Monthly procurements
      prisma.procurement.groupBy({
        by: ['month', 'year'],
        where: {
          ...(municipalityId && { municipalityId }),
          ...(yearFilter && { year: yearFilter }),
        },
        _count: true,
        _sum: { awardedValue: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ]);

    return reply.send({
      summary: {
        totalAnalyzed: Number(procurementStats._sum.awardedValue || 0) + Number(paymentStats._sum.value || 0),
        procurements: procurementStats._count,
        totalEstimated: Number(procurementStats._sum.estimatedValue || 0),
        totalAwarded: Number(procurementStats._sum.awardedValue || 0),
        contracts: contractCount,
        payments: paymentStats._count,
        totalPayments: Number(paymentStats._sum.value || 0),
        findings: findingCount,
        suppliers: supplierCount.length,
      },
      modalityDistribution: modalityDistribution.map((m) => ({
        modality: m.modality,
        count: m._count,
        value: Number(m._sum.awardedValue || 0),
      })),
      monthlyProcurements: monthlyProcurements.map((m) => ({
        month: m.month,
        year: m.year,
        label: m.month && m.year ? `${String(m.month).padStart(2, '0')}/${m.year}` : 'N/D',
        count: m._count,
        value: Number(m._sum.awardedValue || 0),
      })),
    });
  });

  // Supplier concentration analysis
  app.get('/suppliers', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const contracts = await prisma.contract.findMany({
      where: {
        ...(municipalityId && { municipalityId }),
        supplierId: { not: null },
      },
      include: { supplier: { select: { name: true, document: true } } },
    });

    const totalValue = contracts.reduce(
      (sum, c) => sum + Number(c.currentValue || c.initialValue || 0),
      0
    );

    const supplierMap = new Map<
      string,
      { name: string; document: string | null; contractCount: number; totalValue: number }
    >();

    for (const contract of contracts) {
      if (!contract.supplierId || !contract.supplier) continue;
      const val = Number(contract.currentValue || contract.initialValue || 0);
      const existing = supplierMap.get(contract.supplierId);
      if (existing) {
        existing.contractCount++;
        existing.totalValue += val;
      } else {
        supplierMap.set(contract.supplierId, {
          name: contract.supplier.name,
          document: contract.supplier.document,
          contractCount: 1,
          totalValue: val,
        });
      }
    }

    const ranking = Array.from(supplierMap.entries())
      .map(([id, data]) => ({
        supplierId: id,
        ...data,
        percentage: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return reply.send({ ranking, totalValue, totalContracts: contracts.length });
  });

  // Contract amendment analysis
  app.get('/contracts', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const contracts = await prisma.contract.findMany({
      where: {
        ...(municipalityId && { municipalityId }),
        amendments: { some: {} },
      },
      include: {
        supplier: { select: { name: true } },
        amendments: true,
      },
    });

    return reply.send(
      contracts
        .map((c) => ({
          id: c.id,
          contractNumber: c.contractNumber,
          object: c.object,
          supplier: c.supplier?.name,
          initialValue: Number(c.initialValue || 0),
          currentValue: Number(c.currentValue || 0),
          amendmentCount: c.amendments.length,
          increasePercentage:
            c.initialValue && c.currentValue && Number(c.initialValue) > 0
              ? (((Number(c.currentValue) - Number(c.initialValue)) / Number(c.initialValue)) * 100).toFixed(2)
              : null,
        }))
        .sort((a, b) => b.amendmentCount - a.amendmentCount)
    );
  });

  // Run analysis and generate findings
  app.post('/run', async (req, reply) => {
    const { municipalityId } = req.body as { municipalityId: string };

    if (!municipalityId) {
      return reply.status(400).send({ error: 'municipalityId is required' });
    }

    const analyzer = new TransparencyAnalyzer(prisma);
    const findings = await analyzer.analyze(municipalityId);

    await prisma.systemLog.create({
      data: {
        level: 'info',
        action: 'ANALYSIS_RUN',
        message: `Analysis completed for municipality ${municipalityId}`,
        data: { municipalityId, findingsGenerated: findings.length },
      },
    });

    return reply.send({ findingsGenerated: findings.length, findings });
  });

  // Comparison between municipalities
  app.get('/compare', async (req, reply) => {
    const { ids } = req.query as { ids?: string };

    if (!ids) return reply.status(400).send({ error: 'ids required' });

    const municipalityIds = ids.split(',');

    const results = await Promise.all(
      municipalityIds.map(async (id) => {
        const municipality = await prisma.municipality.findUnique({ where: { id } });
        if (!municipality) return null;

        const [procurements, contracts, payments, suppliers] = await Promise.all([
          prisma.procurement.aggregate({
            where: { municipalityId: id },
            _count: true,
            _sum: { awardedValue: true },
          }),
          prisma.contract.count({ where: { municipalityId: id } }),
          prisma.payment.aggregate({
            where: { municipalityId: id },
            _sum: { value: true },
          }),
          prisma.contract.groupBy({
            by: ['supplierId'],
            where: { municipalityId: id, supplierId: { not: null } },
          }),
        ]);

        const dispensas = await prisma.procurement.count({
          where: { municipalityId: id, modalityCode: 'DL' },
        });
        const inexigibilidades = await prisma.procurement.count({
          where: { municipalityId: id, modalityCode: 'IN' },
        });

        return {
          municipality: { id: municipality.id, city: municipality.city, state: municipality.state },
          totalAwarded: Number(procurements._sum.awardedValue || 0),
          procurementCount: procurements._count,
          contractCount: contracts,
          supplierCount: suppliers.length,
          totalPayments: Number(payments._sum.value || 0),
          dispensas,
          inexigibilidades,
        };
      })
    );

    return reply.send(results.filter(Boolean));
  });
}
