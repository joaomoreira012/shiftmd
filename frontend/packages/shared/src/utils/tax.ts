import {
  getTaxBrackets,
  SS_RATE,
  SS_INCOME_COEFFICIENT,
  IAS_2026,
  MEDICAL_PROFESSIONAL_COEFFICIENT,
  DEFAULT_WITHHOLDING_RATE,
  MIN_EXISTENCE_2026,
  type IRSBracket,
} from '../constants/tax-tables';

export interface TaxCalculationInput {
  grossAnnualIncomeCents: number;
  year?: number;
  isSimplifiedRegime?: boolean;
  activityCoefficient?: number;
}

export interface TaxCalculationResult {
  grossIncome: number;
  taxableIncome: number;
  irsAmount: number;
  irsEffectiveRate: number;
  socialSecurity: number;
  withholdingTax: number;
  netIncome: number;
  monthlyNet: number;
  bracketBreakdown: Array<{
    bracket: string;
    taxableInBracket: number;
    rate: number;
    tax: number;
  }>;
}

export function calculatePortugueseTax(input: TaxCalculationInput): TaxCalculationResult {
  const {
    grossAnnualIncomeCents,
    year = 2026,
    isSimplifiedRegime = true,
    activityCoefficient = MEDICAL_PROFESSIONAL_COEFFICIENT,
  } = input;

  const brackets = getTaxBrackets(year);

  // Step 1: Taxable income (simplified regime: 75% of gross is taxable)
  const taxableIncome = isSimplifiedRegime
    ? Math.round(grossAnnualIncomeCents * activityCoefficient)
    : grossAnnualIncomeCents;

  // Step 2: Apply progressive IRS brackets
  let remaining = taxableIncome;
  let totalIrs = 0;
  const bracketBreakdown: TaxCalculationResult['bracketBreakdown'] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bracketWidth = bracket.upperLimit - bracket.lowerLimit;
    const taxableInBracket = Math.min(remaining, bracketWidth);
    const tax = Math.round(taxableInBracket * bracket.rate);
    totalIrs += tax;
    remaining -= taxableInBracket;

    bracketBreakdown.push({
      bracket: `${(bracket.rate * 100).toFixed(1)}%`,
      taxableInBracket,
      rate: bracket.rate,
      tax,
    });
  }

  // Step 3: Solidarity surcharge
  const taxableEuros = taxableIncome / 100;
  if (taxableEuros > 80000) {
    const solidarityBase1 = Math.min(taxableEuros, 250000) - 80000;
    totalIrs += Math.round(solidarityBase1 * 0.025 * 100);
  }
  if (taxableEuros > 250000) {
    totalIrs += Math.round((taxableEuros - 250000) * 0.05 * 100);
  }

  // Step 4: Minimum existence check
  const postTaxIncome = grossAnnualIncomeCents - totalIrs;
  if (postTaxIncome < MIN_EXISTENCE_2026) {
    totalIrs = Math.max(0, grossAnnualIncomeCents - MIN_EXISTENCE_2026);
  }

  // Step 5: Social Security (21.4% on 70% of gross)
  const ssRelevantIncome = Math.round(grossAnnualIncomeCents * SS_INCOME_COEFFICIENT);
  const socialSecurity = Math.round(ssRelevantIncome * SS_RATE);

  // Step 6: Withholding tax
  const withholdingTax = Math.round(grossAnnualIncomeCents * DEFAULT_WITHHOLDING_RATE);

  const netIncome = grossAnnualIncomeCents - totalIrs - socialSecurity;

  const effectiveRate = taxableIncome > 0 ? totalIrs / taxableIncome : 0;

  return {
    grossIncome: grossAnnualIncomeCents,
    taxableIncome,
    irsAmount: totalIrs,
    irsEffectiveRate: effectiveRate,
    socialSecurity,
    withholdingTax,
    netIncome,
    monthlyNet: Math.round(netIncome / 12),
    bracketBreakdown,
  };
}
