import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export async function exportsRoutes(app: FastifyInstance) {
  // Export procurements as XLSX
  app.get('/procurements/xlsx', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const where = {
      ...(municipalityId && { municipalityId }),
      ...(year && { year: parseInt(year) }),
    };

    const items = await prisma.procurement.findMany({
      where,
      include: {
        municipality: { select: { city: true, state: true } },
        suppliers: { include: { supplier: { select: { name: true, document: true } } } },
      },
      orderBy: { publicationDate: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Observatório de Gastos Públicos';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Licitações');

    sheet.columns = [
      { header: 'Município', key: 'city', width: 20 },
      { header: 'Estado', key: 'state', width: 6 },
      { header: 'Nº Processo', key: 'processNumber', width: 20 },
      { header: 'Ano', key: 'year', width: 8 },
      { header: 'Mês', key: 'month', width: 8 },
      { header: 'Modalidade', key: 'modality', width: 22 },
      { header: 'Órgão', key: 'organ', width: 30 },
      { header: 'Objeto', key: 'object', width: 60 },
      { header: 'Data Publicação', key: 'publicationDate', width: 18 },
      { header: 'Situação', key: 'status', width: 18 },
      { header: 'Valor Estimado (R$)', key: 'estimatedValue', width: 20 },
      { header: 'Valor Homologado (R$)', key: 'awardedValue', width: 22 },
      { header: 'Fornecedor(es)', key: 'suppliers', width: 40 },
      { header: 'Fonte', key: 'sourceUrl', width: 50 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    for (const item of items) {
      sheet.addRow({
        city: item.municipality.city,
        state: item.municipality.state,
        processNumber: item.processNumber || 'N/D',
        year: item.year,
        month: item.month,
        modality: item.modality || 'N/D',
        organ: item.organ || 'N/D',
        object: item.object || 'N/D',
        publicationDate: item.publicationDate ? item.publicationDate.toLocaleDateString('pt-BR') : 'N/D',
        status: item.status || 'N/D',
        estimatedValue: item.estimatedValue ? Number(item.estimatedValue) : 'N/D',
        awardedValue: item.awardedValue ? Number(item.awardedValue) : 'N/D',
        suppliers: item.suppliers.map((s) => s.supplier.name).join('; ') || 'N/D',
        sourceUrl: item.sourceUrl || 'N/D',
      });
    }

    // Format currency columns
    ['K', 'L'].forEach((col) => {
      sheet.getColumn(col).numFmt = '#,##0.00';
    });

    // Add disclaimer
    const disclaimerSheet = workbook.addWorksheet('Aviso Importante');
    disclaimerSheet.getCell('A1').value = 'AVISO IMPORTANTE';
    disclaimerSheet.getCell('A1').font = { bold: true, size: 14 };
    disclaimerSheet.getCell('A3').value =
      'Este relatório apresenta indicadores e situações identificadas automaticamente a partir de dados públicos.';
    disclaimerSheet.getCell('A4').value =
      'Os resultados NÃO constituem, por si só, prova de irregularidade, ilegalidade ou qualquer forma de ilícito.';
    disclaimerSheet.getCell('A5').value =
      'Recomenda-se análise documental detalhada por profissional habilitado antes de qualquer conclusão.';
    disclaimerSheet.getCell('A7').value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
    disclaimerSheet.getCell('A8').value = 'Sistema: Observatório de Gastos Públicos';
    disclaimerSheet.columns = [{ width: 100 }];

    const buffer = await workbook.xlsx.writeBuffer();

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="licitacoes-${year || 'todos'}.xlsx"`)
      .send(Buffer.from(buffer));
  });

  // Export procurements as CSV
  app.get('/procurements/csv', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const items = await prisma.procurement.findMany({
      where: {
        ...(municipalityId && { municipalityId }),
        ...(year && { year: parseInt(year) }),
      },
      include: {
        municipality: { select: { city: true, state: true } },
        suppliers: { include: { supplier: { select: { name: true } } } },
      },
      orderBy: { publicationDate: 'desc' },
    });

    const headers = [
      'Município', 'Estado', 'Nº Processo', 'Ano', 'Mês', 'Modalidade',
      'Órgão', 'Objeto', 'Data Publicação', 'Situação',
      'Valor Estimado', 'Valor Homologado', 'Fornecedores', 'Fonte',
    ];

    const rows = items.map((item) => [
      item.municipality.city,
      item.municipality.state,
      item.processNumber || '',
      item.year || '',
      item.month || '',
      item.modality || '',
      item.organ || '',
      `"${(item.object || '').replace(/"/g, '""')}"`,
      item.publicationDate ? item.publicationDate.toLocaleDateString('pt-BR') : '',
      item.status || '',
      item.estimatedValue ? Number(item.estimatedValue).toFixed(2) : '',
      item.awardedValue ? Number(item.awardedValue).toFixed(2) : '',
      `"${item.suppliers.map((s) => s.supplier.name).join('; ')}"`,
      item.sourceUrl || '',
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="licitacoes-${year || 'todos'}.csv"`)
      .send('\uFEFF' + csv); // BOM for Excel
  });

  // Export findings as PDF report
  app.get('/report/pdf', async (req, reply) => {
    const { municipalityId, year } = req.query as Record<string, string>;

    const municipality = municipalityId
      ? await prisma.municipality.findUnique({ where: { id: municipalityId } })
      : null;

    const [findings, procStats, contractCount] = await Promise.all([
      prisma.analysisFinding.findMany({
        where: { ...(municipalityId && { municipalityId }), dismissed: false },
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.procurement.aggregate({
        where: {
          ...(municipalityId && { municipalityId }),
          ...(year && { year: parseInt(year) }),
        },
        _count: true,
        _sum: { awardedValue: true, estimatedValue: true },
      }),
      prisma.contract.count({ where: { ...(municipalityId && { municipalityId }) } }),
    ]);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Title
    doc.fontSize(20).fillColor('#1e3a5f').text('OBSERVATÓRIO DE GASTOS PÚBLICOS', { align: 'center' });
    doc.fontSize(14).fillColor('#444').text('Relatório de Análise de Transparência', { align: 'center' });
    doc.moveDown();

    // Municipality info
    if (municipality) {
      doc.fontSize(12).fillColor('#1e3a5f').font('Helvetica-Bold').text(`Município: ${municipality.city}/${municipality.state}`).font('Helvetica');
    }
    doc.fontSize(10).fillColor('#666').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    if (year) doc.text(`Período: ${year}`);

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1e3a5f');
    doc.moveDown();

    // DISCLAIMER
    doc.rect(50, doc.y, 495, 60).fill('#fff3cd');
    const disclaimerY = doc.y + 8;
    doc.fontSize(9).fillColor('#7d6608')
      .text(
        '⚠️  AVISO IMPORTANTE: Este relatório apresenta indicadores e situações identificadas automaticamente a ' +
        'partir de dados públicos. Os resultados NÃO constituem, por si só, prova de irregularidade, ' +
        'ilegalidade ou qualquer forma de ilícito. Recomenda-se análise documental por profissional habilitado.',
        58,
        disclaimerY,
        { width: 479 }
      );
    doc.moveDown(4);

    // Summary
    doc.fontSize(14).fillColor('#1e3a5f').text('1. RESUMO EXECUTIVO');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text(`• Total de licitações analisadas: ${procStats._count}`);
    doc.text(`• Valor total estimado: R$ ${Number(procStats._sum.estimatedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`• Valor total homologado: R$ ${Number(procStats._sum.awardedValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`• Total de contratos: ${contractCount}`);
    doc.text(`• Indicadores identificados: ${findings.length}`);

    doc.moveDown();

    // Findings
    doc.fontSize(14).fillColor('#1e3a5f').text('2. INDICADORES IDENTIFICADOS');
    doc.moveDown(0.5);

    const severityLabels: Record<string, string> = {
      informative: 'INFORMATIVO',
      attention: 'ATENÇÃO',
      requires_analysis: 'REQUER ANÁLISE',
      high_relevance: 'ALTA RELEVÂNCIA',
    };
    const severityColors: Record<string, string> = {
      informative: '#17a2b8',
      attention: '#ffc107',
      requires_analysis: '#fd7e14',
      high_relevance: '#dc3545',
    };

    if (findings.length === 0) {
      doc.fontSize(10).fillColor('#666').text('Nenhum indicador identificado para o período selecionado.');
    }

    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      if (doc.y > 680) doc.addPage();

      const color = severityColors[f.severity] || '#17a2b8';
      doc.fontSize(11).fillColor(color).text(`[${severityLabels[f.severity] || f.severity}] ${f.title}`);
      doc.fontSize(9).fillColor('#333').text(f.description, { indent: 10 });
      if (f.createdAt) {
        doc.fontSize(8).fillColor('#888').text(`Identificado em: ${f.createdAt.toLocaleDateString('pt-BR')}`, { indent: 10 });
      }
      doc.moveDown(0.5);
    }

    // Methodology
    doc.addPage();
    doc.fontSize(14).fillColor('#1e3a5f').text('3. METODOLOGIA');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333').text(
      'Os indicadores foram gerados automaticamente pelo sistema Observatório de Gastos Públicos ' +
      'a partir de análise dos dados públicos disponibilizados pelo Portal da Transparência do município. ' +
      'As regras utilizadas incluem:\n\n' +
      '• Concentração de fornecedores: identifica fornecedores com participação superior a 25% do valor contratado\n' +
      '• Aditivos excessivos: detecta contratos com múltiplos termos aditivos ou aumento significativo de valor\n' +
      '• Inexigibilidades e dispensas: painel informativo sobre estas modalidades\n' +
      '• Contratos vencidos: contratos com data de término sem registro de encerramento\n' +
      '• Qualidade de dados: inconsistências nos registros publicados\n' +
      '• Contratações recorrentes: objetos semelhantes em múltiplos processos\n\n' +
      'LIMITAÇÃO: A análise é baseada exclusivamente nos dados disponibilizados publicamente. ' +
      'Dados ausentes, incompletos ou incorretos no portal de origem impactam diretamente os resultados.'
    );

    doc.end();

    await new Promise<void>((resolve) => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    const cityName = municipality ? municipality.city.replace(/\s+/g, '-') : 'geral';
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="relatorio-${cityName}-${year || 'todos'}.pdf"`)
      .send(pdfBuffer);
  });

  // Export suppliers ranking as XLSX
  app.get('/suppliers/xlsx', async (req, reply) => {
    const { municipalityId } = req.query as Record<string, string>;

    const contracts = await prisma.contract.findMany({
      where: { ...(municipalityId && { municipalityId }), supplierId: { not: null } },
      include: { supplier: true, municipality: { select: { city: true, state: true } } },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fornecedores');

    sheet.columns = [
      { header: 'Fornecedor', key: 'name', width: 40 },
      { header: 'CNPJ/CPF', key: 'document', width: 20 },
      { header: 'Cidade', key: 'city', width: 20 },
      { header: 'Estado', key: 'state', width: 8 },
      { header: 'Nº Contratos', key: 'contractCount', width: 14 },
      { header: 'Valor Total (R$)', key: 'totalValue', width: 20 },
      { header: '% do Total', key: 'percentage', width: 14 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    const totalValue = contracts.reduce((sum, c) => sum + Number(c.currentValue || c.initialValue || 0), 0);
    const supplierMap = new Map<string, { name: string; document: string | null; city: string | null; state: string | null; contractCount: number; totalValue: number }>();

    for (const c of contracts) {
      if (!c.supplier) continue;
      const val = Number(c.currentValue || c.initialValue || 0);
      const existing = supplierMap.get(c.supplierId!);
      if (existing) { existing.contractCount++; existing.totalValue += val; }
      else supplierMap.set(c.supplierId!, { name: c.supplier.name, document: c.supplier.document, city: c.supplier.city, state: c.supplier.state, contractCount: 1, totalValue: val });
    }

    Array.from(supplierMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .forEach((s) => {
        sheet.addRow({
          name: s.name,
          document: s.document || 'N/D',
          city: s.city || 'N/D',
          state: s.state || 'N/D',
          contractCount: s.contractCount,
          totalValue: s.totalValue,
          percentage: totalValue > 0 ? ((s.totalValue / totalValue) * 100).toFixed(2) + '%' : '0%',
        });
      });

    sheet.getColumn('F').numFmt = '#,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="fornecedores.xlsx"')
      .send(Buffer.from(buffer));
  });
}
