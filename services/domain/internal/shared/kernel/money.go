// Package kernel holds the value objects both bounded contexts depend on.
//
// It has no dependency on infrastructure, on the engine, or on either context:
// scenario and risk both import it, and it imports neither.
package kernel

import (
	"strconv"
	"strings"
)

// Money is an integer count of cents. Never a float, and never a float crossing
// a service boundary (AGENTS.md). The currency is carried by the company
// profile, not by the amount: the MVP is MXN only.
type Money int64

// Cents returns the underlying integer count.
func (m Money) Cents() int64 { return int64(m) }

// FormatMXN renders the amount the way the interface reads it in Spanish:
// thousands separated, no decimals from $1,000 up, two decimals below it.
//
// It reproduces engine/projection.py:format_mxn byte for byte, including the
// round-half-to-even behaviour both languages apply when formatting a float.
func (m Money) FormatMXN() string {
	pesos := float64(m) / 100
	sign := ""
	if pesos < 0 {
		pesos, sign = -pesos, "-"
	}
	digits := 2
	if pesos >= 1000 {
		digits = 0
	}
	return sign + "$" + groupThousands(strconv.FormatFloat(pesos, 'f', digits, 64))
}

// groupThousands inserts a comma every three digits of the integer part.
func groupThousands(s string) string {
	integer, fraction := s, ""
	if dot := strings.IndexByte(s, '.'); dot >= 0 {
		integer, fraction = s[:dot], s[dot:]
	}
	var b strings.Builder
	for i := range integer {
		if i > 0 && (len(integer)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteByte(integer[i])
	}
	return b.String() + fraction
}

// FormatCount renders an integer with thousands separators ("5,000"), the form
// the explanation uses for a number of simulated futures.
func FormatCount(n int) string { return groupThousands(strconv.Itoa(n)) }

// FormatFixed renders a float with a fixed number of decimals, matching
// Python's format specification of the same precision.
func FormatFixed(x float64, decimals int) string {
	return strconv.FormatFloat(x, 'f', decimals, 64)
}
