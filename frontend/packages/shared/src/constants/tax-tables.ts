export interface IRSBracket {
  lowerLimit: number; // in cents
  upperLimit: number; // in cents
  rate: number;
  deduction: number; // in cents
}

// 2026 IRS brackets (values in cents)
export const TAX_BRACKETS_2026: IRSBracket[] = [
  { lowerLimit: 0, upperLimit: 770300, rate: 0.125, deduction: 0 },
  { lowerLimit: 770300, upperLimit: 1162300, rate: 0.165, deduction: 30812 },
  { lowerLimit: 1162300, upperLimit: 1647200, rate: 0.220, deduction: 94754 },
  { lowerLimit: 1647200, upperLimit: 2132100, rate: 0.250, deduction: 144170 },
  { lowerLimit: 2132100, upperLimit: 2714600, rate: 0.285, deduction: 218792 },
  { lowerLimit: 2714600, upperLimit: 3979100, rate: 0.350, deduction: 395142 },
  { lowerLimit: 3979100, upperLimit: 5199700, rate: 0.370, deduction: 474724 },
  { lowerLimit: 5199700, upperLimit: 8119900, rate: 0.435, deduction: 812940 },
  { lowerLimit: 8119900, upperLimit: Infinity, rate: 0.480, deduction: 1178235 },
];

// 2025 IRS brackets (values in cents)
export const TAX_BRACKETS_2025: IRSBracket[] = [
  { lowerLimit: 0, upperLimit: 747900, rate: 0.130, deduction: 0 },
  { lowerLimit: 747900, upperLimit: 1128400, rate: 0.165, deduction: 26177 },
  { lowerLimit: 1128400, upperLimit: 1599200, rate: 0.220, deduction: 88240 },
  { lowerLimit: 1599200, upperLimit: 2070000, rate: 0.250, deduction: 136218 },
  { lowerLimit: 2070000, upperLimit: 2635500, rate: 0.285, deduction: 208668 },
  { lowerLimit: 2635500, upperLimit: 3863200, rate: 0.350, deduction: 379973 },
  { lowerLimit: 3863200, upperLimit: 5048300, rate: 0.370, deduction: 457237 },
  { lowerLimit: 5048300, upperLimit: 7883400, rate: 0.435, deduction: 785377 },
  { lowerLimit: 7883400, upperLimit: Infinity, rate: 0.480, deduction: 1140130 },
];

export function getTaxBrackets(year: number): IRSBracket[] {
  switch (year) {
    case 2026: return TAX_BRACKETS_2026;
    case 2025: return TAX_BRACKETS_2025;
    default: return TAX_BRACKETS_2026;
  }
}

// Social Security rate for independent workers
export const SS_RATE = 0.214;
export const SS_INCOME_COEFFICIENT = 0.70;

// IAS (Indexante dos Apoios Sociais)
export const IAS_2026 = 53713; // EUR 537.13 in cents
export const IAS_2025 = 52250; // EUR 522.50 in cents

// Simplified regime coefficient for medical professionals (Category B)
export const MEDICAL_PROFESSIONAL_COEFFICIENT = 0.75;

// Default withholding rate for medical professionals
export const DEFAULT_WITHHOLDING_RATE = 0.23;

// Minimum existence (minimo de existencia)
export const MIN_EXISTENCE_2026 = 1288000; // EUR 12,880 in cents
