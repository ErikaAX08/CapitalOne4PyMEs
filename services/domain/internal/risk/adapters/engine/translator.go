package engine

import (
	"encoding/json"
	"fmt"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// result is the engine's output as engine/analysis.py:analyze returns it. It is
// a transport type: it exists to be translated away, and no field of it leaves
// this package.
type result struct {
	Status        string `json:"status"`
	Error         string `json:"error"`
	Message       string `json:"message"`
	Reason        string `json:"reason"`
	EngineVersion string `json:"engine_version"`
	Seed          int    `json:"seed"`
	Paths         int    `json:"paths"`
	HorizonDays   int    `json:"horizon_days"`
	Coverage      struct {
		KnownVariables int `json:"known_variables"`
		TotalVariables int `json:"total_variables"`
	} `json:"coverage"`
	Survival *struct {
		Weeks           int    `json:"weeks"`
		UpperBounded    bool   `json:"upper_bounded"`
		State           string `json:"state"`
		FirstObligation *struct {
			Kind     string `json:"kind"`
			Day      int    `json:"day"`
			GapCents int64  `json:"gap_cents"`
		} `json:"first_obligation"`
		NetRecurringFlowCents int64 `json:"net_recurring_flow_cents"`
	} `json:"survival"`
	Simulation *struct {
		Event                 string             `json:"event"`
		Paths                 int                `json:"paths"`
		GapFrequency          float64            `json:"gap_frequency"`
		GapFrequencyByHorizon map[string]float64 `json:"gap_frequency_by_horizon"`
		CI95                  []float64          `json:"ci95"`
		MeanGapCents          int64              `json:"mean_gap_cents"`
		P95GapCents           int64              `json:"p95_gap_cents"`
	} `json:"simulation"`
	Tension []struct {
		Factor        string   `json:"factor"`
		Stack         string   `json:"stack"`
		Tension       float64  `json:"tension"`
		RangeSource   string   `json:"range_source"`
		MarginCents   *float64 `json:"margin_cents"`
		RangeCents    *float64 `json:"range_cents"`
		MarginDays    *float64 `json:"margin_days"`
		RangeDays     *float64 `json:"range_days"`
		MarginPP      *float64 `json:"margin_pp"`
		RangePP       *float64 `json:"range_pp"`
		Margin        *float64 `json:"margin"`
		Range         *float64 `json:"range"`
		SearchBounded *bool    `json:"search_bounded"`
	} `json:"tension"`
	PropagationPath *struct {
		Nodes        []string `json:"nodes"`
		OriginNode   string   `json:"origin_node"`
		BreakingNode *string  `json:"breaking_node"`
	} `json:"propagation_path"`
	MinimumReinforcement *struct {
		Kind                 string    `json:"kind"`
		Percentage           *float64  `json:"percentage"`
		AmountCents          *int64    `json:"amount_cents"`
		AdditionalPercentage *float64  `json:"additional_percentage"`
		Required             bool      `json:"required"`
		Found                bool      `json:"found"`
		GapFrequencyAfter    float64   `json:"gap_frequency_after"`
		CI95After            []float64 `json:"ci95_after"`
		WeeksAfter           int       `json:"weeks_after"`
		UpperBoundedAfter    bool      `json:"upper_bounded_after"`
		StateAfter           string    `json:"state_after"`
		GridPointsEvaluated  int       `json:"grid_points_evaluated"`
	} `json:"minimum_reinforcement"`
	EffectiveCollectionDays map[string]int `json:"effective_collection_days"`
}

// EngineError reports that the engine refused the request. It carries the
// engine's own error type so the HTTP layer can tell a bad parameter (the
// caller's fault) from a broken run (ours).
type EngineError struct {
	Type    string
	Message string
}

func (e *EngineError) Error() string { return e.Type + ": " + e.Message }

// IsParameterError reports whether the engine rejected an input rather than
// failing to compute.
func (e *EngineError) IsParameterError() bool {
	return e.Type == "ParameterError" || e.Type == "DataQualityError" || e.Type == "ValueError"
}

// Translate turns the engine's result into domain objects. This is the boundary
// docs/architecture.md §6.2 describes: everything above it speaks the domain's
// language, and the abstention rule is applied here on the raw counts rather
// than trusted from the engine's own status field.
//
// It is exported so the projector's golden test can replay a captured engine
// result without a running engine.
func Translate(raw []byte) (riskdomain.Assessment, error) {
	var r result
	if err := json.Unmarshal(raw, &r); err != nil {
		return riskdomain.Assessment{}, fmt.Errorf("engine returned malformed JSON: %w", err)
	}
	if r.Status == "error" {
		return riskdomain.Assessment{}, &EngineError{Type: r.Error, Message: r.Message}
	}
	// The status is checked before anything is derived from the payload. A
	// response the adapter does not understand must fail visibly: read in the
	// other order, a malformed result with no coverage block would present
	// itself as "insufficient data coverage", which is a different claim and a
	// false one.
	if r.Status != "ok" && r.Status != "abstention" {
		return riskdomain.Assessment{}, fmt.Errorf("engine returned an unknown status %q", r.Status)
	}
	coverage := riskdomain.NewCoverage(r.Coverage.KnownVariables, r.Coverage.TotalVariables)
	horizon := kernel.Horizon(r.HorizonDays)
	if coverage.RequiresAbstention() || r.Status == "abstention" {
		return riskdomain.Abstain(coverage, r.EngineVersion, r.Seed, r.Paths, horizon), nil
	}
	if r.Survival == nil || r.Simulation == nil {
		return riskdomain.Assessment{}, fmt.Errorf("engine returned ok without survival or simulation")
	}

	survival := &riskdomain.Survival{
		Weeks:            r.Survival.Weeks,
		UpperBounded:     r.Survival.UpperBounded,
		State:            riskdomain.State(r.Survival.State),
		NetRecurringFlow: kernel.Money(r.Survival.NetRecurringFlowCents),
	}
	if f := r.Survival.FirstObligation; f != nil {
		survival.First = &riskdomain.Obligation{
			Kind: f.Kind, Day: f.Day, Gap: kernel.Money(f.GapCents),
		}
	}

	simulation := &riskdomain.Simulation{
		Event:                 r.Simulation.Event,
		HorizonDays:           r.HorizonDays,
		Paths:                 r.Simulation.Paths,
		GapFrequency:          kernel.Probability(r.Simulation.GapFrequency),
		GapFrequencyByHorizon: r.Simulation.GapFrequencyByHorizon,
		CI95:                  confidence(r.Simulation.CI95),
		MeanGap:               kernel.Money(r.Simulation.MeanGapCents),
		P95Gap:                kernel.Money(r.Simulation.P95GapCents),
	}

	tension := make([]riskdomain.TensionFactor, 0, len(r.Tension))
	for _, f := range r.Tension {
		margin, rng, unit, err := marginRange(f.Factor,
			f.MarginCents, f.RangeCents, f.MarginDays, f.RangeDays,
			f.MarginPP, f.RangePP, f.Margin, f.Range)
		if err != nil {
			return riskdomain.Assessment{}, err
		}
		tension = append(tension, riskdomain.TensionFactor{
			Factor:        f.Factor,
			Stack:         f.Stack,
			Margin:        margin,
			Range:         rng,
			Unit:          unit,
			Tension:       f.Tension,
			Source:        riskdomain.RangeSource(f.RangeSource),
			SearchBounded: f.SearchBounded,
		})
	}

	var path *riskdomain.PropagationPath
	if p := r.PropagationPath; p != nil {
		path = &riskdomain.PropagationPath{
			Nodes: p.Nodes, Origin: p.OriginNode, Breaking: p.BreakingNode,
		}
	}

	var reinforcement *riskdomain.Reinforcement
	if m := r.MinimumReinforcement; m != nil {
		reinforcement = &riskdomain.Reinforcement{
			Kind:                 riskdomain.ReinforcementKind(m.Kind),
			Percentage:           m.Percentage,
			AdditionalPercentage: m.AdditionalPercentage,
			Required:             m.Required,
			Found:                m.Found,
			GapFrequencyAfter:    kernel.Probability(m.GapFrequencyAfter),
			CI95After:            confidence(m.CI95After),
			WeeksAfter:           m.WeeksAfter,
			UpperBoundedAfter:    m.UpperBoundedAfter,
			StateAfter:           riskdomain.State(m.StateAfter),
			GridPoints:           m.GridPointsEvaluated,
		}
		if m.AmountCents != nil {
			amount := kernel.Money(*m.AmountCents)
			reinforcement.Amount = &amount
		}
	}

	return riskdomain.Assessment{
		State:                   survival.State,
		Coverage:                coverage,
		EngineVersion:           r.EngineVersion,
		Seed:                    r.Seed,
		Paths:                   r.Paths,
		Horizon:                 horizon,
		Survival:                survival,
		Simulation:              simulation,
		Tension:                 tension,
		Path:                    path,
		Reinforcement:           reinforcement,
		EffectiveCollectionDays: r.EffectiveCollectionDays,
	}, nil
}

func confidence(ci []float64) kernel.Confidence {
	if len(ci) != 2 {
		return kernel.Confidence{}
	}
	return kernel.Confidence{Low: ci[0], High: ci[1]}
}

// marginRange collapses the four margin/range spellings the engine uses into one
// pair plus the unit that named it. The interface needs the unit to render the
// tooltip; the domain should not need four fields to hold two numbers.
func marginRange(
	factor string,
	marginCents, rangeCents, marginDays, rangeDays, marginPP, rangePP, margin, rng *float64,
) (float64, float64, riskdomain.TensionUnit, error) {
	switch {
	case marginCents != nil && rangeCents != nil:
		return *marginCents, *rangeCents, riskdomain.UnitCents, nil
	case marginDays != nil && rangeDays != nil:
		return *marginDays, *rangeDays, riskdomain.UnitDays, nil
	case marginPP != nil && rangePP != nil:
		return *marginPP, *rangePP, riskdomain.UnitPP, nil
	case margin != nil && rng != nil:
		return *margin, *rng, riskdomain.UnitRatio, nil
	default:
		return 0, 0, "", fmt.Errorf("tension factor %s carries no margin/range pair", factor)
	}
}
