package clock

import "time"

// Clock abstracts time for testing.
type Clock interface {
	Now() time.Time
}

// RealClock uses the system clock.
type RealClock struct{}

func (RealClock) Now() time.Time {
	return time.Now()
}

// MockClock returns a fixed time for testing.
type MockClock struct {
	FixedTime time.Time
}

func (m MockClock) Now() time.Time {
	return m.FixedTime
}
