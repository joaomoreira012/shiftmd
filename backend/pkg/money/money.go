package money

import "fmt"

// Cents represents a monetary value in cents (integer) to avoid floating-point errors.
// 1 EUR = 100 cents. Example: EUR 25.50 = 2550 cents.
type Cents int64

func FromEuros(euros float64) Cents {
	return Cents(euros * 100)
}

func (c Cents) Euros() float64 {
	return float64(c) / 100
}

func (c Cents) String() string {
	return fmt.Sprintf("EUR %.2f", c.Euros())
}
