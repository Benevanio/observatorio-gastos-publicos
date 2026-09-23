import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import fs from 'fs';
import { prisma } from '../../database/prisma';

interface ImportOptions {
  municipalityId: string;
  entityType: string;
  columnMapping?: Record<string, string> | null;
  importId: string;
}

interface PreviewResult {
  filename: string;
  format: string;
  totalRows: number;
  columns: string[];
  preview: Record<string, unknown>[];
  suggestedMapping: Record<string, string>;
}

const KNOWN_COLUMN_ALIASES: Record<string, string[]> = {
  processNumber: ['numero_processo', 'num_processo', 'processo', 'numero', 'nr_processo', 'number'],
  object: ['objeto', 'descricao', 'description', 'objeto_licitacao', 'objeto_contrato'],
  modality: ['modalidade', 'tipo_licitacao', 'tipo', 'modality'],
  estimatedValue: ['valor_estimado', 'valor_previsto', 'valor_referencia', 'vl_estimado'],
  awardedValue: ['valor_homologado', 'valor_adjudicado', 'valor_contratado', 'vl_homologado'],
  publicationDate: ['data_publicacao', 'data_abertura', 'dt_publicacao', 'data'],
  status: ['situacao', 'status', 'situacao_licitacao'],
  organ: ['orgao', 'secretaria', 'unidade', 'setor'],
  supplierName: ['fornecedor', 'empresa', 'razao_social', 'contratado', 'nome'],
  supplierDocument: ['cnpj', 'cpf', 'documento', 'cnpj_fornecedor'],
};

function cellToString(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && 'text' in (val as object)) return String((val as { text: unknown }).text);
  if (typeof val === 'object' && 'result' in (val as object)) return String((val as { result: unknown }).result);
  return String(val);
}

export class ImportService {
  async preview(filePath: string, filename: string): Promise<PreviewResult> {
    const isXlsx = /\.(xlsx|xls)$/i.test(filename);
    const isCsv = /\.csv$/i.test(filename);
    let columns: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (isXlsx) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];
      const headerRow = sheet.getRow(1);
      columns = (headerRow.values as ExcelJS.CellValue[])
        .slice(1)
        .filter(Boolean)
        .map(cellToString);

      for (let i = 2; i <= Math.min(sheet.rowCount, 6); i++) {
        const row = sheet.getRow(i);
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => { obj[col] = cellToString(row.getCell(idx + 1).value); });
        rows.push(obj);
      }
    } else if (isCsv) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true, preview: 5 });
      columns = result.meta.fields || [];
      rows = result.data as Record<string, unknown>[];
    }

    return {
      filename,
      format: isXlsx ? 'xlsx' : isCsv ? 'csv' : 'unknown',
      totalRows: rows.length,
      columns,
      preview: rows,
      suggestedMapping: this.suggestColumnMapping(columns),
    };
  }

  async importFile(filePath: string, filename: string, options: ImportOptions) {
    const isXlsx = /\.(xlsx|xls)$/i.test(filename);
    const result = { total: 0, new: 0, updated: 0, ignored: 0, errors: 0 };
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    if (isXlsx) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const sheet = workbook.worksheets[0];
      const headerRow = sheet.getRow(1);
      columns = (headerRow.values as ExcelJS.CellValue[]).slice(1).filter(Boolean).map(cellToString);

      for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => { obj[col] = cellToString(row.getCell(idx + 1).value); });
        if (Object.values(obj).some((v) => v !== '')) rows.push(obj);
      }
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
      columns = parsed.meta.fields || [];
      rows = parsed.data as Record<string, unknown>[];
    }

    result.total = rows.length;
    const mapping = options.columnMapping || this.suggestColumnMapping(columns);

    for (const row of rows) {
      try {
        const mapped = this.applyMapping(row, mapping);
        if (options.entityType === 'procurement') {
          await this.saveProcurement(mapped, options.municipalityId);
          result.new++;
        } else if (options.entityType === 'contract') {
          await this.saveContract(mapped, options.municipalityId);
          result.new++;
        } else if (options.entityType === 'payment') {
          await this.savePayment(mapped, options.municipalityId);
          result.new++;
        } else {
          result.ignored++;
        }
      } catch {
        result.errors++;
      }
    }
    return result;
  }

  private suggestColumnMapping(columns: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const lower = columns.map((c) => c.toLowerCase().replace(/\s+/g, '_'));
    for (const [field, aliases] of Object.entries(KNOWN_COLUMN_ALIASES)) {
      for (const alias of aliases) {
        const idx = lower.indexOf(alias);
        if (idx >= 0) { mapping[field] = columns[idx]; break; }
      }
    }
    return mapping;
  }

  private applyMapping(row: Record<string, unknown>, mapping: Record<string, string>) {
    const result: Record<string, unknown> = {};
    for (const [field, col] of Object.entries(mapping)) {
      if (col && row[col] !== undefined) result[field] = row[col];
    }
    return result;
  }

  private parseValue(val: unknown): number | undefined {
    if (val == null || val === '') return undefined;
    const num = parseFloat(String(val).replace(/[R$\s.]/g, '').replace(',', '.'));
    return isNaN(num) ? undefined : num;
  }

  private parseDate(val: unknown): Date | undefined {
    if (!val) return undefined;
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? undefined : d;
  }

  private async saveProcurement(data: Record<string, unknown>, municipalityId: string) {
    await prisma.procurement.create({
      data: {
        municipalityId,
        processNumber: String(data.processNumber || ''),
        object: String(data.object || ''),
        modality: String(data.modality || ''),
        estimatedValue: this.parseValue(data.estimatedValue),
        awardedValue: this.parseValue(data.awardedValue),
        publicationDate: this.parseDate(data.publicationDate),
        status: String(data.status || ''),
        organ: String(data.organ || ''),
        externalId: `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }

  private async saveContract(data: Record<string, unknown>, municipalityId: string) {
    let supplierId: string | undefined;
    if (data.supplierDocument || data.supplierName) {
      const doc = data.supplierDocument ? String(data.supplierDocument) : undefined;
      const existing = doc ? await prisma.supplier.findUnique({ where: { document: doc } }) : null;
      if (existing) {
        supplierId = existing.id;
      } else {
        const s = await prisma.supplier.create({
          data: { name: String(data.supplierName || 'N/D'), document: doc },
        });
        supplierId = s.id;
      }
    }
    await prisma.contract.create({
      data: {
        municipalityId,
        contractNumber: String(data.processNumber || ''),
        object: String(data.object || ''),
        initialValue: this.parseValue(data.estimatedValue),
        currentValue: this.parseValue(data.awardedValue),
        startDate: this.parseDate(data.publicationDate),
        status: 'active',
        supplierId,
        externalId: `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }

  private async savePayment(data: Record<string, unknown>, municipalityId: string) {
    await prisma.payment.create({
      data: {
        municipalityId,
        description: String(data.object || ''),
        value: this.parseValue(data.awardedValue ?? data.estimatedValue),
        paymentDate: this.parseDate(data.publicationDate),
        organ: String(data.organ || ''),
        empenho: String(data.processNumber || ''),
        externalId: `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  }
}
