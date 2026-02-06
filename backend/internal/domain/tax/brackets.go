package tax

import "github.com/joao-moreira/doctor-tracker/pkg/money"

// Portugal2026Config returns the tax configuration for fiscal year 2026.
func Portugal2026Config() YearConfig {
	return YearConfig{
		FiscalYear: 2026,
		Brackets: []IRSBracket{
			{LowerLimit: 0, UpperLimit: money.FromEuros(7703), Rate: 0.125, Deduction: 0},
			{LowerLimit: money.FromEuros(7703), UpperLimit: money.FromEuros(11623), Rate: 0.165, Deduction: money.FromEuros(308.12)},
			{LowerLimit: money.FromEuros(11623), UpperLimit: money.FromEuros(16472), Rate: 0.220, Deduction: money.FromEuros(947.54)},
			{LowerLimit: money.FromEuros(16472), UpperLimit: money.FromEuros(21321), Rate: 0.250, Deduction: money.FromEuros(1441.70)},
			{LowerLimit: money.FromEuros(21321), UpperLimit: money.FromEuros(27146), Rate: 0.285, Deduction: money.FromEuros(2187.92)},
			{LowerLimit: money.FromEuros(27146), UpperLimit: money.FromEuros(39791), Rate: 0.350, Deduction: money.FromEuros(3951.42)},
			{LowerLimit: money.FromEuros(39791), UpperLimit: money.FromEuros(51997), Rate: 0.370, Deduction: money.FromEuros(4747.24)},
			{LowerLimit: money.FromEuros(51997), UpperLimit: money.FromEuros(81199), Rate: 0.435, Deduction: money.FromEuros(8129.40)},
			{LowerLimit: money.FromEuros(81199), UpperLimit: money.Cents(999999999999), Rate: 0.480, Deduction: money.FromEuros(11782.35)},
		},
		SSRate:                 0.214,
		SSIncomeCoefficient:    0.70,
		IASValueCents:          money.FromEuros(537.13),
		DefaultWithholdingRate: 0.25,
		MinExistenceCents:      money.FromEuros(12880),
		SimplifiedCoefficient:  0.75,
	}
}

// Portugal2025Config returns the tax configuration for fiscal year 2025.
func Portugal2025Config() YearConfig {
	return YearConfig{
		FiscalYear: 2025,
		Brackets: []IRSBracket{
			{LowerLimit: 0, UpperLimit: money.FromEuros(7479), Rate: 0.130, Deduction: 0},
			{LowerLimit: money.FromEuros(7479), UpperLimit: money.FromEuros(11284), Rate: 0.165, Deduction: money.FromEuros(261.77)},
			{LowerLimit: money.FromEuros(11284), UpperLimit: money.FromEuros(15992), Rate: 0.220, Deduction: money.FromEuros(882.40)},
			{LowerLimit: money.FromEuros(15992), UpperLimit: money.FromEuros(20700), Rate: 0.250, Deduction: money.FromEuros(1362.18)},
			{LowerLimit: money.FromEuros(20700), UpperLimit: money.FromEuros(26355), Rate: 0.285, Deduction: money.FromEuros(2086.68)},
			{LowerLimit: money.FromEuros(26355), UpperLimit: money.FromEuros(38632), Rate: 0.350, Deduction: money.FromEuros(3799.73)},
			{LowerLimit: money.FromEuros(38632), UpperLimit: money.FromEuros(50483), Rate: 0.370, Deduction: money.FromEuros(4572.37)},
			{LowerLimit: money.FromEuros(50483), UpperLimit: money.FromEuros(78834), Rate: 0.435, Deduction: money.FromEuros(7853.77)},
			{LowerLimit: money.FromEuros(78834), UpperLimit: money.Cents(999999999999), Rate: 0.480, Deduction: money.FromEuros(11401.30)},
		},
		SSRate:                 0.214,
		SSIncomeCoefficient:    0.70,
		IASValueCents:          money.FromEuros(522.50),
		DefaultWithholdingRate: 0.25,
		MinExistenceCents:      money.FromEuros(12180),
		SimplifiedCoefficient:  0.75,
	}
}
