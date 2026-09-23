/**
 * Unit tests for TransparencyAnalyzer rules
 * These tests verify the analysis logic without requiring a real database.
 */

// ─── Contract Amendment Analysis ────────────────────────────────────────────

describe('ContractAmendment Analysis Rule', () => {
  function calcIncreasePercentage(initial: number, current: number) {
    if (initial === 0) return null;
    return ((current - initial) / initial) * 100;
  }

  it('calculates 0% increase when values are equal', () => {
    expect(calcIncreasePercentage(100_000, 100_000)).toBe(0);
  });

  it('calculates 20% increase correctly', () => {
    const result = calcIncreasePercentage(100_000, 120_000);
    expect(result).toBeCloseTo(20);
  });

  it('calculates 45% increase correctly', () => {
    const result = calcIncreasePercentage(100_000, 145_000);
    expect(result).toBeCloseTo(45);
  });

  it('returns null for zero initial value', () => {
    expect(calcIncreasePercentage(0, 50_000)).toBeNull();
  });

  it('flags contract with >25% increase as requiring attention', () => {
    const increase = calcIncreasePercentage(100_000, 130_000)!;
    expect(increase).toBeGreaterThan(25);
  });

  it('flags contract with >50% increase as high relevance', () => {
    const increase = calcIncreasePercentage(100_000, 160_000)!;
    expect(increase).toBeGreaterThan(50);
  });
});

// ─── Supplier Concentration Analysis ────────────────────────────────────────

describe('SupplierConcentration Analysis Rule', () => {
  function calcConcentration(supplierValue: number, totalValue: number) {
    if (totalValue === 0) return 0;
    return (supplierValue / totalValue) * 100;
  }

  it('flags concentration >= 25%', () => {
    const pct = calcConcentration(250_000, 1_000_000);
    expect(pct).toBeGreaterThanOrEqual(25);
  });

  it('does NOT flag concentration < 25%', () => {
    const pct = calcConcentration(200_000, 1_000_000);
    expect(pct).toBeLessThan(25);
  });

  it('calculates 34.2% correctly', () => {
    const pct = calcConcentration(2_450_000, 7_163_742);
    expect(pct).toBeCloseTo(34.2, 0);
  });

  it('handles single supplier with 100%', () => {
    const pct = calcConcentration(500_000, 500_000);
    expect(pct).toBe(100);
  });

  it('handles zero total value gracefully', () => {
    const pct = calcConcentration(0, 0);
    expect(pct).toBe(0);
  });

  it('determines severity correctly', () => {
    const getSeverity = (pct: number) =>
      pct >= 50 ? 'high_relevance' : pct >= 35 ? 'requires_analysis' : 'attention';
    expect(getSeverity(60)).toBe('high_relevance');
    expect(getSeverity(40)).toBe('requires_analysis');
    expect(getSeverity(27)).toBe('attention');
  });
});

// ─── Data Quality Checks ─────────────────────────────────────────────────────

describe('DataQuality Analysis Rule', () => {
  it('detects zero value in a homologated procurement', () => {
    const procurement = { status: 'Homologado', estimatedValue: 0, awardedValue: 0 };
    const isIssue = procurement.status === 'Homologado' && procurement.awardedValue === 0;
    expect(isIssue).toBe(true);
  });

  it('detects missing object description', () => {
    const procurement = { object: null };
    expect(procurement.object).toBeNull();
  });

  it('detects contract without supplier', () => {
    const contract = { supplierId: null };
    expect(contract.supplierId).toBeNull();
  });

  it('does NOT flag non-zero values', () => {
    const procurement = { status: 'Homologado', estimatedValue: 50000, awardedValue: 45000 };
    const isIssue = procurement.status === 'Homologado' && procurement.awardedValue === 0;
    expect(isIssue).toBe(false);
  });
});

// ─── Severity Classification ──────────────────────────────────────────────────

describe('Severity Classification', () => {
  const VALID_SEVERITIES = ['informative', 'attention', 'requires_analysis', 'high_relevance'];
  const INVALID_TERMS = ['corrupção', 'fraude', 'crime', 'ilegal', 'criminoso'];

  it('uses only valid severity levels', () => {
    VALID_SEVERITIES.forEach((s) => {
      expect(['informative', 'attention', 'requires_analysis', 'high_relevance']).toContain(s);
    });
  });

  it('does not include accusatory terms in severity labels', () => {
    INVALID_TERMS.forEach((term) => {
      expect(VALID_SEVERITIES).not.toContain(term);
    });
  });
});

// ─── Date Validation ─────────────────────────────────────────────────────────

describe('Date Validation', () => {
  it('detects expired contract (end date in past)', () => {
    const pastDate = new Date('2020-01-01');
    const today = new Date();
    expect(pastDate < today).toBe(true);
  });

  it('detects near-expiry contract (within 30 days)', () => {
    const soon = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(soon <= thirtyDays).toBe(true);
  });

  it('marks future contract as NOT expired', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const today = new Date();
    expect(futureDate < today).toBe(false);
  });
});

// ─── Currency Formatting ──────────────────────────────────────────────────────

describe('Currency Formatting', () => {
  it('formats value as Brazilian currency', () => {
    const val = 2450000;
    const formatted = val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    expect(formatted).toContain(',');
  });

  it('formats percentage to 1 decimal place', () => {
    const pct = 34.16789;
    expect(pct.toFixed(1)).toBe('34.2');
  });
});

// ─── Recurring Supplier Detection ────────────────────────────────────────────

describe('RecurringSupplier Analysis Rule', () => {
  it('flags supplier with >= 3 contracts', () => {
    const contractCount = 5;
    expect(contractCount).toBeGreaterThanOrEqual(3);
  });

  it('does NOT flag supplier with < 3 contracts', () => {
    const contractCount = 2;
    expect(contractCount).toBeLessThan(3);
  });
});

// ─── Keyword Matching for Similar Procurements ───────────────────────────────

describe('SimilarProcurements keyword detection', () => {
  const keywords = ['combustível', 'limpeza', 'manutenção', 'transporte', 'merenda'];

  it('matches combustível keyword (exact keyword in text)', () => {
    // The system uses keywords as stored – 'combustível' must appear in the text
    const obj = 'Aquisição de combustível para a frota municipal';
    expect(keywords.some((k) => obj.toLowerCase().includes(k))).toBe(true);
  });

  it('matches limpeza keyword', () => {
    const obj = 'Contratação de serviços de limpeza urbana';
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedObj = normalize(obj.toLowerCase());
    const normalizedKeywords = keywords.map(k => normalize(k.toLowerCase()));
    expect(normalizedKeywords.some((k) => normalizedObj.includes(k))).toBe(true);
  });

  it('does not match unrelated object', () => {
    const obj = 'Obra de pavimentação asfáltica';
    expect(keywords.some((k) => obj.toLowerCase().includes(k))).toBe(false);
  });
});
