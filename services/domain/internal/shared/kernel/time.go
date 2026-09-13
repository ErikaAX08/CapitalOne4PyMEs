package kernel

import (
	"fmt"
	"time"
)

// Horizon is the number of days the analysis projects forward from the cut-off.
type Horizon int

// Days returns the horizon as a plain count of days.
func (h Horizon) Days() int { return int(h) }

// Weeks returns the whole weeks the horizon spans; the bound Module A reports
// when no obligation goes uncovered.
func (h Horizon) Weeks() int { return int(h) / 7 }

// CutoffDate is the calendar date the analysis projects from. Day offsets in the
// engine are relative to it: the engine never sees a calendar date.
type CutoffDate struct{ t time.Time }

// ParseCutoffDate reads an ISO-8601 date (YYYY-MM-DD).
func ParseCutoffDate(iso string) (CutoffDate, error) {
	t, err := time.Parse(time.DateOnly, iso)
	if err != nil {
		return CutoffDate{}, fmt.Errorf("cutoff_date: %q is not an ISO-8601 date", iso)
	}
	return CutoffDate{t: t}, nil
}

// NewCutoffDate builds a cut-off from an already-validated time.
func NewCutoffDate(t time.Time) CutoffDate {
	return CutoffDate{t: time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
}

// ISO renders the date as YYYY-MM-DD.
func (c CutoffDate) ISO() string { return c.t.Format(time.DateOnly) }

// Plus returns the calendar date `days` after the cut-off.
func (c CutoffDate) Plus(days int) CutoffDate {
	return CutoffDate{t: c.t.AddDate(0, 0, days)}
}

// IsZero reports whether the cut-off was never set.
func (c CutoffDate) IsZero() bool { return c.t.IsZero() }

var spanishMonths = [...]string{
	"enero", "febrero", "marzo", "abril", "mayo", "junio",
	"julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
}

// DateText renders the Spanish long date Module A reads out ("26 de noviembre").
// The contract is the language boundary: the date is English ISO in `date` and
// Spanish prose in `date_text`.
func (c CutoffDate) DateText() string {
	return fmt.Sprintf("%d de %s", c.t.Day(), spanishMonths[int(c.t.Month())-1])
}
