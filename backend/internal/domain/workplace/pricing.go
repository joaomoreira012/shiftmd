package workplace

import (
	"sort"
	"time"

	"github.com/joao-moreira/doctor-tracker/pkg/money"
)

// EarningSegment represents a time segment within a shift with its calculated earnings.
type EarningSegment struct {
	Start    time.Time    `json:"start"`
	End      time.Time    `json:"end"`
	Hours    float64      `json:"hours"`
	Rate     money.Cents  `json:"rate_cents"`
	Amount   money.Cents  `json:"amount_cents"`
	RuleName string       `json:"rule_name,omitempty"`
}

// ResolveShiftEarnings calculates earnings for a shift based on the workplace's pricing rules.
// It splits the shift at pricing rule boundaries and midnight crossings, then evaluates
// each segment against the priority-ordered rules.
func ResolveShiftEarnings(shiftStart, shiftEnd time.Time, wp *Workplace, rules []*PricingRule) []EarningSegment {
	// Sort rules by priority (lower number = higher priority)
	sortedRules := make([]*PricingRule, len(rules))
	copy(sortedRules, rules)
	sort.Slice(sortedRules, func(i, j int) bool {
		return sortedRules[i].Priority < sortedRules[j].Priority
	})

	// Split the shift into segments at rule boundaries and midnight crossings
	segments := splitIntoSegments(shiftStart, shiftEnd, sortedRules)

	var earnings []EarningSegment
	for _, seg := range segments {
		rate, ruleName := resolveRate(seg.Start, wp, sortedRules)
		hours := seg.End.Sub(seg.Start).Hours()

		var amount money.Cents
		switch wp.PayModel {
		case PayModelHourly:
			amount = money.Cents(float64(rate) * hours)
		case PayModelPerTurn:
			// For per-turn, distribute the rate proportionally across segments
			totalHours := shiftEnd.Sub(shiftStart).Hours()
			if totalHours > 0 {
				amount = money.Cents(float64(rate) * hours / totalHours)
			}
		case PayModelMonthly:
			if wp.MonthlyExpectedHours != nil && *wp.MonthlyExpectedHours > 0 {
				amount = money.Cents(float64(rate) / *wp.MonthlyExpectedHours * hours)
			}
		}

		earnings = append(earnings, EarningSegment{
			Start:    seg.Start,
			End:      seg.End,
			Hours:    hours,
			Rate:     rate,
			Amount:   amount,
			RuleName: ruleName,
		})
	}

	return earnings
}

// TotalEarnings sums up all earning segments.
func TotalEarnings(segments []EarningSegment) money.Cents {
	var total money.Cents
	for _, seg := range segments {
		total += seg.Amount
	}
	return total
}

type timeSegment struct {
	Start time.Time
	End   time.Time
}

// splitIntoSegments breaks a shift into segments at midnight boundaries.
// Midnight boundaries are important because the day-of-week changes.
func splitIntoSegments(start, end time.Time, rules []*PricingRule) []timeSegment {
	var segments []timeSegment

	current := start
	for current.Before(end) {
		// Find the next midnight after current
		nextMidnight := time.Date(
			current.Year(), current.Month(), current.Day()+1,
			0, 0, 0, 0, current.Location(),
		)

		segEnd := end
		if nextMidnight.Before(end) {
			segEnd = nextMidnight
		}

		// Further split by rule time boundaries within this day-segment
		daySegments := splitByRuleBoundaries(current, segEnd, rules)
		segments = append(segments, daySegments...)

		current = segEnd
	}

	return segments
}

// splitByRuleBoundaries splits a within-day segment at pricing rule time boundaries.
func splitByRuleBoundaries(start, end time.Time, rules []*PricingRule) []timeSegment {
	// Collect all unique boundary times from rules within [start, end)
	boundaries := make(map[time.Time]bool)
	boundaries[start] = true
	boundaries[end] = true

	for _, rule := range rules {
		if rule.TimeStart != nil {
			t := parseTimeOnDate(start, *rule.TimeStart)
			if t.After(start) && t.Before(end) {
				boundaries[t] = true
			}
		}
		if rule.TimeEnd != nil {
			t := parseTimeOnDate(start, *rule.TimeEnd)
			if t.After(start) && t.Before(end) {
				boundaries[t] = true
			}
		}
	}

	// Sort boundary times
	times := make([]time.Time, 0, len(boundaries))
	for t := range boundaries {
		times = append(times, t)
	}
	sort.Slice(times, func(i, j int) bool {
		return times[i].Before(times[j])
	})

	// Create segments between consecutive boundaries
	var segments []timeSegment
	for i := 0; i < len(times)-1; i++ {
		segments = append(segments, timeSegment{Start: times[i], End: times[i+1]})
	}

	return segments
}

// resolveRate finds the applicable rate for a given point in time.
func resolveRate(t time.Time, wp *Workplace, rules []*PricingRule) (money.Cents, string) {
	for _, rule := range rules {
		if !rule.IsActive {
			continue
		}
		if ruleMatchesTime(rule, t) {
			if rule.RateMultiplier != nil {
				return money.Cents(float64(wp.BaseRateCents) * *rule.RateMultiplier), rule.Name
			}
			if rule.RateCents != nil {
				return *rule.RateCents, rule.Name
			}
		}
	}
	return wp.BaseRateCents, "base"
}

// ruleMatchesTime checks whether a pricing rule applies at a given time.
func ruleMatchesTime(rule *PricingRule, t time.Time) bool {
	// Check specific dates first
	if len(rule.SpecificDates) > 0 {
		dateStr := t.Format("2006-01-02")
		matched := false
		for _, d := range rule.SpecificDates {
			if d == dateStr {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
		// If specific dates are set and matched, check time window (if any)
		return matchTimeWindow(rule, t)
	}

	// Check day of week
	if len(rule.DaysOfWeek) > 0 {
		dow := timeToDayOfWeek(t)
		matched := false
		for _, d := range rule.DaysOfWeek {
			if d == dow {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return matchTimeWindow(rule, t)
}

func matchTimeWindow(rule *PricingRule, t time.Time) bool {
	if rule.TimeStart == nil || rule.TimeEnd == nil {
		return true // No time restriction
	}

	clock := t.Hour()*60 + t.Minute()
	start := parseMinutes(*rule.TimeStart)
	end := parseMinutes(*rule.TimeEnd)

	if start <= end {
		// Normal window: e.g., 08:00-20:00
		return clock >= start && clock < end
	}
	// Overnight window: e.g., 22:00-08:00
	return clock >= start || clock < end
}

func timeToDayOfWeek(t time.Time) DayOfWeek {
	switch t.Weekday() {
	case time.Monday:
		return Monday
	case time.Tuesday:
		return Tuesday
	case time.Wednesday:
		return Wednesday
	case time.Thursday:
		return Thursday
	case time.Friday:
		return Friday
	case time.Saturday:
		return Saturday
	case time.Sunday:
		return Sunday
	}
	return Monday
}

func parseMinutes(timeStr string) int {
	// Parse "HH:MM" -> minutes since midnight
	if len(timeStr) < 5 {
		return 0
	}
	h := int(timeStr[0]-'0')*10 + int(timeStr[1]-'0')
	m := int(timeStr[3]-'0')*10 + int(timeStr[4]-'0')
	return h*60 + m
}

func parseTimeOnDate(date time.Time, timeStr string) time.Time {
	minutes := parseMinutes(timeStr)
	return time.Date(
		date.Year(), date.Month(), date.Day(),
		minutes/60, minutes%60, 0, 0, date.Location(),
	)
}
