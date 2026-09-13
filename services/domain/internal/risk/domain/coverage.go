// Package domain holds the risk context's entities, value objects and
// invariants. It imports nothing from infrastructure and nothing from an
// adapters package; that purity is checked in CI.
package domain

// AbstentionThreshold is the share of unknown profile variables above which no
// estimate is emitted. Source: docs/evaluation-report.md §2 — the supervised
// model degrades sharply under missing data (AP 0.838 → 0.491 with 10% hidden),
// so beyond this the honest answer is that there is no answer.
const AbstentionThreshold = 0.20

// Coverage counts how many of the profile variables the analysis depends on are
// actually known. An unknown variable is never substituted with zero.
type Coverage struct {
	Known int
	Total int
}

// NewCoverage builds a coverage from the counts the engine reports.
func NewCoverage(known, total int) Coverage { return Coverage{Known: known, Total: total} }

// UnknownFraction is the share of variables that are unknown.
func (c Coverage) UnknownFraction() float64 {
	if c.Total == 0 {
		return 1
	}
	return 1 - float64(c.Known)/float64(c.Total)
}

// RequiresAbstention reports whether coverage is too low to emit an estimate.
// This is the domain rule of docs/architecture.md §6.3, enforced here rather
// than trusted from the engine: the engine also applies it, and the two agreeing
// is the point.
func (c Coverage) RequiresAbstention() bool {
	return c.UnknownFraction() > AbstentionThreshold
}
