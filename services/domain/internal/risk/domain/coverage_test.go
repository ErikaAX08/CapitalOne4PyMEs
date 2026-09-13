package domain_test

import (
	"math"
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
)

// TestAbstentionThreshold pins the rule of docs/evaluation-report.md §2: above
// 20% unknown variables the result is an abstention, not a probability.
//
// The boundary matters. Exactly 20% unknown is still an estimate; the rule is
// "more than 20%", and one of the seven profile variables missing is 14.3%,
// which must still produce a number.
func TestAbstentionThreshold(t *testing.T) {
	cases := []struct {
		known, total int
		abstain      bool
	}{
		{7, 7, false}, // 0.0% unknown
		{6, 7, false}, // 14.3% unknown — still an estimate
		{4, 5, false}, // exactly 20% unknown — the rule is strictly greater
		{5, 7, true},  // 28.6% unknown
		{0, 7, true},  // nothing known
		{0, 0, true},  // no variables at all is not confidence, it is ignorance
	}
	for _, c := range cases {
		coverage := domain.NewCoverage(c.known, c.total)
		if got := coverage.RequiresAbstention(); got != c.abstain {
			t.Errorf("coverage %d/%d (%.4f unknown): abstain = %v, want %v",
				c.known, c.total, coverage.UnknownFraction(), got, c.abstain)
		}
	}
}

func TestUnknownFraction(t *testing.T) {
	coverage := domain.NewCoverage(6, 7)
	if got := coverage.UnknownFraction(); math.Abs(got-0.142857142857) > 1e-9 {
		t.Errorf("unknown fraction = %v, want 1/7", got)
	}
}

func TestStateSet(t *testing.T) {
	for _, s := range []domain.State{
		domain.StateStable, domain.StateTension, domain.StateCrisis, domain.StateAbstention,
	} {
		if !s.Valid() {
			t.Errorf("%s is not recognised as a state", s)
		}
	}
	if domain.State("precaución").Valid() {
		t.Error("an invented state was accepted")
	}
	if !domain.StateAbstention.IsAbstention() || domain.StateCrisis.IsAbstention() {
		t.Error("IsAbstention does not identify the abstention state")
	}
}
