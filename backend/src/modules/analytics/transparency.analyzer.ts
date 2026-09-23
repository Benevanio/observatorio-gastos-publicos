
import { Prisma, PrismaClient } from '@prisma/client';

export interface Finding {
  municipalityId: string;
  type: string;
  severity:
    | 'informative'
    | 'attention'
    | 'requires_analysis'
    | 'high_relevance';
  title: string;
  description: string;
  rule: string;
  evidence: Prisma.InputJsonValue;
  sourceUrl?: string;
}

export class TransparencyAnalyzer {
  constructor(private prisma: PrismaClient) {}

  async analyze(municipalityId: string): Promise<Finding[]> {
    // Clear existing non-dismissed findings
    await this.prisma.analysisFinding.deleteMany({
      where: { municipalityId, dismissed: false },
    });

    const findings: Finding[] = [];

    // Run all analysis rules
    const results = await Promise.all([
      this.analyzeSupplierConcentration(municipalityId),
      this.analyzeExcessiveAmendments(municipalityId),
      this.analyzeInexigibilidades(municipalityId),
      this.analyzeDispensas(municipalityId),
      this.analyzeExpiredContracts(municipalityId),
      this.analyzeDataQuality(municipalityId),
      this.analyzeRepeatedProcurements(municipalityId),
      this.analyzeRecurringSuppliers(municipalityId),
    ]);

    for (const result of results) {
      findings.push(...result);
    }

    // Save all findings
    for (const finding of findings) {
      await this.prisma.analysisFinding.create({
        data: {
          municipalityId: finding.municipalityId,
          type: finding.type,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          rule: finding.rule,
          ...(finding.evidence
            ? { evidence: finding.evidence }
            : {}),
          sourceUrl: finding.sourceUrl,
          collectedAt: new Date(),
        },
      });
    }

    return findings;
  }

  /**
   * Rule 1: Supplier Concentration
   * Identifies suppliers that represent a large share of contracted value.
   */
  private async analyzeSupplierConcentration(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const contracts = await this.prisma.contract.findMany({
      where: {
        municipalityId,
        supplierId: { not: null },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            document: true,
          },
        },
      },
    });

    if (contracts.length === 0) return findings;

    const totalValue = contracts.reduce(
      (sum, c) =>
        sum + Number(c.currentValue || c.initialValue || 0),
      0,
    );

    if (totalValue === 0) return findings;

    const supplierMap = new Map<
      string,
      {
        name: string;
        document: string | null;
        contractCount: number;
        totalValue: number;
      }
    >();

    for (const contract of contracts) {
      if (!contract.supplierId || !contract.supplier) continue;

      const val = Number(
        contract.currentValue || contract.initialValue || 0,
      );

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

    for (const [supplierId, data] of supplierMap.entries()) {
      const percentage = (data.totalValue / totalValue) * 100;

      if (percentage >= 25) {
        const severity =
          percentage >= 50
            ? 'high_relevance'
            : percentage >= 35
              ? 'requires_analysis'
              : 'attention';

        findings.push({
          municipalityId,
          type: 'supplier_concentration',
          severity,
          title: `Alta concentração de contratos - ${data.name}`,
          description:
            `O fornecedor "${data.name}" concentra ${percentage.toFixed(1)}% do valor total contratado ` +
            `(R$ ${data.totalValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })} de um total de ` +
            `R$ ${totalValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}). ` +
            `Esta situação merece análise documental dos processos relacionados. ` +
            `Alta concentração em um único fornecedor não constitui, por si só, irregularidade.`,
          rule: 'SUPPLIER_CONCENTRATION_GT25PCT',
          evidence: {
            supplierId,
            supplierName: data.name,
            supplierDocument: data.document,
            contractCount: data.contractCount,
            supplierValue: data.totalValue,
            totalValue,
            percentage: percentage.toFixed(2),
            methodology:
              'Soma dos valores atuais de contratos ativos por fornecedor / valor total contratado',
          },
        });
      }
    }

    return findings;
  }

  /**
   * Rule 2: Excessive Contract Amendments
   * Flags contracts with high amendment rates.
   */
  private async analyzeExcessiveAmendments(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const contracts = await this.prisma.contract.findMany({
      where: {
        municipalityId,
        amendments: {
          some: {},
        },
      },
      include: {
        supplier: {
          select: {
            name: true,
          },
        },
        amendments: true,
      },
    });

    for (const contract of contracts) {
      if (
        !contract.initialValue ||
        Number(contract.initialValue) === 0
      ) {
        continue;
      }

      const increasePercentage =
        ((Number(
          contract.currentValue || contract.initialValue,
        ) -
          Number(contract.initialValue)) /
          Number(contract.initialValue)) *
        100;

      const amendmentCount = contract.amendments.length;

      if (increasePercentage > 25 || amendmentCount >= 3) {
        const severity =
          increasePercentage > 50 || amendmentCount >= 5
            ? 'high_relevance'
            : increasePercentage > 30 || amendmentCount >= 3
              ? 'requires_analysis'
              : 'attention';

        findings.push({
          municipalityId,
          type: 'excessive_amendments',
          severity,
          title: `Contrato com múltiplos aditivos - ${
            contract.contractNumber || 'N/D'
          }`,
          description:
            `O contrato "${contract.contractNumber || 'S/N'}" (${
              contract.object || 'objeto não informado'
            }) ` +
            `possui ${amendmentCount} aditivo(s), com aumento de ${increasePercentage.toFixed(
              1,
            )}% sobre o valor original. ` +
            `Valor original: R$ ${Number(
              contract.initialValue,
            ).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}. ` +
            `Valor atual: R$ ${Number(
              contract.currentValue || contract.initialValue,
            ).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
            })}. ` +
            `Recomenda-se verificar as justificativas de cada aditivo e os limites legais aplicáveis.`,
          rule: 'EXCESSIVE_CONTRACT_AMENDMENTS',
          evidence: {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            object: contract.object,
            supplier: contract.supplier?.name,
            initialValue: Number(contract.initialValue),
            currentValue: Number(
              contract.currentValue || contract.initialValue,
            ),
            amendmentCount,
            increasePercentage: increasePercentage.toFixed(2),
            amendments: contract.amendments.map((a) => ({
              type: a.type,
              description: a.description,
              date: a.date?.toISOString() ?? null,
              value: a.amendmentValue
                ? Number(a.amendmentValue)
                : null,
            })),
          },
        });
      }
    }

    return findings;
  }

  /**
   * Rule 3: Inexigibilidade analysis.
   */
  private async analyzeInexigibilidades(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const items = await this.prisma.procurement.findMany({
      where: {
        municipalityId,
        modalityCode: 'IN',
      },
      orderBy: {
        publicationDate: 'desc',
      },
    });

    if (items.length === 0) return findings;

    const totalValue = items.reduce(
      (sum, p) =>
        sum +
        Number(p.awardedValue || p.estimatedValue || 0),
      0,
    );

    if (items.length >= 3 || totalValue > 50000) {
      findings.push({
        municipalityId,
        type: 'inexigibilidade_panel',
        severity: 'informative',
        title: `Painel de Inexigibilidades - ${items.length} processo(s)`,
        description:
          `Identificados ${items.length} processo(s) de inexigibilidade de licitação, ` +
          `totalizando R$ ${totalValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}. ` +
          `Inexigibilidade é uma modalidade legal quando não existe competição possível. ` +
          `Recomenda-se verificar as justificativas formais de cada processo.`,
        rule: 'INEXIGIBILIDADE_PANEL',
        evidence: {
          count: items.length,
          totalValue,
          processes: items.map((p) => ({
            processNumber: p.processNumber,
            object: p.object,
            value: Number(
              p.awardedValue || p.estimatedValue || 0,
            ),
            date: p.publicationDate?.toISOString() ?? null,
            status: p.status,
          })),
          methodology:
            'Listagem de todos os processos com modalidade de inexigibilidade',
        },
      });
    }

    return findings;
  }

  /**
   * Rule 4: Dispensa analysis.
   */
  private async analyzeDispensas(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const items = await this.prisma.procurement.findMany({
      where: {
        municipalityId,
        modalityCode: 'DL',
      },
      orderBy: {
        publicationDate: 'desc',
      },
    });

    if (items.length === 0) return findings;

    const totalValue = items.reduce(
      (sum, p) =>
        sum +
        Number(p.awardedValue || p.estimatedValue || 0),
      0,
    );

    // Check for high frequency
    if (items.length >= 5) {
      findings.push({
        municipalityId,
        type: 'dispensa_frequency',
        severity:
          items.length >= 10
            ? 'requires_analysis'
            : 'attention',
        title: `Alta frequência de dispensas de licitação - ${items.length} processo(s)`,
        description:
          `Identificados ${items.length} processo(s) de dispensa de licitação, ` +
          `totalizando R$ ${totalValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}. ` +
          `A frequência e os valores merecem análise para verificar adequação às hipóteses legais. ` +
          `Dispensa de licitação é legal quando enquadrada nas hipóteses previstas em lei.`,
        rule: 'DISPENSA_HIGH_FREQUENCY',
        evidence: {
          count: items.length,
          totalValue,
          processes: items.map((p) => ({
            processNumber: p.processNumber,
            object: p.object,
            organ: p.organ,
            value: Number(
              p.awardedValue || p.estimatedValue || 0,
            ),
            date: p.publicationDate?.toISOString() ?? null,
          })),
        },
      });
    }

    // Check for similar objects in same period
    const objects = items.map(
      (p) => p.object?.toLowerCase() || '',
    );

    const similarGroups: string[][] = [];

    const keywords = [
      'combustível',
      'combustivel',
      'limpeza',
      'manutenção',
      'manutencao',
      'veículo',
      'veiculo',
    ];

    for (const keyword of keywords) {
      const matching = items.filter((p) =>
        p.object?.toLowerCase().includes(keyword),
      );

      if (matching.length >= 2) {
        similarGroups.push(
          matching.map((p) => p.object || ''),
        );
      }
    }

    if (similarGroups.length > 0) {
      const flatSimilar = [
        ...new Set(similarGroups.flat()),
      ];

      findings.push({
        municipalityId,
        type: 'similar_dispensas',
        severity: 'attention',
        title:
          'Contratações por dispensa com objetos semelhantes',
        description:
          `Identificadas ${flatSimilar.length} contratações por dispensa com objetos de natureza semelhante. ` +
          `Recomenda-se verificar se os processos são independentes e se as contratações não poderiam ` +
          `ter sido agrupadas em um único processo licitatório.`,
        rule: 'SIMILAR_OBJECTS_DISPENSA',
        evidence: {
          groups: similarGroups,
          methodology:
            'Agrupamento por palavras-chave no objeto da contratação',
        },
      });
    }

    void objects;

    return findings;
  }

  /**
   * Rule 5: Expired contracts.
   */
  private async analyzeExpiredContracts(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const today = new Date();

    const expiredContracts =
      await this.prisma.contract.findMany({
        where: {
          municipalityId,
          endDate: {
            lt: today,
          },
          status: {
            not: 'expired',
          },
        },
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });

    if (expiredContracts.length > 0) {
      findings.push({
        municipalityId,
        type: 'expired_contracts',
        severity: 'attention',
        title: `${expiredContracts.length} contrato(s) com prazo vencido`,
        description:
          `Identificados ${expiredContracts.length} contrato(s) com data de término anterior à data atual ` +
          `e sem registro de encerramento ou renovação. Recomenda-se verificar a situação desses contratos.`,
        rule: 'CONTRACT_PAST_END_DATE',
        evidence: {
          contracts: expiredContracts.map((c) => ({
            contractNumber: c.contractNumber,
            object: c.object,
            supplier: c.supplier?.name,
            endDate: c.endDate?.toISOString() ?? null,
            value: Number(
              c.currentValue || c.initialValue || 0,
            ),
          })),
          checkDate: today.toISOString(),
        },
      });
    }

    // Near-expiry contracts (next 30 days)
    const thirtyDaysFromNow = new Date(
      today.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    const nearExpiryContracts =
      await this.prisma.contract.findMany({
        where: {
          municipalityId,
          status: 'active',
          endDate: {
            gte: today,
            lte: thirtyDaysFromNow,
          },
        },
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
        },
      });

    if (nearExpiryContracts.length > 0) {
      findings.push({
        municipalityId,
        type: 'near_expiry_contracts',
        severity: 'informative',
        title: `${nearExpiryContracts.length} contrato(s) próximo(s) do vencimento`,
        description:
          'Contratos com vencimento nos próximos 30 dias que podem requerer renovação ou novo processo licitatório.',
        rule: 'CONTRACT_NEAR_EXPIRY',
        evidence: {
          contracts: nearExpiryContracts.map((c) => ({
            contractNumber: c.contractNumber,
            object: c.object,
            supplier: c.supplier?.name,
            endDate: c.endDate?.toISOString() ?? null,
          })),
        },
      });
    }

    return findings;
  }

  /**
   * Rule 6: Data quality issues.
   */
  private async analyzeDataQuality(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      zeroValueProcs,
      noSupplierContracts,
      noObjectProcs,
    ] = await Promise.all([
      this.prisma.procurement.count({
        where: {
          municipalityId,
          OR: [
            { estimatedValue: 0 },
            { awardedValue: 0 },
          ],
          status: 'Homologado',
        },
      }),

      this.prisma.contract.count({
        where: {
          municipalityId,
          supplierId: null,
        },
      }),

      this.prisma.procurement.count({
        where: {
          municipalityId,
          object: null,
        },
      }),
    ]);

    const issues: string[] = [];

    if (zeroValueProcs > 0) {
      issues.push(
        `${zeroValueProcs} licitação(ões) homologadas com valor zero`,
      );
    }

    if (noSupplierContracts > 0) {
      issues.push(
        `${noSupplierContracts} contrato(s) sem fornecedor identificado`,
      );
    }

    if (noObjectProcs > 0) {
      issues.push(
        `${noObjectProcs} processo(s) sem objeto descrito`,
      );
    }

    if (issues.length > 0) {
      findings.push({
        municipalityId,
        type: 'data_quality',
        severity: 'informative',
        title: 'Inconsistências de dados identificadas',
        description:
          `Foram identificadas inconsistências nos dados publicados que podem indicar falhas no preenchimento: ` +
          issues.join('; ') +
          `. Estas inconsistências não indicam irregularidade, mas podem dificultar a análise.`,
        rule: 'DATA_QUALITY_ISSUES',
        evidence: {
          issues,
          zeroValueProcs,
          noSupplierContracts,
          noObjectProcs,
        },
      });
    }

    return findings;
  }

  /**
   * Rule 7: Repeated procurements with same object.
   */
  private async analyzeRepeatedProcurements(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const procurements =
      await this.prisma.procurement.findMany({
        where: {
          municipalityId,
          object: {
            not: null,
          },
        },
        select: {
          processNumber: true,
          object: true,
          modality: true,
          publicationDate: true,
          estimatedValue: true,
        },
      });

    // Group by similar keywords
    const groups: Record<string, typeof procurements> = {};

    const keywords = [
      'combustível',
      'combustivel',
      'merenda',
      'limpeza',
      'manutenção',
      'manutencao',
      'transporte',
      'veículo',
      'veiculo',
      'medicamento',
      'material escolar',
    ];

    for (const keyword of keywords) {
      const matching = procurements.filter((p) =>
        p.object?.toLowerCase().includes(keyword),
      );

      if (matching.length >= 2) {
        groups[keyword] = matching;
      }
    }

    for (const [keyword, group] of Object.entries(groups)) {
      const totalValue = group.reduce(
        (sum, p) =>
          sum + Number(p.estimatedValue || 0),
        0,
      );

      findings.push({
        municipalityId,
        type: 'repeated_procurements',
        severity: 'informative',
        title: `Contratações recorrentes: "${keyword}"`,
        description:
          `Identificadas ${group.length} contratações com objeto relacionado a "${keyword}", ` +
          `totalizando R$ ${totalValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}. ` +
          `A recorrência pode ser esperada para serviços contínuos ou pode indicar oportunidade de consolidação.`,
        rule: 'REPEATED_PROCUREMENT_OBJECT',
        evidence: {
          keyword,
          count: group.length,
          totalValue,
          processes: group.map((p) => ({
            processNumber: p.processNumber,
            object: p.object,
            modality: p.modality,
            date: p.publicationDate?.toISOString() ?? null,
            value: Number(p.estimatedValue || 0),
          })),
        },
      });
    }

    return findings;
  }

  /**
   * Rule 8: Recurring suppliers.
   */
  private async analyzeRecurringSuppliers(
    municipalityId: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const supplierContracts =
      await this.prisma.contract.groupBy({
        by: ['supplierId'],
        where: {
          municipalityId,
          supplierId: {
            not: null,
          },
        },
        _count: true,
        having: {
          supplierId: {
            _count: {
              gte: 3,
            },
          },
        },
      });

    for (const item of supplierContracts) {
      if (!item.supplierId) continue;

      const supplier =
        await this.prisma.supplier.findUnique({
          where: {
            id: item.supplierId,
          },
          include: {
            contracts: {
              where: {
                municipalityId,
              },
              orderBy: {
                startDate: 'asc',
              },
              select: {
                startDate: true,
                endDate: true,
                object: true,
                currentValue: true,
                initialValue: true,
              },
            },
          },
        });

      if (!supplier) continue;

      const totalValue = supplier.contracts.reduce(
        (sum, c) =>
          sum +
          Number(c.currentValue || c.initialValue || 0),
        0,
      );

      findings.push({
        municipalityId,
        type: 'recurring_supplier',
        severity: 'informative',
        title: `Fornecedor recorrente: ${supplier.name}`,
        description:
          `O fornecedor "${supplier.name}" possui ${item._count} contratos com o município, ` +
          `totalizando R$ ${totalValue.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}. ` +
          `Recomenda-se verificar os processos relacionados e as modalidades utilizadas.`,
        rule: 'RECURRING_SUPPLIER_GTE3',
        evidence: {
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierDocument: supplier.document,
          contractCount: item._count,
          totalValue,
          firstContract:
            supplier.contracts[0]?.startDate?.toISOString() ??
            null,
          lastContract:
            supplier.contracts[
              supplier.contracts.length - 1
            ]?.startDate?.toISOString() ?? null,
        },
      });
    }

    return findings;
  }
}
