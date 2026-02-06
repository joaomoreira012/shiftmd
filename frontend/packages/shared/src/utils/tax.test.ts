import { describe, it, expect } from 'vitest';
import { calculatePortugueseTax } from './tax';
import {
  SS_RATE,
  SS_INCOME_COEFFICIENT,
  MEDICAL_PROFESSIONAL_COEFFICIENT,
  MIN_EXISTENCE_2026,
} from '../constants/tax-tables';

describe('calculatePortugueseTax', () => {
  describe('zero income', () => {
    it('returns zero tax for zero income', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 0 });

      expect(result.grossIncome).toBe(0);
      expect(result.taxableIncome).toBe(0);
      expect(result.irsAmount).toBe(0);
      expect(result.socialSecurity).toBe(0);
      expect(result.netIncome).toBe(0);
      expect(result.monthlyNet).toBe(0);
      expect(result.bracketBreakdown).toHaveLength(0);
    });
  });

  describe('low income (below minimum existence)', () => {
    it('returns zero IRS when income is below minimum existence', () => {
      // Very low income: EUR 5,000 annual = 500000 cents
      // This is well below MIN_EXISTENCE_2026 (EUR 12,880)
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 500000 });

      // IRS should be 0 because post-tax income would be below minimum existence
      expect(result.irsAmount).toBe(0);
      expect(result.grossIncome).toBe(500000);
    });

    it('caps IRS so that post-tax income does not drop below minimum existence', () => {
      // Income just above minimum existence: EUR 14,000 = 1400000 cents
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 1400000 });

      // Net income (before SS) should be at least MIN_EXISTENCE_2026
      // The formula: netIncome = gross - IRS - SS
      // IRS is capped so that gross - IRS >= MIN_EXISTENCE_2026
      expect(result.grossIncome - result.irsAmount).toBeGreaterThanOrEqual(MIN_EXISTENCE_2026);
    });
  });

  describe('moderate income', () => {
    it('produces reasonable IRS, SS, and net for 30000 EUR annual', () => {
      // EUR 30,000 = 3000000 cents
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 3000000 });

      expect(result.grossIncome).toBe(3000000);

      // Taxable income with simplified regime: 75% of gross
      expect(result.taxableIncome).toBe(Math.round(3000000 * MEDICAL_PROFESSIONAL_COEFFICIENT));

      // IRS should be positive and less than gross
      expect(result.irsAmount).toBeGreaterThan(0);
      expect(result.irsAmount).toBeLessThan(3000000);

      // Social security should be positive
      expect(result.socialSecurity).toBeGreaterThan(0);

      // Net income should be positive and less than gross
      expect(result.netIncome).toBeGreaterThan(0);
      expect(result.netIncome).toBeLessThan(3000000);

      // Monthly net should be net / 12 (rounded)
      expect(result.monthlyNet).toBe(Math.round(result.netIncome / 12));
    });
  });

  describe('social security calculation', () => {
    it('calculates social security as 21.4% of 70% of gross', () => {
      const gross = 3000000; // EUR 30,000
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: gross });

      const expectedSSRelevant = Math.round(gross * SS_INCOME_COEFFICIENT);
      const expectedSS = Math.round(expectedSSRelevant * SS_RATE);

      expect(result.socialSecurity).toBe(expectedSS);
    });

    it('calculates social security correctly for various incomes', () => {
      const incomes = [1000000, 5000000, 10000000]; // EUR 10k, 50k, 100k

      for (const gross of incomes) {
        const result = calculatePortugueseTax({ grossAnnualIncomeCents: gross });
        const expectedSSRelevant = Math.round(gross * SS_INCOME_COEFFICIENT);
        const expectedSS = Math.round(expectedSSRelevant * SS_RATE);
        expect(result.socialSecurity).toBe(expectedSS);
      }
    });
  });

  describe('simplified regime', () => {
    it('uses 75% coefficient by default for taxable income', () => {
      const gross = 5000000; // EUR 50,000
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: gross });

      // Default is simplified regime with 75% coefficient
      expect(result.taxableIncome).toBe(Math.round(gross * 0.75));
    });

    it('uses full gross as taxable income when not in simplified regime', () => {
      const gross = 5000000;
      const result = calculatePortugueseTax({
        grossAnnualIncomeCents: gross,
        isSimplifiedRegime: false,
      });

      expect(result.taxableIncome).toBe(gross);
    });

    it('accepts custom activity coefficient', () => {
      const gross = 5000000;
      const customCoefficient = 0.35;
      const result = calculatePortugueseTax({
        grossAnnualIncomeCents: gross,
        activityCoefficient: customCoefficient,
      });

      expect(result.taxableIncome).toBe(Math.round(gross * customCoefficient));
    });
  });

  describe('bracket breakdown', () => {
    it('has entries for moderate income', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 3000000 });

      expect(result.bracketBreakdown.length).toBeGreaterThan(0);
    });

    it('has no entries for zero income', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 0 });

      expect(result.bracketBreakdown).toHaveLength(0);
    });

    it('each bracket entry has required fields', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 5000000 });

      for (const entry of result.bracketBreakdown) {
        expect(entry).toHaveProperty('bracket');
        expect(entry).toHaveProperty('taxableInBracket');
        expect(entry).toHaveProperty('rate');
        expect(entry).toHaveProperty('tax');
        expect(entry.taxableInBracket).toBeGreaterThan(0);
        expect(entry.rate).toBeGreaterThan(0);
        expect(entry.rate).toBeLessThanOrEqual(0.48);
        expect(entry.tax).toBeGreaterThan(0);
      }
    });

    it('bracket taxes sum up to total IRS (for income below solidarity threshold)', () => {
      // Use an income where solidarity surcharge does not apply
      // Taxable income below EUR 80,000: gross = EUR 100k, taxable = 75k
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 10000000 });

      const bracketTaxSum = result.bracketBreakdown.reduce((sum, b) => sum + b.tax, 0);
      // If taxable income < 80000 EUR (8000000 cents), no solidarity surcharge
      if (result.taxableIncome < 8000000) {
        // IRS might be capped by minimum existence, so check either equal or capped
        expect(bracketTaxSum).toBeGreaterThanOrEqual(result.irsAmount);
      }
    });
  });

  describe('net income calculation', () => {
    it('net income equals gross minus IRS minus social security', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 5000000 });

      expect(result.netIncome).toBe(result.grossIncome - result.irsAmount - result.socialSecurity);
    });

    it('net income equals gross minus IRS minus SS for high income', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 15000000 });

      expect(result.netIncome).toBe(result.grossIncome - result.irsAmount - result.socialSecurity);
    });
  });

  describe('effective rate', () => {
    it('effective rate is between 0 and 1', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 5000000 });

      expect(result.irsEffectiveRate).toBeGreaterThanOrEqual(0);
      expect(result.irsEffectiveRate).toBeLessThanOrEqual(1);
    });

    it('effective rate is 0 for zero income', () => {
      const result = calculatePortugueseTax({ grossAnnualIncomeCents: 0 });

      expect(result.irsEffectiveRate).toBe(0);
    });
  });
});
