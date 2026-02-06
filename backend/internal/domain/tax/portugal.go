package tax

import (
	"fmt"
	"math"

	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

// PortugalEngine implements the Engine interface for Portuguese tax rules.
type PortugalEngine struct{}

func NewPortugalEngine() *PortugalEngine {
	return &PortugalEngine{}
}

func (e *PortugalEngine) CalculateIRS(config YearConfig, annualGrossIncome money.Cents) IRSResult {
	// Step 1: Determine taxable income (simplified regime)
	taxableIncome := money.Cents(float64(annualGrossIncome) * config.SimplifiedCoefficient)

	// Step 2: Apply progressive brackets
	var totalTax money.Cents
	var breakdown []BracketResult
	remaining := taxableIncome

	for _, bracket := range config.Brackets {
		if remaining <= 0 {
			break
		}

		bracketWidth := bracket.UpperLimit - bracket.LowerLimit
		taxableInBracket := remaining
		if taxableInBracket > bracketWidth {
			taxableInBracket = bracketWidth
		}

		tax := money.Cents(float64(taxableInBracket) * bracket.Rate)
		totalTax += tax
		remaining -= taxableInBracket

		breakdown = append(breakdown, BracketResult{
			BracketLabel:     fmt.Sprintf("%.1f%%", bracket.Rate*100),
			TaxableInBracket: taxableInBracket,
			Rate:             bracket.Rate,
			TaxAmount:        tax,
		})
	}

	// Step 3: Solidarity surcharge (taxa adicional de solidariedade)
	taxableEuros := taxableIncome.Euros()
	if taxableEuros > 80000 {
		solidarityBase1 := math.Min(taxableEuros, 250000) - 80000
		totalTax += money.FromEuros(solidarityBase1 * 0.025)
	}
	if taxableEuros > 250000 {
		totalTax += money.FromEuros((taxableEuros - 250000) * 0.05)
	}

	// Step 4: Minimum existence check
	postTaxIncome := annualGrossIncome - totalTax
	if postTaxIncome < config.MinExistenceCents {
		totalTax = annualGrossIncome - config.MinExistenceCents
		if totalTax < 0 {
			totalTax = 0
		}
	}

	var effectiveRate float64
	if taxableIncome > 0 {
		effectiveRate = float64(totalTax) / float64(taxableIncome)
	}

	return IRSResult{
		TaxableIncome:    taxableIncome,
		TotalTax:         totalTax,
		EffectiveRate:    effectiveRate,
		BracketBreakdown: breakdown,
	}
}

func (e *PortugalEngine) CalculateSocialSecurity(config YearConfig, quarterlyGrossIncome money.Cents) SSResult {
	// Relevant income = quarterly gross * 70%
	relevantIncome := money.Cents(float64(quarterlyGrossIncome) * config.SSIncomeCoefficient)

	// Monthly contributory base
	monthlyBase := relevantIncome / 3

	// Apply floor (IAS-based minimum)
	if monthlyBase < config.IASValueCents {
		monthlyBase = config.IASValueCents
	}

	// Apply ceiling (12 * IAS)
	maxBase := config.IASValueCents * 12
	if monthlyBase > maxBase {
		monthlyBase = maxBase
	}

	// Monthly contribution
	monthlyContribution := money.Cents(float64(monthlyBase) * config.SSRate)

	// Quarterly payment
	quarterlyPayment := monthlyContribution * 3

	return SSResult{
		RelevantIncome:      relevantIncome,
		MonthlyBase:         monthlyBase,
		MonthlyContribution: monthlyContribution,
		QuarterlyPayment:    quarterlyPayment,
		AnnualEstimate:      monthlyContribution * 12,
	}
}

func (e *PortugalEngine) CalculateWithholding(grossAmount money.Cents, rate float64) money.Cents {
	return money.Cents(float64(grossAmount) * rate)
}

func (e *PortugalEngine) CalculateAnnualSummary(config YearConfig, annualGrossIncome money.Cents) AnnualSummary {
	irsResult := e.CalculateIRS(config, annualGrossIncome)

	// Estimate SS based on annual income (assume even quarterly distribution)
	quarterlyGross := annualGrossIncome / 4
	ssResult := e.CalculateSocialSecurity(config, quarterlyGross)

	withholdingTotal := e.CalculateWithholding(annualGrossIncome, config.DefaultWithholdingRate)

	netIncome := annualGrossIncome - irsResult.TotalTax - ssResult.AnnualEstimate

	return AnnualSummary{
		GrossIncome:      annualGrossIncome,
		TaxableIncome:    irsResult.TaxableIncome,
		IRSAmount:        irsResult.TotalTax,
		IRSEffectiveRate: irsResult.EffectiveRate,
		SSAnnual:         ssResult.AnnualEstimate,
		WithholdingTotal: withholdingTotal,
		NetIncome:        netIncome,
		MonthlyNet:       netIncome / 12,
	}
}
