# Observatório de Gastos Públicos

Plataforma open-source para **coleta, organização, cruzamento e análise de dados públicos** provenientes de Portais da Transparência de municípios brasileiros.

O projeto busca facilitar a exploração de dados públicos, permitindo identificar **padrões, indícios, anomalias e inconsistências** em despesas, licitações, contratos, fornecedores e pagamentos.

> ⚠️ **Aviso importante**
>
> O sistema identifica **indícios, padrões, anomalias e inconsistências para análise**. Ele **não acusa automaticamente corrupção, fraude ou ilegalidade**.
>
> A interpretação dos resultados é responsabilidade do usuário. Cada indicador deve apresentar sua metodologia, os dados utilizados e, sempre que possível, a fonte original.

---

## Funcionalidades

| Módulo           | Descrição                                                               |
| ---------------- | ----------------------------------------------------------------------- |
| **Dashboard**    | Visão geral com gráficos de gastos por período, modalidade e fornecedor |
| **Municípios**   | Cadastro e gerenciamento dos municípios monitorados                     |
| **Coletas**      | Jobs automáticos de coleta com acompanhamento de progresso              |
| **Licitações**   | Listagem, filtros e exportação de processos licitatórios                |
| **Contratos**    | Contratos, aditivos e variações de valores                              |
| **Fornecedores** | Ranking e histórico por fornecedor/CNPJ                                 |
| **Pagamentos**   | Registro de empenhos e pagamentos                                       |
| **Análises**     | Análise de concentração de fornecedores, aditivos e outros indicadores  |
| **Achados**      | Indicadores gerados automaticamente com evidências                      |
| **Comparação**   | Comparação de indicadores entre municípios                              |
| **Importação**   | Importação de arquivos XLSX/CSV com detecção de colunas                 |
| **Relatórios**   | Exportação em PDF, XLSX e CSV                                           |
| **Logs**         | Registro e auditoria das operações                                      |

---

# Stack

### Backend

* Node.js 20+
* TypeScript
* Fastify
* Prisma ORM
* PostgreSQL
* Zod
* Bull
* Redis
* Axios
* ExcelJS
* PDFKit

### Frontend

* React
* Vite
* TypeScript
* Tailwind CSS

### Infraestrutura

* Docker
* Docker Compose
* PostgreSQL 16
* Redis
* Nginx/reverse proxy opcional
* SSH para administração remota

---

# Início rápido com Docker

## Pré-requisitos

* Docker >= 24
* Docker Compose >= 2.20
* Git
* SSH, caso o projeto seja executado em um servidor remoto

Verifique:

```bash
docker --version
docker compose version
git --version
ssh -V
```

---

## Clonar o projeto

```bash
git clone <URL_DO_REPOSITORIO>
cd observatorio-gastos-publicos
```

Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

Edite caso seja necessário:

```bash
nano .env
```

Os valores padrão foram definidos para permitir executar o projeto localmente sem configuração adicional.

---

# Executando com Docker

O projeto utiliza Docker Compose para executar a aplicação e o banco de dados de forma integrada.

Suba os containers:

```bash
docker compose up --build
```

Para executar em segundo plano:

```bash
docker compose up -d --build
```

A aplicação ficará disponível em:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

---

## Arquitetura Docker

A execução padrão possui:

```text
                    ┌─────────────────────────┐
                    │      observatorio-app    │
                    │                         │
                    │  Frontend React/Vite    │
                    │  Backend Fastify         │
                    │  Prisma                  │
                    │  Workers/Jobs            │
                    └────────────┬────────────┘
                                 │
                                 │ PostgreSQL
                                 ▼
                    ┌─────────────────────────┐
                    │    observatorio-db      │
                    │    PostgreSQL 16        │
                    └─────────────────────────┘
```

O frontend e o backend são compilados em uma **imagem Docker multi-stage**.

O PostgreSQL utiliza um volume persistente:

```text
postgres_data
```

Portanto, reiniciar ou recriar os containers não apaga automaticamente os dados do banco.

---

# Comandos Docker

## Iniciar

```bash
docker compose up -d
```

## Iniciar reconstruindo a imagem

Use quando houver alterações no código ou no Dockerfile:

```bash
docker compose up -d --build
```

## Parar

```bash
docker compose down
```

Isso remove os containers, mas **preserva os volumes**.

## Parar e apagar os dados

> ⚠️ Isso remove o volume do PostgreSQL e, consequentemente, os dados persistidos.

```bash
docker compose down -v
```

## Ver status

```bash
docker compose ps
```

## Ver logs da aplicação

```bash
docker compose logs -f app
```

## Ver logs do PostgreSQL

```bash
docker compose logs -f db
```

## Ver os últimos logs

```bash
docker compose logs --tail=100 app
```

## Reiniciar somente a aplicação

```bash
docker compose restart app
```

## Reiniciar o banco

```bash
docker compose restart db
```

---

# Migrations e Prisma

As migrations são executadas automaticamente pelo `docker-entrypoint.sh` durante a inicialização da aplicação.

O fluxo esperado é:

```text
Container iniciado
      │
      ▼
Aguardar PostgreSQL
      │
      ▼
Prisma migrate deploy
      │
      ▼
Verificar dados iniciais
      │
      ▼
Executar seed se necessário
      │
      ▼
Iniciar Fastify
```

Para consultar o estado das migrations:

```bash
docker compose exec app sh
```

Dentro do container:

```bash
cd /app/backend
npx prisma migrate status
```

Sair:

```bash
exit
```

---

## Gerar Prisma Client

Durante o build Docker, o Prisma Client é gerado automaticamente.

Manualmente:

```bash
docker compose exec app sh
```

```bash
cd /app/backend
npx prisma generate
```

---

# Banco de dados

O PostgreSQL roda internamente no container utilizando:

```text
Host: db
Port: 5432
Database: observatorio
User: observatorio
```

A aplicação utiliza internamente:

```text
postgresql://observatorio:observatorio123@db:5432/observatorio
```

> Esses valores podem ser alterados pelo `.env`.

### Importante

Dentro do Docker, o backend deve utilizar:

```text
db:5432
```

e não:

```text
localhost:5433
```

`localhost` dentro do container aponta para o próprio container, não para o PostgreSQL.

---

# Persistência dos dados

Os dados do PostgreSQL ficam armazenados no volume:

```text
postgres_data
```

Para listar os volumes:

```bash
docker volume ls
```

Para verificar os detalhes:

```bash
docker volume inspect observatorio-gastos-publicos_postgres_data
```

O nome exato do volume pode variar de acordo com o nome do projeto Docker Compose.

---

# Backup do PostgreSQL

Antes de operações destrutivas, recomenda-se realizar backup.

Exemplo:

```bash
docker compose exec db \
  pg_dump -U observatorio -d observatorio \
  > backup.sql
```

Para restaurar:

```bash
cat backup.sql | docker compose exec -T db \
  psql -U observatorio -d observatorio
```

> Nunca utilize `docker compose down -v` em um ambiente com dados importantes sem possuir um backup.

---

# SSH — Acesso ao servidor

O projeto pode ser executado em um servidor Linux através de SSH.

Exemplo:

```bash
ssh usuario@IP_DO_SERVIDOR
```

Caso seja utilizada uma chave SSH:

```bash
ssh -i ~/.ssh/id_ed25519 usuario@IP_DO_SERVIDOR
```

Exemplo:

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@203.0.113.10
```

> Substitua o usuário, IP e caminho da chave pelos valores do seu servidor.

---

## Configurando o projeto no servidor

Após conectar:

```bash
cd /opt
```

Clone o projeto:

```bash
git clone <URL_DO_REPOSITORIO> observatorio-gastos-publicos
```

Entre no diretório:

```bash
cd /opt/observatorio-gastos-publicos
```

Configure o ambiente:

```bash
cp .env.example .env
```

Edite:

```bash
nano .env
```

Inicie:

```bash
docker compose up -d --build
```

Verifique:

```bash
docker compose ps
```

E acompanhe os logs:

```bash
docker compose logs -f app
```

---

# Atualizando a aplicação via SSH

Fluxo recomendado:

```bash
ssh usuario@IP_DO_SERVIDOR
```

Depois:

```bash
cd /opt/observatorio-gastos-publicos
```

Atualize o código:

```bash
git pull
```

Reconstrua a aplicação:

```bash
docker compose up -d --build
```

Verifique:

```bash
docker compose ps
```

E:

```bash
docker compose logs --tail=100 app
```

### Atualização completa

Quando for necessário reconstruir tudo:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

> O comando `docker compose down` não remove os volumes. Os dados do PostgreSQL permanecem.

---

# Diagnóstico Docker

## Container reiniciando continuamente

Verifique:

```bash
docker compose ps
```

Depois:

```bash
docker compose logs --tail=200 app
```

Para verificar o motivo da saída:

```bash
docker inspect observatorio-app
```

---

## Verificar conectividade com PostgreSQL

```bash
docker compose exec app sh
```

Depois:

```bash
nc -zv db 5432
```

Resultado esperado:

```text
db (172.x.x.x:5432) open
```

---

## Verificar Prisma

Dentro do container:

```bash
cd /app/backend
npx prisma --version
```

A versão do Prisma CLI e do Prisma Client deve permanecer compatível com a versão definida no `package.json`.

---

## Verificar OpenSSL

O runtime Docker precisa possuir OpenSSL para o Prisma.

```bash
docker compose exec app openssl version
```

---

# Desenvolvimento local

## Pré-requisitos

* Node.js >= 20
* npm
* PostgreSQL >= 14
* Git

---

# Backend

```bash
cd backend
npm install
```

Configure o ambiente:

```bash
cp ../.env.example ../.env
```

Ajuste o `DATABASE_URL` para o PostgreSQL local.

Execute as migrations:

```bash
npx prisma migrate deploy
```

Ou, durante desenvolvimento:

```bash
npx prisma db push
```

Execute o seed:

```bash
npx tsx src/database/seed.ts
```

Inicie:

```bash
npm run dev
```

Backend:

```text
http://localhost:3001
```

---

# Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

Durante o desenvolvimento, o frontend utiliza a API do backend em:

```text
http://localhost:3001
```

---

# Testes

Executar testes:

```bash
cd backend
npm test
```

Com coverage:

```bash
npm test -- --coverage
```

---

# Arquitetura

```text
observatorio-gastos-publicos/
│
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── database/
│   │   │   └── seed.ts
│   │   ├── adapters/
│   │   │   ├── porto-da-folha/
│   │   │   └── generic/
│   │   └── modules/
│   │       ├── analytics/
│   │       ├── collections/
│   │       ├── exports/
│   │       ├── imports/
│   │       ├── municipalities/
│   │       ├── procurements/
│   │       ├── contracts/
│   │       ├── suppliers/
│   │       ├── payments/
│   │       └── findings/
│   │
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── services/
│       └── types/
│
├── Dockerfile
├── docker-compose.yml
├── docker-entrypoint.sh
├── .env.example
├── ARCHITECTURE.md
├── ANALYSIS-RULES.md
└── DATA-SOURCES.md
```

---

# API REST

| Método | Endpoint                         | Descrição                     |
| ------ | -------------------------------- | ----------------------------- |
| GET    | `/api/municipalities`            | Lista municípios              |
| POST   | `/api/municipalities`            | Cadastra município            |
| POST   | `/api/municipalities/:id/detect` | Detecta capacidades do portal |
| GET    | `/api/procurements`              | Lista licitações              |
| GET    | `/api/contracts`                 | Lista contratos               |
| GET    | `/api/suppliers`                 | Lista fornecedores            |
| GET    | `/api/payments`                  | Lista pagamentos              |
| GET    | `/api/findings`                  | Lista indicadores             |
| GET    | `/api/analytics/overview`        | Visão geral                   |
| GET    | `/api/analytics/suppliers`       | Ranking de fornecedores       |
| GET    | `/api/analytics/contracts`       | Análise de contratos          |
| GET    | `/api/analytics/compare`         | Comparação entre municípios   |
| POST   | `/api/analytics/run`             | Executa análise               |
| POST   | `/api/collections`               | Inicia coleta                 |
| GET    | `/api/collections/:id`           | Status da coleta              |
| POST   | `/api/imports/preview`           | Preview de planilha           |
| POST   | `/api/imports`                   | Importa planilha              |
| GET    | `/api/exports/procurements/xlsx` | Exporta licitações em XLSX    |
| GET    | `/api/exports/procurements/csv`  | Exporta licitações em CSV     |
| GET    | `/api/exports/report/pdf`        | Gera relatório PDF            |
| GET    | `/api/exports/suppliers/xlsx`    | Exporta fornecedores          |
| GET    | `/health`                        | Health check                  |

---

# Adapters de Portal

O sistema utiliza o padrão `PortalAdapter` para permitir integração com diferentes Portais da Transparência.

```typescript
interface PortalAdapter {
  name: string;
  canHandle(url: string): boolean;

  discover(): Promise<PortalCapabilities>;

  collectProcurements(
    municipality,
    options
  ): Promise<ProcurementData[]>;

  collectContracts(
    municipality,
    options
  ): Promise<ContractData[]>;

  collectPayments(
    municipality,
    options
  ): Promise<PaymentData[]>;
}
```

## Adapters disponíveis

| Adapter                   | Portal                   | Status                     |
| ------------------------- | ------------------------ | -------------------------- |
| `PortoDaFolhaAdapter`     | `portodafolha.se.gov.br` | Implementado               |
| `GenericMunicipalAdapter` | Portais genéricos        | Fallback/importação manual |

Para adicionar suporte a um novo portal, consulte:

```text
ARCHITECTURE.md
```

---

# Regras de análise

As regras utilizadas para geração dos indicadores estão documentadas em:

```text
ANALYSIS-RULES.md
```

Os resultados devem ser interpretados como **indicadores para investigação e análise**, e não como conclusões automáticas sobre irregularidades.

---

# Fontes de dados

As fontes utilizadas pelo projeto e suas respectivas limitações estão documentadas em:

```text
DATA-SOURCES.md
```

Sempre que possível, os dados processados devem manter referência à fonte original.

---

# Estrutura de configuração

O arquivo:

```text
.env
```

não deve ser versionado.

Utilize:

```text
.env.example
```

como referência.

Exemplo:

```env
POSTGRES_DB=observatorio
POSTGRES_USER=observatorio
POSTGRES_PASSWORD=observatorio123

DB_PORT=5433
APP_PORT=3000
```

Em produção, utilize credenciais fortes e não mantenha senhas padrão.

---

# Segurança

Para ambientes de produção:

* Não exponha diretamente o PostgreSQL para a Internet.
* Utilize credenciais fortes.
* Restrinja o acesso SSH por firewall.
* Prefira autenticação SSH por chave.
* Evite login SSH com senha quando possível.
* Não versione `.env`.
* Faça backups periódicos do PostgreSQL.
* Utilize HTTPS através de um reverse proxy.
* Não utilize `docker compose down -v` sem confirmar a necessidade.
* Não execute comandos destrutivos de banco automaticamente.
* Revise os dados antes de publicar relatórios.

---

# Licença

Este projeto é open-source.

Consulte o arquivo `LICENSE` para os termos completos de utilização.
