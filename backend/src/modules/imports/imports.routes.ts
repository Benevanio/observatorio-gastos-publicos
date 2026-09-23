import { FastifyInstance } from 'fastify';
import { prisma } from '../../database/prisma';
import { ImportService } from './import.service';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function importsRoutes(app: FastifyInstance) {
  app.post('/preview', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const tmpFile = path.join(os.tmpdir(), `import-${Date.now()}-${data.filename}`);
    const buffer = await data.toBuffer();
    fs.writeFileSync(tmpFile, buffer);

    try {
      const service = new ImportService();
      const preview = await service.preview(tmpFile, data.filename);
      fs.unlinkSync(tmpFile);
      return reply.send(preview);
    } catch (err) {
      fs.unlinkSync(tmpFile);
      throw err;
    }
  });

  app.get('/', async (req, reply) => {
    const { municipalityId, page = '1', limit = '20' } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      prisma.dataImport.findMany({
        where: { ...(municipalityId && { municipalityId }) },
        include: { municipality: { select: { city: true, state: true } } },
        orderBy: { importedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.dataImport.count({ where: { ...(municipalityId && { municipalityId }) } }),
    ]);

    return reply.send({ items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  });

  app.post('/', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    const fields = (data as unknown as { fields: Record<string, { value: string }> }).fields;
    const municipalityId = fields?.municipalityId?.value;
    const entityType = fields?.entityType?.value || 'procurement';
    const columnMapping = fields?.columnMapping?.value
      ? JSON.parse(fields.columnMapping.value)
      : null;

    if (!municipalityId) return reply.status(400).send({ error: 'municipalityId required' });

    const municipality = await prisma.municipality.findUnique({ where: { id: municipalityId } });
    if (!municipality) return reply.status(404).send({ error: 'Municipality not found' });

    const tmpFile = path.join(os.tmpdir(), `import-${Date.now()}-${data.filename}`);
    const buffer = await data.toBuffer();
    fs.writeFileSync(tmpFile, buffer);

    const importRecord = await prisma.dataImport.create({
      data: {
        municipalityId,
        source: 'manual_upload',
        filename: tmpFile,
        originalName: data.filename,
        status: 'processing',
        entityType,
        columnMapping,
      },
    });

    setImmediate(async () => {
      const service = new ImportService();
      try {
        const result = await service.importFile(tmpFile, data.filename, {
          municipalityId,
          entityType,
          columnMapping,
          importId: importRecord.id,
        });

        await prisma.dataImport.update({
          where: { id: importRecord.id },
          data: {
            status: 'done',
            records: result.total,
            recordsNew: result.new,
            recordsUpdated: result.updated,
            recordsIgnored: result.ignored,
            recordsError: result.errors,
            filename: data.filename,
          },
        });

        await prisma.systemLog.create({
          data: {
            level: 'info',
            action: 'IMPORT_DONE',
            message: `Import completed: ${data.filename}`,
            data: { importId: importRecord.id, ...result },
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await prisma.dataImport.update({
          where: { id: importRecord.id },
          data: { status: 'error', errorMessage: msg, filename: data.filename },
        });
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {  }
      }
    });

    return reply.status(202).send({ importId: importRecord.id, status: 'processing' });
  });

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const importRecord = await prisma.dataImport.findUnique({
      where: { id },
      include: { municipality: { select: { city: true, state: true } } },
    });
    if (!importRecord) return reply.status(404).send({ error: 'Not found' });
    return reply.send(importRecord);
  });
}
