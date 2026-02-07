# Portuguese Tax Engine

ShiftMD estimates Portuguese taxes for independent medical professionals (Category B income, simplified regime). The tax engine is implemented in both Go (`backend/internal/domain/tax/`) and TypeScript (`frontend/packages/shared/src/utils/tax.ts`) — changes must be kept in sync.

## IRS (Imposto sobre o Rendimento)

### Step 1: Taxable Income

Under the simplified regime, 75% of gross income is taxable (25% is deemed expenses):

```
taxable_income = gross_income * 0.75
```

### Step 2: Progressive Brackets (2026)

| Bracket | Taxable Income (EUR) | Rate | Deduction (EUR) |
|---------|---------------------|------|-----------------|
| 1 | 0 - 7,703 | 12.50% | 0 |
| 2 | 7,703 - 11,623 | 16.50% | 308.12 |
| 3 | 11,623 - 16,472 | 22.00% | 947.54 |
| 4 | 16,472 - 21,321 | 25.00% | 1,441.70 |
| 5 | 21,321 - 27,146 | 28.50% | 2,187.92 |
| 6 | 27,146 - 39,791 | 35.00% | 3,951.42 |
| 7 | 39,791 - 51,997 | 37.00% | 4,747.24 |
| 8 | 51,997 - 81,199 | 43.50% | 8,129.40 |
| 9 | 81,199+ | 48.00% | 11,782.35 |

Tax is calculated as: `tax = taxable_income * rate - deduction`

### Step 3: Solidarity Surcharge (Derrama de Solidariedade)

Additional tax on high incomes:
- 2.5% on taxable income between 80,000 EUR and 250,000 EUR
- 5.0% on taxable income above 250,000 EUR

### Step 4: Minimum Existence (Minimo de Existencia)

Post-tax income cannot fall below the minimum existence threshold (12,880 EUR for 2026). If tax would reduce net income below this amount, tax is reduced accordingly.

## Social Security (Seguranca Social)

Calculated quarterly based on the previous quarter's gross income:

```
relevant_income = quarterly_gross * 0.70
monthly_base = relevant_income / 3
monthly_base = clamp(monthly_base, 1 * IAS, 12 * IAS)
monthly_contribution = monthly_base * 0.214
quarterly_payment = monthly_contribution * 3
```

**IAS (Indexante dos Apoios Sociais)**: 537.13 EUR (2026)

**Declaration schedule:**
| Declaration | Period Covered |
|-------------|---------------|
| January | October - December |
| April | January - March |
| July | April - June |
| October | July - September |

## Withholding Tax (Retencao na Fonte)

Applied per invoice:

```
withholding = gross_amount * withholding_rate
```

- Default rate for medical professionals (Article 151 CIRS): **23%**
- Exempt if annual income < 15,000 EUR
- Configurable per workplace

## IVA (Value Added Tax)

- Medical services: **exempt** (Article 9 CIVA)
- Non-medical services (consulting, lectures): 23%
- Configurable per workplace

## Tax Data Versioning

Tax brackets and rates are stored in:
- **Database**: `tax_year_configs` table with JSONB brackets (seeded for 2025 and 2026)
- **Go backend**: `backend/internal/domain/tax/brackets.go`
- **TypeScript**: `frontend/packages/shared/src/constants/tax-tables.ts`

When adding a new tax year, all three locations need to be updated.
