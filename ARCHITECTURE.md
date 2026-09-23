# Arquitetura — Observatório de Gastos Públicos

## Visão Geral

```
┌─────────────────────────────────────────────────────┐
│                  Docker Container                    │
│                                                     │
│  ┌──────────────┐    ┌───────────────────────────┐  │
│  │   Frontend   │    │         Backend           │  │
│  │  React/Vite  │───▶│  Fastify + TypeScript     │  │
│  │  Tailwind    │    │  Port 3001                │  │
│  │  Recharts    │    │                           │  │
│  └──────────────┘    │  ┌─────────────────────┐  │  │
│   (static files)     │  │   Portal Adapters   │  │  │
│                      │  │  PortoDaFolha       │  │  │
│                      │  │  GenericMunicipal   │  │  │
│                      │  └────────┬────────────┘  │  │
│                      │           │               │  │
│                      │  ┌────────▼────────────┐  │  │
│                      │  │  CollectionWorker   │  │  │
│                      │  │  (background jobs)  │  │  │
│                      │  └────────┬────────────┘  │  │
│                      │           │               │  │
│                      │  ┌────────▼────────────┐  │  │
│                      │  │  TransparencyAnalyzer│  │  │
│                      │  │  (10 regras de       │  │  │
│                      │  │   análise)           │  │  │
│                      │  └─────────────────────┘  │  │
│                      └───────────┬───────────────┘  │
│                                  │                  │
└──────────────────────────────────┼──────────────────┘
                                   │
                    ┌──────────────▼──────────┐
                    │       PostgreSQL 16      │
                    │  (Docker container)      │
                    └─────────────────────────┘
```

## Stack Tecnológica

### Frontend
- **React 18** + **TypeScript** — interface de usuário
- **Vite** — bundler e dev server
- **Tailwind CSS 3** — estilização utility-first
- **TanStack Query** — cache e sincronização com API
- **Recharts** — gráficos
- **React Router** — roteamento SPA
- **Lucide React** — ícones
- **react-hot-toast** — notificações

### Backend
- **Fastify 4** — framework HTTP de alto desempenho
- **TypeScript** — tipagem estática
- **Prisma 5** — ORM com migrations
- **PostgreSQL 16** — banco de dados
- **Cheerio** — parsing de HTML (scraping)
- **Axios** — cliente HTTP
- **ExcelJS** — geração de planilhas XLSX
- **PDFKit** — geração de PDFs
- **PapaParse** — parsing de CSV
- **Jest** — testes unitários

### Infraestrutura
- **Docker** — containerização (build multi-stage)
- **Docker Compose** — orquestração local

---

## Modelo de Dados

### Entidades principais

```
Municipality (Município)
  │
  ├── Source[] (Fontes de dados coletadas)
  ├── Collection[] (Jobs de coleta)
  │     └── CollectionLog[] (Logs de cada coleta)
  ├── Procurement[] (Licitações)
  │     └── ProcurementSupplier[] (Fornecedores participantes)
  ├── Contract[] (Contratos)
  │     ├── ContractAmendment[] (Termos aditivos)
  │     └── Payment[] (Pagamentos)
  ├── Supplier[] (via contratos/pagamentos)
  ├── Payment[] (Pagamentos)
  ├── Expense[] (Despesas)
  ├── DataImport[] (Importações de planilha)
  └── AnalysisFinding[] (Indicadores gerados)

SystemLog (Log global do sistema)
```

---

## Fluxo de Coleta Automática

```
1. POST /api/collections
   { municipalityId, year, months }
        │
        ▼
2. Cria registro Collection no banco (status: pending)
        │
        ▼
3. CollectionWorker (polling a cada 10s)
   detecta Collection pendente
        │
        ▼
4. Seleciona PortalAdapter baseado na URL do portal
   (PortoDaFolha, Generic...)
        │
        ▼
5. adapter.discover() — descobre capacidades
        │
        ▼
6. adapter.collectProcurements() — para cada mês
   - Requisição HTTP com rate limiting
   - Parse da resposta (JSON ou HTML)
   - Mapeamento para ProcurementData[]
        │
        ▼
7. Upsert no banco (evita duplicatas por externalId)
        │
        ▼
8. adapter.collectContracts() — se disponível
        │
        ▼
9. Registra Source no banco
        │
        ▼
10. Collection marcada como done/error
    com contadores de novos/atualizados/erros
```

---

## Fluxo de Análise

```
1. POST /api/analytics/run
   { municipalityId }
        │
        ▼
2. TransparencyAnalyzer.analyze()
        │
        ├── analyzeSupplierConcentration()
        ├── analyzeExcessiveAmendments()
        ├── analyzeInexigibilidades()
        ├── analyzeDispensas()
        ├── analyzeExpiredContracts()
        ├── analyzeDataQuality()
        ├── analyzeRepeatedProcurements()
        └── analyzeRecurringSuppliers()
              │
              ▼
3. Cada regra retorna Finding[]
   com: type, severity, title, description, rule, evidence
        │
        ▼
4. Salva AnalysisFinding no banco
   (substitui findings não arquivados)
        │
        ▼
5. Retorna { findingsGenerated, findings[] }
```

---

## Padrão de Adapter

```typescript
interface PortalAdapter {
  name: string;
  canHandle(url: string): boolean;
  discover(): Promise<PortalCapabilities>;
  collectProcurements(municipality, options): Promise<ProcurementData[]>;
  collectContracts(municipality, options): Promise<ContractData[]>;
  collectPayments(municipality, options): Promise<PaymentData[]>;
}
```

A seleção do adapter acontece em `CollectionWorker.selectAdapter()` por correspondência de URL:

```typescript
if (url.includes('portodafolha.se.gov.br')) return new PortoDaFolhaAdapter();
// adicione novos adapters aqui
return new GenericMunicipalAdapter(); // fallback
```

---

## Decisões de Design

### Por que Fastify e não NestJS?
Fastify oferece melhor performance e menor footprint para uma aplicação single-container. O NestJS adiciona complexidade e overhead não necessários para este caso de uso.

### Por que um único container?
Conforme especificado nos requisitos. O frontend é servido como arquivos estáticos pelo próprio Fastify em produção. O worker de coleta roda na mesma instância como um `setInterval`. Isso simplifica o deploy.

### Por que PostgreSQL e não SQLite?
Suporte a queries complexas de agregação, tipos nativos (array para `months[]`), melhor performance com concorrência.

### Por que os indicadores não afirmam irregularidades?
Questão ética e legal fundamental. O sistema é uma ferramenta de análise, não um órgão julgador. Afirmações automáticas de irregularidade sem análise documental e contraditório seriam irresponsáveis e potencialmente danosas.
