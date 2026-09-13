package kernel

// Probability is a frequency in [0, 1]. It is never presented as a calibrated
// probability: every figure declares the event and the horizon it refers to
// (docs/evaluation-report.md §1).
type Probability float64

// Confidence is a two-sided interval around a Probability.
type Confidence struct {
	Low  float64
	High float64
}

// Provenance records where a figure came from. An action's movements are always
// declared by the user, never learned (docs/architecture.md §5.2).
type Provenance string

const (
	ProvenanceKnown        Provenance = "known"
	ProvenanceDeclared     Provenance = "declared"
	ProvenanceLearned      Provenance = "learned"
	ProvenanceHypothetical Provenance = "hypothetical"
)
