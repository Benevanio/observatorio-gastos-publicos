-- Initial migration generated from schema.prisma
-- This is run automatically by `prisma migrate deploy` in the container

-- CreateTable
CREATE TABLE IF NOT EXISTS "municipalities" (
    "id" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "city" TEXT NOT NULL,
    "ibgeCode" TEXT,
    "cnpj" TEXT,
    "transparencyPortalUrl" TEXT,
    "apiUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sources" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "collectedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "procurements" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "processNumber" TEXT,
    "year" INTEGER,
    "month" INTEGER,
    "modality" TEXT,
    "modalityCode" TEXT,
    "organ" TEXT,
    "object" TEXT,
    "publicationDate" TIMESTAMP(3),
    "biddingDate" TIMESTAMP(3),
    "status" TEXT,
    "estimatedValue" DECIMAL(15,2),
    "awardedValue" DECIMAL(15,2),
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "procurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "procurement_suppliers" (
    "procurementId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "value" DECIMAL(15,2),
    "winner" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "procurement_suppliers_pkey" PRIMARY KEY ("procurementId","supplierId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contracts" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "procurementId" TEXT,
    "contractNumber" TEXT,
    "supplierId" TEXT,
    "organ" TEXT,
    "object" TEXT,
    "initialValue" DECIMAL(15,2),
    "currentValue" DECIMAL(15,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "contract_amendments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "originalValue" DECIMAL(15,2),
    "amendmentValue" DECIMAL(15,2),
    "currentValue" DECIMAL(15,2),
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contract_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "supplierId" TEXT,
    "contractId" TEXT,
    "empenho" TEXT,
    "paymentDate" TIMESTAMP(3),
    "description" TEXT,
    "value" DECIMAL(15,2),
    "organ" TEXT,
    "externalId" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "expenses" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "value" DECIMAL(15,2),
    "date" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "data_imports" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "source" TEXT,
    "filename" TEXT NOT NULL,
    "originalName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "records" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsIgnored" INTEGER NOT NULL DEFAULT 0,
    "recordsError" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "columnMapping" JSONB,
    "entityType" TEXT,
    CONSTRAINT "data_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "analysis_findings" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'informative',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rule" TEXT,
    "evidence" JSONB,
    "sourceUrl" TEXT,
    "collectedAt" TIMESTAMP(3),
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analysis_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "collections" (
    "id" TEXT NOT NULL,
    "municipalityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "months" INTEGER[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "recordsFound" INTEGER NOT NULL DEFAULT 0,
    "recordsNew" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsIgnored" INTEGER NOT NULL DEFAULT 0,
    "recordsError" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "collection_logs" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "municipalities_ibgeCode_key" ON "municipalities"("ibgeCode");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_document_key" ON "suppliers"("document");
CREATE UNIQUE INDEX IF NOT EXISTS "procurements_municipalityId_externalId_key" ON "procurements"("municipalityId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_municipalityId_externalId_key" ON "contracts"("municipalityId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_municipalityId_externalId_key" ON "payments"("municipalityId", "externalId");

-- Foreign Keys
ALTER TABLE "sources" ADD CONSTRAINT "sources_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procurement_suppliers" ADD CONSTRAINT "procurement_suppliers_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procurement_suppliers" ADD CONSTRAINT "procurement_suppliers_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_amendments" ADD CONSTRAINT "contract_amendments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analysis_findings" ADD CONSTRAINT "analysis_findings_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collections" ADD CONSTRAINT "collections_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_logs" ADD CONSTRAINT "collection_logs_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
