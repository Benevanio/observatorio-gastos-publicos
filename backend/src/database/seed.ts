import { prisma } from './prisma';

async function seed() {
  console.log('🌱 Seeding database...');

  // Porto da Folha - SE
  const portoDaFolha = await prisma.municipality.upsert({
    where: { ibgeCode: '2805604' },
    update: {},
    create: {
      state: 'SE',
      city: 'Porto da Folha',
      ibgeCode: '2805604',
      cnpj: '13.291.026/0001-00',
      transparencyPortalUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      apiUrl: 'https://portodafolha.se.gov.br/portal',
      enabled: true,
    },
  });

  console.log(`✅ Municipality created: ${portoDaFolha.city}/${portoDaFolha.state} (IBGE: ${portoDaFolha.ibgeCode})`);

  // Aracaju - SE (example)
  const aracaju = await prisma.municipality.upsert({
    where: { ibgeCode: '2800308' },
    update: {},
    create: {
      state: 'SE',
      city: 'Aracaju',
      ibgeCode: '2800308',
      transparencyPortalUrl: 'https://www.aracaju.se.gov.br/transparencia',
      enabled: true,
    },
  });

  console.log(`✅ Municipality created: ${aracaju.city}/${aracaju.state}`);

  // Nossa Senhora do Socorro - SE
  const socorro = await prisma.municipality.upsert({
    where: { ibgeCode: '2804805' },
    update: {},
    create: {
      state: 'SE',
      city: 'Nossa Senhora do Socorro',
      ibgeCode: '2804805',
      transparencyPortalUrl: 'https://nossasenhoradosocorro.se.gov.br/portal',
      enabled: true,
    },
  });

  console.log(`✅ Municipality created: ${socorro.city}/${socorro.state}`);

  // Create sample data for Porto da Folha
  await createSampleData(portoDaFolha.id);

  console.log('✅ Database seeded successfully!');
}

async function createSampleData(municipalityId: string) {
  // Sample suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { document: '12.345.678/0001-90' },
      update: {},
      create: {
        name: 'Construções e Serviços Alpha Ltda',
        document: '12.345.678/0001-90',
        city: 'Aracaju',
        state: 'SE',
      },
    }),
    prisma.supplier.upsert({
      where: { document: '98.765.432/0001-10' },
      update: {},
      create: {
        name: 'Transportes Beta Eireli',
        document: '98.765.432/0001-10',
        city: 'Porto da Folha',
        state: 'SE',
      },
    }),
    prisma.supplier.upsert({
      where: { document: '45.678.901/0001-23' },
      update: {},
      create: {
        name: 'Comércio de Material de Escritório Gamma ME',
        document: '45.678.901/0001-23',
        city: 'Propriá',
        state: 'SE',
      },
    }),
    prisma.supplier.upsert({
      where: { document: '11.222.333/0001-44' },
      update: {},
      create: {
        name: 'Serviços de Limpeza Delta Ltda',
        document: '11.222.333/0001-44',
        city: 'Aracaju',
        state: 'SE',
      },
    }),
  ]);

  console.log(`✅ Created ${suppliers.length} sample suppliers`);

  // Sample procurements
  const procurements = [
    {
      municipalityId,
      processNumber: 'TP-001/2026',
      year: 2026,
      month: 1,
      modality: 'Tomada de Preços',
      modalityCode: 'TP',
      organ: 'Secretaria de Obras',
      object: 'Contratação de empresa para pavimentação da Rua Principal no Bairro Centro',
      publicationDate: new Date('2026-01-10'),
      biddingDate: new Date('2026-01-25'),
      status: 'Homologado',
      estimatedValue: 450000.00,
      awardedValue: 420000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-TP-001',
    },
    {
      municipalityId,
      processNumber: 'PE-002/2026',
      year: 2026,
      month: 1,
      modality: 'Pregão Eletrônico',
      modalityCode: 'PE',
      organ: 'Secretaria de Educação',
      object: 'Aquisição de material escolar para a rede municipal de ensino - 2026',
      publicationDate: new Date('2026-01-15'),
      biddingDate: new Date('2026-01-30'),
      status: 'Homologado',
      estimatedValue: 120000.00,
      awardedValue: 98500.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-PE-002',
    },
    {
      municipalityId,
      processNumber: 'DL-003/2026',
      year: 2026,
      month: 2,
      modality: 'Dispensa de Licitação',
      modalityCode: 'DL',
      organ: 'Secretaria de Saúde',
      object: 'Aquisição emergencial de medicamentos básicos para UBS',
      publicationDate: new Date('2026-02-05'),
      status: 'Concluído',
      estimatedValue: 28000.00,
      awardedValue: 27500.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-DL-003',
    },
    {
      municipalityId,
      processNumber: 'IN-004/2026',
      year: 2026,
      month: 2,
      modality: 'Inexigibilidade',
      modalityCode: 'IN',
      organ: 'Gabinete do Prefeito',
      object: 'Contratação de artista para shows na festa do município - Devinho Novaes',
      publicationDate: new Date('2026-02-12'),
      status: 'Homologado',
      estimatedValue: 75000.00,
      awardedValue: 75000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-IN-004',
    },
    {
      municipalityId,
      processNumber: 'PP-005/2026',
      year: 2026,
      month: 3,
      modality: 'Pregão Presencial',
      modalityCode: 'PP',
      organ: 'Secretaria de Obras',
      object: 'Locação de veículos e equipamentos para serviços de manutenção urbana',
      publicationDate: new Date('2026-03-01'),
      biddingDate: new Date('2026-03-15'),
      status: 'Homologado',
      estimatedValue: 180000.00,
      awardedValue: 165000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-PP-005',
    },
    {
      municipalityId,
      processNumber: 'DL-006/2026',
      year: 2026,
      month: 3,
      modality: 'Dispensa de Licitação',
      modalityCode: 'DL',
      organ: 'Secretaria de Obras',
      object: 'Contratação de serviço de limpeza e zeladoria de logradouros',
      publicationDate: new Date('2026-03-10'),
      status: 'Concluído',
      estimatedValue: 25000.00,
      awardedValue: 24800.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-DL-006',
    },
    {
      municipalityId,
      processNumber: 'TP-007/2026',
      year: 2026,
      month: 4,
      modality: 'Tomada de Preços',
      modalityCode: 'TP',
      organ: 'Secretaria de Obras',
      object: 'Construção de calçadão e urbanização da orla do Rio São Francisco',
      publicationDate: new Date('2026-04-05'),
      biddingDate: new Date('2026-04-22'),
      status: 'Em andamento',
      estimatedValue: 890000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-TP-007',
    },
    {
      municipalityId,
      processNumber: 'PE-008/2026',
      year: 2026,
      month: 5,
      modality: 'Pregão Eletrônico',
      modalityCode: 'PE',
      organ: 'Secretaria de Saúde',
      object: 'Aquisição de combustíveis para a frota de veículos da secretaria de saúde',
      publicationDate: new Date('2026-05-08'),
      biddingDate: new Date('2026-05-20'),
      status: 'Homologado',
      estimatedValue: 95000.00,
      awardedValue: 88000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-PE-008',
    },
    {
      municipalityId,
      processNumber: 'PP-009/2026',
      year: 2026,
      month: 6,
      modality: 'Pregão Presencial',
      modalityCode: 'PP',
      organ: 'Secretaria de Educação',
      object: 'Contratação de serviço de merenda escolar para a rede municipal',
      publicationDate: new Date('2026-06-01'),
      biddingDate: new Date('2026-06-18'),
      status: 'Homologado',
      estimatedValue: 320000.00,
      awardedValue: 295000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-PP-009',
    },
    {
      municipalityId,
      processNumber: 'DL-010/2026',
      year: 2026,
      month: 7,
      modality: 'Dispensa de Licitação',
      modalityCode: 'DL',
      organ: 'Secretaria de Saúde',
      object: 'Manutenção e reparo de equipamentos hospitalares da UPA',
      publicationDate: new Date('2026-07-03'),
      status: 'Concluído',
      estimatedValue: 22000.00,
      awardedValue: 21500.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-DL-010',
    },
    {
      municipalityId,
      processNumber: 'PE-011/2026',
      year: 2026,
      month: 7,
      modality: 'Pregão Eletrônico',
      modalityCode: 'PE',
      organ: 'Secretaria de Obras',
      object: 'Aquisição de combustíveis para a frota municipal - 2º semestre',
      publicationDate: new Date('2026-07-10'),
      biddingDate: new Date('2026-07-25'),
      status: 'Homologado',
      estimatedValue: 110000.00,
      awardedValue: 102000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-PE-011',
    },
    {
      municipalityId,
      processNumber: 'IN-012/2026',
      year: 2026,
      month: 7,
      modality: 'Inexigibilidade',
      modalityCode: 'IN',
      organ: 'Secretaria de Cultura',
      object: 'Contratação de banda musical para o São João Cultural do município',
      publicationDate: new Date('2026-07-15'),
      status: 'Homologado',
      estimatedValue: 45000.00,
      awardedValue: 45000.00,
      sourceUrl: 'https://portodafolha.se.gov.br/portal/licitacoes',
      externalId: 'PORTO-2026-IN-012',
    },
  ];

  for (const procurement of procurements) {
    await prisma.procurement.upsert({
      where: {
        municipalityId_externalId: {
          municipalityId: procurement.municipalityId,
          externalId: procurement.externalId,
        },
      },
      update: {},
      create: procurement,
    });
  }

  console.log(`✅ Created ${procurements.length} sample procurements`);

  // Sample contracts
  const contracts = [
    {
      municipalityId,
      contractNumber: 'CT-001/2026',
      supplierId: suppliers[0].id,
      organ: 'Secretaria de Obras',
      object: 'Pavimentação da Rua Principal - Bairro Centro',
      initialValue: 420000.00,
      currentValue: 490000.00,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-08-01'),
      status: 'active',
      externalId: 'PORTO-CT-2026-001',
    },
    {
      municipalityId,
      contractNumber: 'CT-002/2026',
      supplierId: suppliers[1].id,
      organ: 'Secretaria de Saúde',
      object: 'Locação de veículos para transporte de pacientes',
      initialValue: 165000.00,
      currentValue: 165000.00,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
      externalId: 'PORTO-CT-2026-002',
    },
    {
      municipalityId,
      contractNumber: 'CT-003/2026',
      supplierId: suppliers[2].id,
      organ: 'Secretaria de Educação',
      object: 'Fornecimento de material escolar',
      initialValue: 98500.00,
      currentValue: 98500.00,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
      externalId: 'PORTO-CT-2026-003',
    },
    {
      municipalityId,
      contractNumber: 'CT-004/2026',
      supplierId: suppliers[3].id,
      organ: 'Gabinete do Prefeito',
      object: 'Serviços de limpeza e zeladoria - Paço Municipal',
      initialValue: 24800.00,
      currentValue: 29760.00,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-12-31'),
      status: 'active',
      externalId: 'PORTO-CT-2026-004',
    },
    {
      municipalityId,
      contractNumber: 'CT-005/2025',
      supplierId: suppliers[0].id,
      organ: 'Secretaria de Obras',
      object: 'Construção de escola municipal no Bairro Nova Esperança',
      initialValue: 650000.00,
      currentValue: 780000.00,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-12-31'),
      status: 'expired',
      externalId: 'PORTO-CT-2025-005',
    },
  ];

  for (const contract of contracts) {
    await prisma.contract.upsert({
      where: {
        municipalityId_externalId: {
          municipalityId: contract.municipalityId,
          externalId: contract.externalId,
        },
      },
      update: {},
      create: contract,
    });
  }

  console.log(`✅ Created ${contracts.length} sample contracts`);

  // Contract amendments (for concentration analysis)
  const savedContracts = await prisma.contract.findMany({
    where: { municipalityId },
    take: 3,
  });

  if (savedContracts.length > 0) {
    const amendments = [
      {
        contractId: savedContracts[0].id,
        type: 'value_increase',
        description: '1º Termo Aditivo - Acréscimo de serviços',
        originalValue: 420000.00,
        amendmentValue: 70000.00,
        currentValue: 490000.00,
        date: new Date('2026-05-15'),
      },
      {
        contractId: savedContracts[3]?.id || savedContracts[0].id,
        type: 'value_increase',
        description: '1º Termo Aditivo - Reajuste',
        originalValue: 24800.00,
        amendmentValue: 4960.00,
        currentValue: 29760.00,
        date: new Date('2026-07-01'),
      },
    ];

    for (const amendment of amendments) {
      await prisma.contractAmendment.create({ data: amendment });
    }
    console.log(`✅ Created ${amendments.length} contract amendments`);
  }

  // Sample payments
  const savedContractsList = await prisma.contract.findMany({ where: { municipalityId } });
  if (savedContractsList.length > 0) {
    const payments = [
      {
        municipalityId,
        supplierId: suppliers[0].id,
        contractId: savedContractsList[0].id,
        empenho: '2026NE001234',
        paymentDate: new Date('2026-03-15'),
        description: 'Pagamento parcela 1/4 - Pavimentação',
        value: 105000.00,
        organ: 'Secretaria de Obras',
        externalId: 'PAG-2026-001',
      },
      {
        municipalityId,
        supplierId: suppliers[0].id,
        contractId: savedContractsList[0].id,
        empenho: '2026NE001890',
        paymentDate: new Date('2026-05-20'),
        description: 'Pagamento parcela 2/4 - Pavimentação',
        value: 105000.00,
        organ: 'Secretaria de Obras',
        externalId: 'PAG-2026-002',
      },
      {
        municipalityId,
        supplierId: suppliers[1].id,
        contractId: savedContractsList[1].id,
        empenho: '2026NE002100',
        paymentDate: new Date('2026-05-01'),
        description: 'Locação de veículos - Abril/2026',
        value: 18333.33,
        organ: 'Secretaria de Saúde',
        externalId: 'PAG-2026-003',
      },
      {
        municipalityId,
        supplierId: suppliers[2].id,
        empenho: '2026NE002300',
        paymentDate: new Date('2026-04-10'),
        description: 'Fornecimento material escolar - Parcela única',
        value: 98500.00,
        organ: 'Secretaria de Educação',
        externalId: 'PAG-2026-004',
      },
      {
        municipalityId,
        supplierId: suppliers[3].id,
        contractId: savedContractsList[3]?.id,
        empenho: '2026NE002500',
        paymentDate: new Date('2026-05-05'),
        description: 'Serviços limpeza - Abril/2026',
        value: 2966.67,
        organ: 'Gabinete do Prefeito',
        externalId: 'PAG-2026-005',
      },
    ];

    for (const payment of payments) {
      await prisma.payment.upsert({
        where: {
          municipalityId_externalId: {
            municipalityId: payment.municipalityId,
            externalId: payment.externalId,
          },
        },
        update: {},
        create: payment,
      });
    }
    console.log(`✅ Created ${payments.length} sample payments`);
  }

  await prisma.systemLog.create({
    data: {
      level: 'info',
      action: 'SEED',
      message: 'Database seeded with sample data',
      data: { municipalityId, suppliers: suppliers.length },
    },
  });
}

seed()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
