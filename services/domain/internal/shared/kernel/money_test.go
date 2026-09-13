package kernel_test

import (
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// TestFormatMXNMatchesTheEngine pins the Go formatter against the output of
// engine/projection.py:format_mxn for the same inputs.
//
// The rows that matter are the ties: Python's format specification and Go's
// strconv both round half to even, so 1000.5 renders as $1,000 and 1234567.5 as
// $1,234,568 in both. A formatter that rounded half away from zero would agree
// on every other row and disagree on these, which is exactly the kind of
// difference that reaches a demo unnoticed.
func TestFormatMXNMatchesTheEngine(t *testing.T) {
	cases := []struct {
		cents int64
		want  string
	}{
		{0, "$0.00"},
		{1, "$0.01"},
		{50, "$0.50"},
		{99, "$0.99"},
		{100, "$1.00"},
		{999, "$9.99"},
		{1000, "$10.00"},
		{2050, "$20.50"},
		{99999, "$999.99"},
		{100050, "$1,000"},
		{999999, "$10,000"},
		{4000000, "$40,000"},
		{20000000, "$200,000"},
		{21600000, "$216,000"},
		{12345678, "$123,457"},
		{123456750, "$1,234,568"},
		{100000050, "$1,000,000"},
		{-4000000, "-$40,000"},
		{-2050, "-$20.50"},
	}
	for _, c := range cases {
		if got := kernel.Money(c.cents).FormatMXN(); got != c.want {
			t.Errorf("Money(%d).FormatMXN() = %q, want %q", c.cents, got, c.want)
		}
	}
}

func TestFormatCount(t *testing.T) {
	cases := map[int]string{0: "0", 100: "100", 5000: "5,000", 20000: "20,000", 1234567: "1,234,567"}
	for n, want := range cases {
		if got := kernel.FormatCount(n); got != want {
			t.Errorf("FormatCount(%d) = %q, want %q", n, got, want)
		}
	}
}

// TestDateTextIsSpanish covers the language boundary: `date` is ISO English,
// `date_text` is Spanish prose, and Module A reads the second one aloud.
func TestDateTextIsSpanish(t *testing.T) {
	cutoff, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatal(err)
	}
	// Day 75 from the cut-off is the payroll of the documented scenario.
	day75 := cutoff.Plus(75)
	if got, want := day75.ISO(), "2026-11-26"; got != want {
		t.Errorf("cutoff + 75 days = %s, want %s", got, want)
	}
	if got, want := day75.DateText(), "26 de noviembre"; got != want {
		t.Errorf("date_text = %q, want %q", got, want)
	}
}

func TestParseCutoffDateRejectsNonsense(t *testing.T) {
	for _, raw := range []string{"", "12/09/2026", "2026-13-01", "yesterday"} {
		if _, err := kernel.ParseCutoffDate(raw); err == nil {
			t.Errorf("ParseCutoffDate(%q) accepted an invalid date", raw)
		}
	}
}
