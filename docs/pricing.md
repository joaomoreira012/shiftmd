# Dynamic Pricing Resolution

Workplaces have a `base_rate_cents` and an optional set of **pricing rules** that override the base rate for specific time windows, days, or dates.

## Pricing Rules

Each rule has:

| Field | Description |
|-------|-------------|
| `priority` | Lower number = higher priority. First matching rule wins. |
| `time_start` / `time_end` | Time-of-day window (e.g., `22:00`-`08:00` for night shifts) |
| `days_of_week` | Array of days the rule applies (e.g., `{sat, sun}`) |
| `specific_dates` | Array of specific dates (e.g., holidays) |
| `rate_cents` | Absolute rate override (mutually exclusive with `rate_multiplier`) |
| `rate_multiplier` | Multiplier on base rate, e.g., `1.50` for 150% (mutually exclusive with `rate_cents`) |

### Example: Hospital Configuration

| Priority | Rule Name | Days | Time Window | Rate |
|----------|-----------|------|-------------|------|
| 1 | Holiday | - | all day | `specific_dates` = holidays, 2.0x multiplier |
| 2 | Sunday | sun | all day | 40.00 EUR/hr |
| 3 | Saturday | sat | all day | 35.00 EUR/hr |
| 4 | Night Weekday | mon-fri | 22:00-08:00 | 35.00 EUR/hr |
| 5 | *(no match)* | - | - | 25.00 EUR/hr (base rate) |

## Resolution Algorithm

When a shift is created or updated, `ResolveShiftEarnings()` runs:

### 1. Split at Boundaries

The shift is split into contiguous segments at:
- **Midnight crossings** (because `day_of_week` changes)
- **Rule time boundaries** (where `time_start` or `time_end` of any rule intersects the shift)

### 2. Match Each Segment

For each segment, iterate pricing rules by ascending priority. The first rule whose conditions match the segment's day and time wins. If no rule matches, the workplace's `base_rate_cents` applies.

### 3. Calculate Earnings

Per segment, based on `pay_model`:

| Pay Model | Calculation |
|-----------|-------------|
| `hourly` | `amount = hours * rate` |
| `per_turn` | `amount = rate` (full turn amount regardless of hours) |
| `monthly` | `amount = rate / monthly_expected_hours * hours` |

### Midnight Crossing Example

A shift from **Saturday 22:00** to **Sunday 06:00** with the hospital config above:

```
Segment 1: Sat 22:00 - Sun 00:00 (2h)
  → Day: Saturday → matches "Saturday" rule (priority 3)
  → Rate: 35.00 EUR/hr → Amount: 70.00 EUR

Segment 2: Sun 00:00 - Sun 06:00 (6h)
  → Day: Sunday → matches "Sunday" rule (priority 2)
  → Rate: 40.00 EUR/hr → Amount: 240.00 EUR

Total: 310.00 EUR
```

### Cross-Midnight Time Windows

Rules where `time_start > time_end` (e.g., 22:00-08:00) match if the time is `>= start` OR `< end`:

```go
if rule.TimeStart > rule.TimeEnd {
    return clock >= rule.TimeStart || clock < rule.TimeEnd
}
return clock >= rule.TimeStart && clock < rule.TimeEnd
```

## Implementation

- **Go backend**: `backend/internal/domain/workplace/pricing.go`
- **Earnings storage**: Each segment becomes a `shift_earnings` row linked to the shift and the matched pricing rule
- **Recalculation**: Updating a shift deletes old earnings and recalculates
