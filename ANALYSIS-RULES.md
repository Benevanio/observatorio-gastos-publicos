# Regras de Análise — Observatório de Gastos Públicos

> **IMPORTANTE:** Nenhuma dessas regras afirma a existência de irregularidade, fraude ou ilegalidade.
> Cada regra identifica **situações que merecem análise documental** por profissional habilitado.
> O sistema usa os termos: Informativo, Atenção, Requer Análise, Alta Relevância — nunca Crime, Fraude ou Corrupção.

---

## R01 — Concentração de Fornecedor

**Tipo:** `supplier_concentration`

**O que verifica:** Fornecedores que concentram percentual elevado do valor total contratado no município.

**Método:**
```
valor_fornecedor / valor_total_contratos × 100 = percentual
```

**Limites:**
| Percentual | Classificação |
|------------|--------------|
| ≥ 25% | Atenção |
| ≥ 35% | Requer Análise |
| ≥ 50% | Alta Relevância |

**Evidências incluídas:** nome do fornecedor, CNPJ, quantidade de contratos, valor total, percentual, metodologia.

**Texto padrão:** "Alta concentração de contratos identificada. Recomenda-se análise dos processos relacionados. Alta concentração em um único fornecedor não constitui, por si só, irregularidade."

---

## R02 — Contratos com Aditivos Excessivos

**Tipo:** `excessive_amendments`

**O que verifica:** Contratos com múltiplos termos aditivos ou aumento significativo de valor.

**Método:**
```
(valor_atual - valor_inicial) / valor_inicial × 100 = aumento_percentual
```

**Limites:**
| Condição | Classificação |
|----------|--------------|
| Aumento > 25% OU ≥ 3 aditivos | Atenção |
| Aumento > 30% OU ≥ 3 aditivos | Requer Análise |
| Aumento > 50% OU ≥ 5 aditivos | Alta Relevância |

**Evidências incluídas:** número do contrato, objeto, fornecedor, valor original, valor atual, percentual de aumento, lista de aditivos.

---

## R03 — Painel de Inexigibilidades

**Tipo:** `inexigibilidade_panel`

**O que verifica:** Processos com modalidade "Inexigibilidade de Licitação".

**Nota:** Inexigibilidade é uma modalidade **legal** quando a competição é inviável (fornecedor exclusivo, artista consagrado etc.). O sistema apenas cria um painel informativo.

**Limites:** ≥ 3 processos OU valor total > R$ 50.000

**Classificação:** Sempre Informativo.

---

## R04 — Frequência de Dispensas

**Tipo:** `dispensa_frequency`

**O que verifica:** Quantidade e valor de dispensas de licitação.

**Limites:**
| Condição | Classificação |
|----------|--------------|
| ≥ 5 dispensas | Atenção |
| ≥ 10 dispensas | Requer Análise |

---

## R05 — Dispensas com Objetos Semelhantes

**Tipo:** `similar_dispensas`

**O que verifica:** Dispensas com objetos de natureza semelhante (por palavra-chave).

**Palavras-chave monitoradas:** combustível, limpeza, manutenção, veículo, medicamento, material escolar

**Limites:** ≥ 2 dispensas com mesma palavra-chave.

**Classificação:** Atenção.

**Nota:** Contratações semelhantes não indicam fracionamento ilegal. O texto sempre diz "Recomenda-se verificar se os processos são independentes."

---

## R06 — Contratos com Prazo Vencido

**Tipo:** `expired_contracts`

**O que verifica:** Contratos com `endDate` anterior à data atual e status ≠ 'expired'.

**Classificação:** Atenção.

---

## R07 — Contratos Próximos do Vencimento

**Tipo:** `near_expiry_contracts`

**O que verifica:** Contratos ativos com vencimento nos próximos 30 dias.

**Classificação:** Informativo.

---

## R08 — Qualidade de Dados

**Tipo:** `data_quality`

**O que verifica:**
- Licitações homologadas com valor = 0
- Contratos sem fornecedor identificado
- Processos sem objeto descrito

**Classificação:** Sempre Informativo. Não implica irregularidade, apenas inconsistência nos dados publicados.

---

## R09 — Contratações Recorrentes

**Tipo:** `repeated_procurements`

**O que verifica:** Múltiplas contratações com objetos de natureza semelhante.

**Palavras-chave:** combustível, merenda, limpeza, manutenção, transporte, veículo, medicamento, material escolar.

**Classificação:** Sempre Informativo.

---

## R10 — Fornecedor Recorrente

**Tipo:** `recurring_supplier`

**O que verifica:** Fornecedores com ≥ 3 contratos com o mesmo município.

**Classificação:** Informativo.

---

## Estrutura de um Indicador (Finding)

```json
{
  "id": "uuid",
  "municipalityId": "uuid",
  "type": "supplier_concentration",
  "severity": "requires_analysis",
  "title": "Alta concentração de contratos - Empresa XYZ",
  "description": "Descrição completa com dados e contextualização",
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
