# Observatório de Gastos Públicos

Plataforma de coleta, consolidação e análise de gastos públicos municipais brasileiros. Coleta dados de Portais da Transparência, normaliza em um banco relacional e gera indicadores que apontam situações que **merecem análise documental** — nunca afirmações de irregularidade.

---

## Comando único

Pré-requisito: **Docker Desktop** (ou Docker Engine + plugin Compose) rodando. Nada mais — Node, npm, Postgres e Redis ficam todos dentro dos containers.

```bash
npm start
```

Esse comando faz tudo:

1. Constrói a imagem do **backend** — `npm ci`, `prisma generate`, `tsc`.
2. Constrói a imagem do **frontend** — `npm ci`, `vite build`, empacota no nginx.
3. Sobe **PostgreSQL**, **Redis**, **backend** e **frontend** respeitando os healthchecks.
4. Aplica as **migrations** (`prisma migrate deploy`) e roda o **seed** na primeira subida.
5. Imprime o status dos containers.

Depois disso:

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Health | http://localhost:3001/health |
| PostgreSQL | `localhost:5433` |
| Redis | `localhost:6379` |

O `.env` já vem pronto no repositório (`.env.example` → copie para `.env` se ainda não existir). Para uso local não é preciso editar nada.

```bash
cp .env.example .env   # apenas se .env não existir
npm start
```

---

## Todos os comandos

Todos rodam a partir da raiz do projeto.

### Ciclo de vida

| Comando | O que faz |
|---|---|
| `npm start` | Constrói tudo e sobe. **É o comando principal.** |
| `npm stop` | Para e remove os containers. **Os volumes são preservados.** |
| `npm run restart` | Reinicia só backend e frontend (não toca no banco). |
| `npm run rebuild` | Rebuild do zero (`--no-cache`) e recria os containers. |
| `npm run status` | Status e saúde dos 4 containers. |

### Logs

| Comando | O que faz |
|---|---|
| `npm run logs` | Logs de todos os serviços. |
| `npm run logs:backend` | Só o backend. |
| `npm run logs:frontend` | Só o nginx do frontend. |
| `npm run logs:db` | Só o PostgreSQL. |

### Diagnóstico

| Comando | O que faz |
|---|---|
| `npm run doctor` | Bateria completa: DNS + TCP para `db` e `redis`, `pg_isready`, `redis-cli ping`. |
| `npm run health` | `GET /health` de dentro do container. |
| `npm run shell:backend` | Shell dentro do backend. |
| `npm run shell:db` | `psql` conectado ao banco. |

### Banco

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Aplica migrations pendentes. |
| `npm run db:seed` | Roda o seed. |
| `npm run db:studio` | Prisma Studio (precisa de Node no host). |

### Desenvolvimento fora do Docker

| Comando | O que faz |
|---|---|
| `npm run deps` | Instala `node_modules` do backend e do frontend **no host**, usando Node 20 de um container. |
| `npm run dev` | Backend (`tsx watch`) + frontend (`vite`) em paralelo. |
| `npm run build` | Compila os dois. |
| `npm test` | Testes do backend (Jest). |
| `npm run lint` | Lint dos dois. |

Para desenvolver fora do Docker, suba só a infraestrutura e aponte o backend para as portas publicadas:

```bash
docker compose up -d db redis
npm run deps
# backend/.env
# DATABASE_URL=postgresql://observatorio:observatorio123@localhost:5433/observatorio
# REDIS_URL=redis://localhost:6379
npm run dev
```

---

## Arquitetura

```
                    navegador
                        │
        ┌───────────────┴───────────────┐
        │ localhost:3000  localhost:3001│
        ▼                               ▼
┌────────────────────┐        ┌──────────────────────┐
│     frontend       │        │                      │
│  nginx :8080       │        │                      │
│  ├── / → SPA React │        │                      │
│  └── /api/* ───────┼───────▶│   backend            │
└────────────────────┘        │   Fastify 0.0.0.0    │
                              │   :3001              │
                              │                      │
                              │  ├── API REST        │
                              │  ├── CollectionWorker│
                              │  ├── PortalAdapters  │
                              │  └── Analyzer        │
                              └───┬──────────┬───────┘
                                  │          │
                      ┌───────────▼──┐   ┌───▼──────────┐
                      │ db           │   │ redis        │
                      │ postgres:16  │   │ redis:7      │
                      │ :5432        │   │ :6379        │
                      └──────────────┘   └──────────────┘
                                  │
                                  ▼
                   Portais da Transparência (HTTP externo)
```

### Regras de comunicação

- **Entre containers:** sempre pelo nome do serviço — `db:5432`, `redis:6379`, `backend:3001`. Nunca `localhost`.
- **Do navegador/host:** `localhost:3000` e `localhost:3001`.
- O frontend é um container próprio com nginx. **O Fastify não serve o SPA** e não conhece `frontend/dist`.
- O nginx faz proxy de `/api/*` para `backend:3001`, então o frontend funciona com `baseURL: '/api'` — sem URL de API embutida no bundle.

### Containers

| Serviço | Imagem | Porta interna | Porta no host | Healthcheck |
|---|---|---|---|---|
| `db` | postgres:16-alpine | 5432 | 5433 | `pg_isready` |
| `redis` | redis:7-alpine | 6379 | 6379 | `redis-cli ping` |
| `backend` | build `./backend` | 3001 | 3001 | `GET /health` |
| `frontend` | build `./frontend` | 8080 | 3000 | `GET /healthz` |

`depends_on` respeita healthcheck em cadeia: `db` + `redis` saudáveis → `backend` sobe; `backend` saudável → `frontend` sobe.

### Volumes persistentes

`postgres_data`, `redis_data`, `uploads_data`. `npm stop` (`docker compose down`) **não** os apaga. Nunca use `docker compose down -v` a menos que queira perder o banco.

---

## Stack

**Backend:** Fastify 4 · TypeScript · Prisma 5.22 · PostgreSQL 16 · Redis 7 (ioredis) · Axios · Cheerio · ExcelJS · PDFKit · PapaParse · Zod · Jest

**Frontend:** React 19 · Vite · TypeScript · Tailwind CSS 3 · TanStack Query · Recharts · React Router · Lucide · react-hot-toast

**Infra:** Docker (build multi-stage) · Docker Compose · nginx 1.27

---

## Variáveis de ambiente

Tudo vive no `.env` da raiz, já preenchido com valores de desenvolvimento.

### Aplicação

| Variável | Padrão | Descrição |
|---|---|---|
| `NODE_ENV` | `production` | Ambiente. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |
| `FRONTEND_PORT` | `3000` | Porta do frontend no host. |
| `BACKEND_PORT` | `3001` | Porta da API no host. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origens aceitas, separadas por vírgula. `*` libera tudo. |

### Banco e cache

| Variável | Padrão | Descrição |
|---|---|---|
| `POSTGRES_DB` | `observatorio` | Nome do banco. |
| `POSTGRES_USER` | `observatorio` | Usuário. |
| `POSTGRES_PASSWORD` | `observatorio123` | Senha. **Troque em produção.** |
| `DB_PORT` | `5433` | Porta do Postgres no host (evita conflito com Postgres local). |
| `REDIS_PORT` | `6379` | Porta do Redis no host. |
| `REDIS_ENABLED` | `true` | `false` desliga o Redis; a aplicação segue funcionando sem cache. |
| `RUN_SEED` | `true` | Roda o seed no startup. |

O `DATABASE_URL` e o `REDIS_URL` usados pelo backend são montados pelo próprio `docker-compose.yml` apontando para `db` e `redis` — não precisa defini-los no `.env`.

### Portais da Transparência

| Variável | Padrão | Descrição |
|---|---|---|
| `PORTAL_REQUEST_TIMEOUT_MS` | `30000` | Timeout total por requisição. |
| `PORTAL_CONNECT_TIMEOUT_MS` | `10000` | Timeout de conexão TCP. |
| `PORTAL_MAX_RETRIES` | `3` | Tentativas por requisição. |
| `PORTAL_RETRY_BASE_DELAY_MS` | `1000` | Base do backoff exponencial. |
| `PORTAL_RETRY_MAX_DELAY_MS` | `15000` | Teto do backoff. |
| `PORTAL_MAX_CONCURRENCY` | `2` | Requisições simultâneas por host. |
| `PORTAL_MIN_INTERVAL_MS` | `1000` | Intervalo mínimo entre requisições ao mesmo host. |
| `PORTAL_CACHE_ENABLED` | `true` | Cache das respostas no Redis. |
| `PORTAL_CACHE_TTL_SECONDS` | `3600` | TTL do cache. |

### Coleta

| Variável | Padrão | Descrição |
|---|---|---|
| `COLLECTION_CONCURRENCY` | `2` | Coletas processadas em paralelo. |
| `COLLECTION_POLL_INTERVAL_MS` | `5000` | Intervalo do poll de recuperação. |
| `COLLECTION_WORKER_ENABLED` | `true` | `false` desliga o worker (útil para escalar API e worker separados). |

---

## Cliente HTTP dos Portais

Os Portais da Transparência são lentos e instáveis, então todo acesso externo passa por um cliente único (`backend/src/lib/portal/portal-http-client.ts`):

- **Timeout obrigatório** — 30s por requisição, 10s para conectar. Nunca infinito.
- **Retry só para erro transitório** — HTTP 408, 429, 500, 502, 503, 504 e os erros de rede `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`, `ENOTFOUND`. Erro 4xx de cliente não é repetido.
- **Backoff exponencial com jitter** — 1s → 2s → 4s, limitado a 15s; respeita o header `Retry-After`.
- **Limite de concorrência por host** — no máximo 2 requisições simultâneas, com intervalo mínimo de 1s entre elas.
- **Cancelamento** — `AbortSignal` propagado; cancelar uma coleta aborta as requisições em voo.
- **Teto de resposta** — 20MB, para um portal que devolve um dump gigante não estourar a memória.
- **Erros classificados** — `DNS_ERROR`, `CONNECTION_REFUSED`, `CONNECTION_RESET`, `TIMEOUT`, `TLS_ERROR`, `HTTP_4XX`, `HTTP_5XX`, `INVALID_RESPONSE`. O frontend mostra "portal fora do ar (HTTP 503)", não "Network Error".

### Log

Uma linha por requisição, com `portal`, `endpoint`, `status`, `duration`, `attempt`, `error` e `correlationId`. Cabeçalhos sensíveis (`authorization`, `cookie`, `set-cookie`, `x-api-key`, `token`, `password`) são filtrados e nunca chegam ao log.

```
[PORTAL] portal=PortoDaFolha endpoint=/portal/licitacoes status=200 duration=2840ms attempt=1 bytes=48219 correlationId=8f3a...
[PORTAL_ERROR] portal=PortoDaFolha endpoint=/portal/licitacoes error=TIMEOUT status=- duration=30012ms attempt=3 correlationId=8f3a...
```

### Coleta assíncrona

`POST /api/collections` cria o job e responde **201 imediatamente**. Nenhuma requisição de usuário fica presa esperando um portal. O `CollectionWorker` processa em background com claim atômico `pending → running`, então duas réplicas nunca coletam o mesmo job. O poll periódico existe como rede de segurança para jobs órfãos após um restart.

---

## API REST

Base: `http://localhost:3001`

### Health e diagnóstico

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness + estado de Postgres e Redis. 503 se o banco estiver fora. |
| GET | `/health/live` | Só o processo está de pé. Não toca em dependência. |
| GET | `/health/ready` | Pronto para tráfego (exige Postgres). |
| GET | `/api/diagnostics/portals/metrics` | Contagens, média, p95 e p99 das chamadas aos portais. |
| POST | `/api/diagnostics/portals/probe` | Testa uma URL, medindo DNS / TCP / TLS / HTTP separadamente. |
| POST | `/api/diagnostics/municipalities/:id/probe` | O mesmo, para o portal de um município cadastrado. |

```bash
curl -X POST http://localhost:3001/api/diagnostics/portals/probe \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://portodafolha.se.gov.br/portal/licitacoes"}'
```

### Recursos

| Prefixo | Descrição |
|---|---|
| `/api/municipalities` | Municípios, estatísticas por município. |
| `/api/procurements` | Licitações. |
| `/api/contracts` | Contratos e aditivos. |
| `/api/suppliers` | Fornecedores. |
| `/api/payments` | Pagamentos. |
| `/api/collections` | Jobs de coleta e seus logs. |
| `/api/analytics` | Execução das regras e indicadores. |
| `/api/findings` | Indicadores gerados. |
| `/api/imports` | Importação de planilhas XLSX/CSV. |
| `/api/exports` | Exportação em XLSX, CSV e PDF. |
| `/api/logs` | Log do sistema. |

Toda resposta de erro tem o formato `{ error, message }`, com código estável em `error`.

---

## Modelo de dados

```
Municipality
  ├── Source[]              fontes coletadas
  ├── Collection[]          jobs de coleta
  │     └── CollectionLog[] log de cada coleta
  ├── Procurement[]         licitações
  │     └── ProcurementSupplier[]
  ├── Contract[]            contratos
  │     ├── ContractAmendment[]
  │     └── Payment[]
  ├── Supplier[]
  ├── Payment[]
  ├── Expense[]
  ├── DataImport[]
  └── AnalysisFinding[]     indicadores

SystemLog                   log global
```

Schema em `backend/prisma/schema.prisma`. Migrations em `backend/prisma/migrations/`.

---

## Regras de análise

> Nenhuma regra afirma irregularidade, fraude ou ilegalidade. Cada uma identifica **situações que merecem análise documental** por profissional habilitado. As classificações são: **Informativo**, **Atenção**, **Requer Análise**, **Alta Relevância** — nunca "Crime", "Fraude" ou "Corrupção".

| ID | Tipo | O que verifica | Limites / classificação |
|---|---|---|---|
| R01 | `supplier_concentration` | Fornecedor concentrando % do valor total contratado. `valor_fornecedor / valor_total × 100` | ≥25% Atenção · ≥35% Requer Análise · ≥50% Alta Relevância |
| R02 | `excessive_amendments` | Contratos com muitos aditivos ou aumento de valor. `(atual − inicial) / inicial × 100` | >25% ou ≥3 aditivos Atenção · >30% ou ≥3 Requer Análise · >50% ou ≥5 Alta Relevância |
| R03 | `inexigibilidade_panel` | Processos por inexigibilidade. Modalidade **legal** quando a competição é inviável — painel apenas informativo. | ≥3 processos ou >R$ 50.000 · sempre Informativo |
| R04 | `dispensa_frequency` | Quantidade e valor de dispensas. | ≥5 Atenção · ≥10 Requer Análise |
| R05 | `similar_dispensas` | Dispensas com objetos de natureza semelhante, por palavra-chave (combustível, limpeza, manutenção, veículo, medicamento, material escolar). | ≥2 com mesma palavra-chave · Atenção |
| R06 | `expired_contracts` | Contratos com `endDate` no passado e status ≠ `expired`. | Atenção |
| R07 | `near_expiry_contracts` | Contratos ativos vencendo em 30 dias. | Informativo |
| R08 | `data_quality` | Licitações homologadas com valor 0, contratos sem fornecedor, processos sem objeto. | Sempre Informativo |
| R09 | `repeated_procurements` | Contratações recorrentes com objetos semelhantes. | Sempre Informativo |
| R10 | `recurring_supplier` | Fornecedores com ≥3 contratos no mesmo município. | Informativo |

R05 nunca diz "fracionamento ilegal" — o texto gerado é "Recomenda-se verificar se os processos são independentes".

### Formato de um indicador

```json
{
  "id": "uuid",
  "municipalityId": "uuid",
  "type": "supplier_concentration",
  "severity": "requires_analysis",
  "title": "Alta concentração de contratos - Empresa XYZ",
  "description": "Descrição com dados e contextualização",
  "rule": "SUPPLIER_CONCENTRATION_GT25PCT",
  "evidence": {
    "supplierName": "Empresa XYZ",
    "supplierDocument": "12.345.678/0001-90",
    "contractCount": 17,
    "supplierValue": 2450000,
    "totalValue": 7163742,
    "percentage": "34.2",
    "methodology": "Soma dos valores atuais de contratos ativos por fornecedor / valor total contratado"
  },
  "sourceUrl": "https://portodafolha.se.gov.br/portal/licitacoes",
  "collectedAt": "2026-09-21T00:00:00Z",
  "dismissed": false
}
```

Execução: `POST /api/analytics/run` com `{ municipalityId }`. Cada execução substitui os indicadores não arquivados do município.

---

## Fontes de dados

### Porto da Folha / SE

| Campo | Valor |
|---|---|
| Código IBGE | 2805604 |
| Portal | https://portodafolha.se.gov.br/portal/licitacoes |
| Adapter | `PortoDaFolhaAdapter` |
| Coleta | Scraping HTML via parâmetros GET |
| Rate limit | 1 req/s |

Parâmetros: `filtrar=buscar`, `origem` (órgão), `ano`, `mes`, `modalidade`, `situacao`, `palavra`.

Campos coletados: número do processo, modalidade, órgão, objeto, data de publicação, situação, URL da fonte.

Limitações conhecidas: o portal pode devolver 403 para acesso automatizado sem cookie de sessão; valores monetários nem sempre aparecem na listagem; não há API pública identificada.

### Adicionando uma nova fonte

**1.** Crie o adapter em `backend/src/adapters/`, implementando `PortalAdapter`:

```typescript
export class MeuMunicipioAdapter implements PortalAdapter {
  name = 'MeuMunicipioAdapter';

  canHandle(url: string): boolean {
    return url.includes('meumunicipio.gov.br');
  }

  async discover(): Promise<PortalCapabilities> {
    return {
      type: 'api_json',
      hasApi: true,
      hasScraping: false,
      hasExport: false,
      exportFormats: [],
      endpoints: [{ type: 'procurements', url: 'https://meumunicipio.gov.br/api/licitacoes' }],
      rateLimit: { requestsPerSecond: 2, delayMs: 500 },
    };
  }

  async collectProcurements(municipality, options) {
    const res = await portalHttp.request({
      portal: this.name,
      url: 'https://meumunicipio.gov.br/api/licitacoes',
      params: { ano: options.year },
      correlationId: options.correlationId,
      signal: options.signal,
    });
    return JSON.parse(res.data).map(this.mapToProcurement);
  }

  async collectContracts() { return []; }
  async collectPayments() { return []; }
}
```

Use sempre `portalHttp` — é o que dá timeout, retry, limite de concorrência e log.

**2.** Registre em `CollectionWorker.selectAdapter()`:

```typescript
if (url.includes('meumunicipio.gov.br')) return new MeuMunicipioAdapter();
```

**3.** Cadastre o município (interface ou API):

```bash
curl -X POST http://localhost:3001/api/municipalities \
  -H 'Content-Type: application/json' \
  -d '{"state":"SE","city":"Meu Município","ibgeCode":"2800000","transparencyPortalUrl":"https://meumunicipio.gov.br/portal"}'
```

**4.** Dispare a coleta:

```bash
curl -X POST http://localhost:3001/api/collections \
  -H 'Content-Type: application/json' \
  -d '{"municipalityId":"<id>","year":2026,"months":[1,2,3,4,5,6,7]}'
```

### Importação por planilha

Para municípios sem adapter: **Importações** no menu → selecione município e tipo de dado → upload `.xlsx` ou `.csv` → o sistema detecta as colunas e sugere o mapeamento.

Aliases reconhecidos automaticamente:

| Campo | Aliases |
|---|---|
| `processNumber` | numero_processo, num_processo, numero, nr_processo |
| `object` | objeto, descricao, description, objeto_licitacao |
| `modality` | modalidade, tipo_licitacao, tipo |
| `estimatedValue` | valor_estimado, valor_previsto, vl_estimado |
| `awardedValue` | valor_homologado, valor_adjudicado, valor_contratado |
| `publicationDate` | data_publicacao, data_abertura, dt_publicacao |
| `status` | situacao, status, situacao_licitacao |
| `organ` | orgao, secretaria, unidade, setor |
| `supplierName` | fornecedor, empresa, razao_social, contratado |
| `supplierDocument` | cnpj, cpf, documento |

---

## Deploy via SSH

```bash
ssh usuario@servidor
git clone <repo> observatorio-gastos-publicos
cd observatorio-gastos-publicos
cp .env.example .env
```

Edite o `.env` para produção:

```env
POSTGRES_PASSWORD=<senha-forte>
CORS_ORIGIN=https://seudominio.com.br
LOG_LEVEL=info
```

Suba:

```bash
npm start
npm run doctor
```

Atualização:

```bash
git pull
npm start          # rebuild incremental + migrations
npm run logs:backend
```

Se o build precisar ser do zero: `npm run rebuild`.

### Backup

```bash
docker compose exec db pg_dump -U observatorio observatorio > backup-$(date +%F).sql
```

Restauração:

```bash
cat backup-2026-09-23.sql | docker compose exec -T db psql -U observatorio -d observatorio
```

---

## Diagnóstico

Antes de qualquer coisa, `npm run doctor`. Ele cobre DNS, TCP, Postgres e Redis de dentro do backend.

### Backend reiniciando

```bash
npm run logs:backend
```

O entrypoint não engole mais erro nenhum. As causas prováveis aparecem nomeadas:

- `DATABASE_URL aponta para localhost dentro do container` — dentro do Docker o host é `db`. O entrypoint aborta de propósito.
- `prisma migrate deploy falhou` — a migration é inválida ou conflita com o banco. **Não existe fallback para `db push --accept-data-loss`**; o container morre para você ver o erro em vez de perder dados em silêncio.
- `PostgreSQL não respondeu em db:5432 após 60s` — o Postgres não ficou saudável.

### Conectividade entre containers

```bash
docker compose exec backend getent hosts db      # resolve o nome
docker compose exec backend nc -zv db 5432       # abre a porta
docker compose exec backend getent hosts redis
docker compose exec backend nc -zv redis 6379
docker compose exec db pg_isready -U observatorio -d observatorio
docker compose exec redis redis-cli ping
```

`getent` falhando significa que os containers não estão na mesma rede — confira se todos declaram `networks: [observatorio]`.

### Health

```bash
curl http://localhost:3001/health      # API direta
curl http://localhost:3000/            # SPA
curl http://localhost:3000/api/municipalities   # SPA → proxy → API
```

Se `localhost:3001/health` responde mas `localhost:3000/api/...` não, o problema está no proxy do nginx — veja `npm run logs:frontend`.

### Portal lento ou fora do ar

```bash
curl http://localhost:3001/api/diagnostics/portals/metrics
```

Isolando a fase que falha (DNS, TCP, TLS ou HTTP):

```bash
curl -X POST http://localhost:3001/api/diagnostics/portals/probe \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://portodafolha.se.gov.br/portal/licitacoes"}'
```

Uma coleta que falha registra o motivo classificado em `CollectionLog` e em `SystemLog` com o `correlationId`, que liga o job a todas as linhas `[PORTAL]` correspondentes.

### Prisma / OpenSSL

```bash
docker compose exec backend npx prisma migrate status
docker compose exec backend openssl version
```

O `prisma generate` roda no build, não em runtime. Se o client parecer defasado, o caminho é `npm run rebuild`.

---

## Segurança e limites

- Nenhum token, senha ou cookie é registrado em log.
- O sistema **não** afirma irregularidade. Todo indicador é um apontamento para análise documental por profissional habilitado.
- Os dados vêm dos Portais da Transparência como publicados. Inconsistência na fonte aparece como indicador de qualidade de dados (R08), não é corrigida silenciosamente.
- `CORS_ORIGIN=*` é aceitável em desenvolvimento; em produção defina o domínio. O backend emite um aviso no log se subir com `*` em `NODE_ENV=production`.
- Troque `POSTGRES_PASSWORD` antes de expor o serviço.

---

## Estrutura

```
.
├── docker-compose.yml          4 serviços, healthchecks, rede observatorio
├── .env.example                configuração completa e pronta
├── package.json                todos os comandos (npm start e cia.)
├── backend/
│   ├── Dockerfile              multi-stage, OpenSSL, prisma generate no build
│   ├── docker-entrypoint.sh    espera deps, migrate deploy, seed, exec
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── main.ts             Fastify em 0.0.0.0:3001, CORS, error handler
│       ├── config/env.ts       leitura e validação das variáveis
│       ├── lib/
│       │   ├── redis.ts        conexão degradável
│       │   └── portal/         http client, erros, métricas, diagnóstico
│       ├── adapters/           PortalAdapter e implementações
│       ├── database/           prisma client e seed
│       └── modules/            health, diagnostics e recursos da API
└── frontend/
    ├── Dockerfile              build Vite → nginx
    ├── nginx.conf              SPA + proxy /api → backend:3001
    └── src/                    React, páginas, services/api.ts
```

---

## Licença

MIT.
