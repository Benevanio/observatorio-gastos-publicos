# Fontes de Dados — Observatório de Gastos Públicos

## Porto da Folha / SE

| Campo | Valor |
|-------|-------|
| **Município** | Porto da Folha |
| **Estado** | Sergipe (SE) |
| **Código IBGE** | 2805604 |
| **Portal** | https://portodafolha.se.gov.br/portal/licitacoes |
| **Adapter** | `PortoDaFolhaAdapter` |
| **Tipo de coleta** | Scraping HTML (parâmetros GET) |
| **Rate limit** | 1 req/s (1500ms entre requisições) |
| **Status** | ✅ Implementado |

### Parâmetros da URL
```
https://portodafolha.se.gov.br/portal/licitacoes
  ?filtrar=buscar
  &origem=8        (órgão)
  &ano=2026
  &mes=7
  &modalidade=     (vazio = todas)
  &situacao=       (vazio = todas)
  &f=
  &lc=
  &palavra=        (palavra-chave)
```

### Campos coletados
- Número do processo
- Modalidade
- Órgão/secretaria
- Objeto
- Data de publicação
- Situação/status
- URL da fonte

### Limitações conhecidas
- O portal pode retornar 403 para acessos automatizados sem cookies de sessão
- Valores monetários nem sempre estão disponíveis no HTML da listagem
- API pública não identificada — coleta via scraping HTML
- Em ambiente de sandbox (container de desenvolvimento), o domínio pode ser bloqueado — nesse caso o sistema usa dados demonstrativos

---

## Como adicionar uma nova fonte

### 1. Crie um adapter

```typescript
// backend/src/adapters/meu-municipio.adapter.ts
import { PortalAdapter, PortalCapabilities, CollectionOptions } from './portal.adapter.interface';

export class MeuMunicipioAdapter implements PortalAdapter {
  name = 'MeuMunicipioAdapter';

  canHandle(url: string): boolean {
    return url.includes('meumunicípio.gov.br');
  }

  async discover(): Promise<PortalCapabilities> {
    return {
      type: 'api_json', // ou 'scraping_html', 'csv_export'
      hasApi: true,
      hasScraping: false,
      hasExport: false,
      exportFormats: [],
      endpoints: [{ type: 'procurements', url: 'https://meu.gov.br/api/licitacoes' }],
      rateLimit: { requestsPerSecond: 2, delayMs: 500 },
    };
  }

  async collectProcurements(municipality, options) {
    // Implementar coleta
    const response = await fetch(`https://meu.gov.br/api/licitacoes?ano=${options.year}`);
    const data = await response.json();
    return data.map(this.mapToProcurement);
  }

  async collectContracts(municipality, options) { return []; }
  async collectPayments(municipality, options) { return []; }

  private mapToProcurement(item: Record<string, unknown>) {
    return {
      processNumber: String(item.numero || ''),
      object: String(item.objeto || ''),
      modality: String(item.modalidade || ''),
      // ...
    };
  }
}
```

### 2. Registre o adapter no worker

```typescript
// backend/src/modules/collections/collection.worker.ts
import { MeuMunicipioAdapter } from '../../adapters/meu-municipio.adapter';

private selectAdapter(municipality) {
  const url = municipality.transparencyPortalUrl || '';

  if (url.includes('portodafolha.se.gov.br')) return new PortoDaFolhaAdapter();
  if (url.includes('meumunicipio.gov.br')) return new MeuMunicipioAdapter(); // ← adicione aqui

  return new GenericMunicipalAdapter();
}
```

### 3. Cadastre o município

Via interface web (Municípios → Adicionar) ou via API:
```bash
curl -X POST http://localhost:3001/api/municipalities \
  -H "Content-Type: application/json" \
  -d '{
    "state": "SE",
    "city": "Meu Município",
    "ibgeCode": "2800000",
    "transparencyPortalUrl": "https://meumunicipio.gov.br/portal"
  }'
```

### 4. Inicie a coleta

Via interface (Coletas → Nova Coleta) ou via API:
```bash
curl -X POST http://localhost:3001/api/collections \
  -H "Content-Type: application/json" \
  -d '{
    "municipalityId": "<id-retornado-acima>",
    "year": 2026,
    "months": [1, 2, 3, 4, 5, 6, 7]
  }'
```

---

## Importação via Planilha (municípios sem adapter)

Para municípios que disponibilizam dados em planilha mas não possuem adapter automático:

1. Acesse **Importações** no menu lateral
2. Selecione o município
3. Escolha o tipo de dado (Licitações, Contratos ou Pagamentos)
4. Faça upload do arquivo `.xlsx` ou `.csv`
5. O sistema detecta as colunas automaticamente e sugere o mapeamento
6. Confirme e importe

### Colunas reconhecidas automaticamente

| Campo interno | Aliases aceitos |
|--------------|-----------------|
| processNumber | numero_processo, num_processo, numero, nr_processo |
| object | objeto, descricao, description, objeto_licitacao |
| modality | modalidade, tipo_licitacao, tipo |
| estimatedValue | valor_estimado, valor_previsto, vl_estimado |
| awardedValue | valor_homologado, valor_adjudicado, valor_contratado |
| publicationDate | data_publicacao, data_abertura, dt_publicacao |
| status | situacao, status, situacao_licitacao |
| organ | orgao, secretaria, unidade, setor |
| supplierName | fornecedor, empresa, razao_social, contratado |
| supplierDocument | cnpj, cpf, documento |
