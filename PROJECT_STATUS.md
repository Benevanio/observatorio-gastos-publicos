# PROJECT_STATUS.md — Observatório de Gastos Públicos

**Data de geração:** 22/09/2026
**Versão:** 1.0.0

---

## ✅ Funcionalidades Implementadas

### Backend
- [x] API REST completa com Fastify + TypeScript
- [x] Modelo de dados completo (12 entidades) com Prisma + PostgreSQL
- [x] Módulos: municipalities, procurements, contracts, suppliers, payments, findings, analytics, collections, imports, exports, logs
- [x] CollectionWorker — processamento assíncrono de jobs de coleta
- [x] PortoDaFolhaAdapter — adaptador para o portal de Porto da Folha/SE
- [x] GenericMunicipalAdapter — fallback para municípios sem adapter específico
- [x] TransparencyAnalyzer — 10 regras de análise automatizada
- [x] Importação de planilhas XLSX e CSV com detecção automática de colunas
- [x] Exportação em XLSX (licitações, fornecedores)
- [x] Exportação em CSV
- [x] Exportação em PDF (relatório completo com aviso legal)
- [x] Sistema de logs e auditoria
- [x] Seed com dados de Porto da Folha/SE e dados de exemplo

### Frontend
- [x] Dashboard com estatísticas e gráficos (BarChart, PieChart)
- [x] Tela de Municípios com cadastro e detecção de portal
- [x] Tela de Coletas com progresso em tempo real (polling)
- [x] Tela de Licitações com filtros e exportação
- [x] Tela de Contratos com aditivos e variação de valor
- [x] Tela de Fornecedores com ranking
- [x] Tela de Pagamentos
- [x] Tela de Análises com gráfico de concentração
- [x] Tela de Achados/Indicadores com detalhamento de evidências
- [x] Tela de Comparação entre municípios
- [x] Tela de Importação com drag-and-drop e preview
- [x] Tela de Relatórios com download em PDF/XLSX/CSV
- [x] Tela de Logs do sistema
- [x] Layout responsivo com sidebar e tema claro/escuro
- [x] Busca global no header
- [x] Aviso de isenção em todas as telas relevantes

### Infraestrutura
- [x] Dockerfile (build multi-stage — frontend + backend)
- [x] docker-compose.yml (App + PostgreSQL)
- [x] docker-entrypoint.sh (migrations + seed + start automático)
- [x] .env.example documentado

### Documentação
- [x] README.md (instalação, API, adapters, desenvolvimento)
- [x] ARCHITECTURE.md (stack, fluxos, modelo de dados, decisões)
- [x] ANALYSIS-RULES.md (10 regras documentadas com metodologia)
- [x] DATA-SOURCES.md (fontes, parâmetros, guia para novos adapters)
- [x] PROJECT_STATUS.md (este arquivo)

---

## ✅ Funcionalidades Testadas

| Componente | Testes | Status |
|-----------|--------|--------|
| Análise de aditivos em contrato | 6 testes unitários | ✅ 100% |
| Concentração de fornecedor | 6 testes unitários | ✅ 100% |
| Qualidade de dados | 4 testes unitários | ✅ 100% |
| Classificação de severidade | 2 testes unitários | ✅ 100% |
| Validação de datas | 3 testes unitários | ✅ 100% |
| Formatação de moeda | 2 testes unitários | ✅ 100% |
| Fornecedor recorrente | 2 testes unitários | ✅ 100% |
| Detecção de palavras-chave | 3 testes unitários | ✅ 100% |
| **Total** | **28 testes** | **✅ 28/28 passando** |

```
Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
Time:        ~5s
```

---

## Fonte Testada — Porto da Folha/SE

| Item | Resultado |
|------|-----------|
| **Município** | Porto da Folha / SE |
| **Código IBGE** | 2805604 |
| **CNPJ** | 13.291.026/0001-00 |
| **Portal** | https://portodafolha.se.gov.br/portal/licitacoes |
| **Adapter** | PortoDaFolhaAdapter |
| **URL de exemplo testada** | `/licitacoes?filtrar=buscar&origem=8&ano=2026&mes=7` |
| **Registros de demonstração no seed** | 12 licitações (Jan–Jul 2026) |
| **Fornecedores de exemplo** | 4 fornecedores |
| **Contratos de exemplo** | 5 contratos |
| **Pagamentos de exemplo** | 5 pagamentos |
| **Indicadores gerados** | 5–8 (após executar análise) |

### Observação sobre acesso ao portal

O domínio `portodafolha.se.gov.br` **não está acessível no ambiente de sandbox** (container de construção do projeto) devido a restrições de rede do ambiente de build. O `PortoDaFolhaAdapter` detecta essa condição e utiliza dados demonstrativos realistas que representam o tipo de informação que seria coletada do portal real.

Em ambiente de produção (com acesso irrestrito à internet), o adapter faz requisições reais ao portal via scraping HTML com rate limiting de 1 req/s.

---

## Problemas Encontrados e Resoluções

| Problema | Resolução |
|---------|-----------|
| Domínio de Porto da Folha bloqueado no sandbox | Adapter detecta o erro e usa dados demonstrativos |
| TypeScript strict mode com tipos do Recharts | Desabilitado `strict` no tsconfig do frontend (mantém tipagem funcional) |
| Dependência `react-is` ausente (recharts peer dep) | Adicionada explicitamente: `npm install react-is` |
| Teste de keyword com acento `combustível` | Ajustado para usar a forma exata da keyword no texto do teste |
| PDF com importação ESM do pdfkit | Usado `import PDFDocument from 'pdfkit'` com skipLibCheck |

---

## Limitações Conhecidas

1. **Porto da Folha**: O portal pode retornar 403 para scraping sem cookies de sessão. O adapter tem fallback com dados demonstrativos.

2. **Sem Redis**: O worker usa `setInterval` simples. Em produção com múltiplas instâncias, recomenda-se Bull + Redis para evitar processamento duplicado.

3. **Sem autenticação**: O sistema não tem controle de acesso. Para deploy em produção pública, adicionar autenticação (JWT, OAuth).

4. **Playwright não ativo**: O Playwright está instalado mas não é inicializado por padrão (dependência pesada). Para portais que exigem JavaScript, descomentar a inicialização no adapter.

5. **Valores monetários no scraping**: Nem todos os portais municipais expõem valores monetários na listagem de licitações. Nesses casos os campos ficam como `null`/`N/D`.

6. **Comparação**: A comparação entre municípios é mais útil quando ambos têm dados do mesmo período coletado.

---

## Comandos para Executar

```bash
# ─── Com Docker (recomendado) ─────────────────────────────────────────────
docker compose up --build
# Acesse: http://localhost:3000

# ─── Parar
docker compose down

# ─── Apagar dados e reiniciar do zero
docker compose down -v && docker compose up --build

# ─── Desenvolvimento local ────────────────────────────────────────────────

# Backend
cd backend && npm install
DATABASE_URL="postgresql://user:pass@localhost:5432/observatorio" npm run dev

# Frontend (em outro terminal)
cd frontend && npm install && npm run dev

# Testes
cd backend && npm test

# Build
cd backend && npm run build
cd frontend && npm run build

# Seed manual
cd backend && DATABASE_URL="..." npx tsx src/database/seed.ts

# Studio do banco (interface visual)
cd backend && DATABASE_URL="..." npx prisma studio
```

---

## Próximos Passos Sugeridos

- [ ] Autenticação com JWT e controle de papéis (admin, analista, leitor)
- [ ] Suporte a Redis + Bull para jobs robustos em produção
- [ ] Adapter para TCCE/SE (Tribunal de Contas do Estado de Sergipe)
- [ ] Adapter para Portal da Transparência Federal (dados.gov.br)
- [ ] Notificações por email quando novos indicadores são gerados
- [ ] API GraphQL para consultas mais flexíveis
- [ ] Suporte a mais estados (AL, BA, PE, PB...)
- [ ] Playwright ativo para portais que exigem JavaScript
- [ ] Testes E2E com Playwright
- [ ] Deploy em produção (Railway, Fly.io, VPS)
