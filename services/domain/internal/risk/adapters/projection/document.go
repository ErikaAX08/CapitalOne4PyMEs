package projection

import (
	"math"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// SchemaVersion is the version of contracts/state.schema.json this projector
// emits. An unknown version must be a visible failure on the reading side, never
// a silent zero.
const SchemaVersion = "v1"

// Document is contracts/state.schema.json. The schema forbids additional
// properties at the top level and inside `survival` and `simulation`, so the
// field sets here are exhaustive rather than convenient.
type Document struct {
	Schema               string            `json:"schema"`
	StateID              string            `json:"state_id"`
	StateLabel           string            `json:"state_label"`
	CompanyID            string            `json:"company_id"`
	CutoffDate           string            `json:"cutoff_date"`
	Currency             string            `json:"currency"`
	Seed                 int               `json:"seed"`
	EngineVersion        string            `json:"engine_version"`
	HorizonDays          int               `json:"horizon_days"`
	Coverage             Coverage          `json:"coverage"`
	Parameterization     map[string]any    `json:"parameterization"`
	Survival             *Survival         `json:"survival"`
	Simulation           *Simulation       `json:"simulation"`
	Tension              []TensionFactor   `json:"tension"`
	PropagationPath      *PropagationPath  `json:"propagation_path"`
	MinimumReinforcement *Reinforcement    `json:"minimum_reinforcement"`
	Explanation          string            `json:"explanation"`
	Warnings             []string          `json:"warnings"`
	Notices              []Notice          `json:"notices"`
	Definitions          map[string]string `json:"definitions"`
}

// Coverage is how much of the profile was known. Above 20% unknown the document
// is an abstention.
type Coverage struct {
	KnownVariables  int     `json:"known_variables"`
	TotalVariables  int     `json:"total_variables"`
	UnknownFraction float64 `json:"unknown_fraction"`
}

// Survival feeds Module A.
type Survival struct {
	Weeks                 int              `json:"weeks"`
	UpperBounded          bool             `json:"upper_bounded"`
	State                 string           `json:"state"`
	StateLabel            string           `json:"state_label"`
	Headline              string           `json:"headline"`
	NetRecurringFlowCents int64            `json:"net_recurring_flow_cents"`
	FirstObligation       *FirstObligation `json:"first_obligation"`
}

// FirstObligation is the concrete commitment Module A names.
type FirstObligation struct {
	Kind     string `json:"kind"`
	Label    string `json:"label"`
	Day      int    `json:"day"`
	Date     string `json:"date"`
	DateText string `json:"date_text"`
	GapCents int64  `json:"gap_cents"`
}

// Simulation feeds the tooltips of Modules A and D.
type Simulation struct {
	Event                 string             `json:"event"`
	HorizonDays           int                `json:"horizon_days"`
	Paths                 int                `json:"paths"`
	GapFrequency          float64            `json:"gap_frequency"`
	GapFrequencyByHorizon map[string]float64 `json:"gap_frequency_by_horizon"`
	CI95                  []float64          `json:"ci95"`
	MeanGapCents          int64              `json:"mean_gap_cents"`
	P95GapCents           int64              `json:"p95_gap_cents"`
}

// TensionFactor is one bar of Module C. It travels with the margin and range it
// was computed from, in the unit that names them, so the tooltip can show the
// computation and the figure is auditable rather than asserted.
type TensionFactor struct {
	Factor      string  `json:"factor"`
	Stack       string  `json:"stack"`
	StackLabel  string  `json:"stack_label"`
	Label       string  `json:"label"`
	Tension     float64 `json:"tension"`
	RangeSource string  `json:"range_source"`

	MarginCents *int64   `json:"margin_cents,omitempty"`
	RangeCents  *int64   `json:"range_cents,omitempty"`
	MarginDays  *int     `json:"margin_days,omitempty"`
	RangeDays   *int     `json:"range_days,omitempty"`
	MarginPP    *float64 `json:"margin_pp,omitempty"`
	RangePP     *float64 `json:"range_pp,omitempty"`
	Margin      *float64 `json:"margin,omitempty"`
	Range       *float64 `json:"range,omitempty"`

	SearchBounded *bool `json:"search_bounded,omitempty"`
}

// PropagationPath is the chain Module D animates left to right.
type PropagationPath struct {
	Nodes        []string          `json:"nodes"`
	NodeLabels   map[string]string `json:"node_labels"`
	OriginNode   string            `json:"origin_node"`
	BreakingNode *string           `json:"breaking_node"`
}

// Before is the left column of Module D's comparison. It comes from the same
// parameterization over the same Monte Carlo worlds as the "after" figures.
type Before struct {
	GapFrequency float64 `json:"gap_frequency"`
	Weeks        int     `json:"weeks"`
	UpperBounded bool    `json:"upper_bounded"`
	State        string  `json:"state"`
	StateLabel   string  `json:"state_label"`
}

// Reinforcement is Module D's counterfactual.
type Reinforcement struct {
	Kind                 string   `json:"kind"`
	Label                string   `json:"label"`
	Percentage           *float64 `json:"percentage"`
	AmountCents          *int64   `json:"amount_cents"`
	AdditionalPercentage *float64 `json:"additional_percentage,omitempty"`
	Required             bool     `json:"required"`
	Found                bool     `json:"found"`
	Before               Before   `json:"before"`
	StateLabelAfter      *string  `json:"state_label_after"`

	GapFrequencyAfter *float64  `json:"gap_frequency_after,omitempty"`
	CI95After         []float64 `json:"ci95_after,omitempty"`
	WeeksAfter        *int      `json:"weeks_after,omitempty"`
	UpperBoundedAfter *bool     `json:"upper_bounded_after,omitempty"`
	StateAfter        *string   `json:"state_after,omitempty"`

	GridPointsEvaluated int `json:"grid_points_evaluated"`
}

// Notice is one Module E chip: the Spanish label for a warning code.
type Notice struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

// Project turns an Assessment into the document the API returns and the
// front-end renders.
func Project(
	a riskdomain.Assessment,
	scenario scenariodomain.Scenario,
	companyID, currency string,
) Document {
	if currency == "" {
		currency = "MXN"
	}
	horizon := a.Horizon
	doc := Document{
		Schema:        SchemaVersion,
		CompanyID:     companyID,
		CutoffDate:    scenario.Cutoff().ISO(),
		Currency:      currency,
		Seed:          a.Seed,
		EngineVersion: a.EngineVersion,
		HorizonDays:   horizon.Days(),
		Coverage: Coverage{
			KnownVariables:  a.Coverage.Known,
			TotalVariables:  a.Coverage.Total,
			UnknownFraction: round(a.Coverage.UnknownFraction(), 4),
		},
		Definitions: definitions,
	}

	if a.State.IsAbstention() {
		codes := append(append([]string(nil), baseWarnings...), "insufficient_data_coverage")
		doc.StateID = string(riskdomain.StateAbstention)
		doc.StateLabel = stateLabels[riskdomain.StateAbstention]
		doc.Tension = []TensionFactor{}
		doc.Explanation = abstentionExplanation
		doc.Warnings = codes
		doc.Notices = notices(codes)
		return doc
	}

	doc.StateID = string(a.State)
	doc.StateLabel = stateLabels[a.State]
	doc.Parameterization = parameterization(scenario)
	doc.Survival = projectSurvival(a, scenario, horizon)
	doc.Simulation = projectSimulation(a.Simulation)
	doc.Tension = projectTension(a.Tension)
	doc.PropagationPath = projectPath(a.Path)
	doc.MinimumReinforcement = projectReinforcement(a)
	doc.Explanation = explanation(a, scenario, horizon)
	doc.Warnings = warnings(a, horizon)
	doc.Notices = notices(doc.Warnings)
	return doc
}

// parameterization echoes back exactly what the engine ran, so the front-end can
// confirm a response matches its last request and pick the nearest fallback.
func parameterization(s scenariodomain.Scenario) map[string]any {
	out := map[string]any{"action": string(s.Action().Kind())}
	for id, value := range s.Action().Parameters() {
		out[id] = value
	}
	out["collection_delay_days"] = s.Stress().CollectionDelayDays
	out["main_customer_lost"] = s.Stress().MainCustomerLost
	out["capital_injection_cents"] = s.Stress().CapitalInjectionCents
	return out
}

func projectSurvival(
	a riskdomain.Assessment,
	scenario scenariodomain.Scenario,
	horizon kernel.Horizon,
) *Survival {
	s := a.Survival
	if s == nil {
		return nil
	}
	out := &Survival{
		Weeks:                 s.Weeks,
		UpperBounded:          s.UpperBounded,
		State:                 string(s.State),
		StateLabel:            stateLabels[s.State],
		NetRecurringFlowCents: s.NetRecurringFlow.Cents(),
	}
	dateText := ""
	if s.First != nil {
		date := scenario.Cutoff().Plus(s.First.Day)
		dateText = date.DateText()
		label, ok := obligationTitles[s.First.Kind]
		if !ok {
			label = s.First.Kind
		}
		out.FirstObligation = &FirstObligation{
			Kind:     s.First.Kind,
			Label:    label,
			Day:      s.First.Day,
			Date:     date.ISO(),
			DateText: dateText,
			GapCents: s.First.Gap.Cents(),
		}
	}
	out.Headline = headline(s, scenario.Action().Kind(), horizon, dateText)
	return out
}

func projectSimulation(s *riskdomain.Simulation) *Simulation {
	if s == nil {
		return nil
	}
	return &Simulation{
		Event:                 s.Event,
		HorizonDays:           s.HorizonDays,
		Paths:                 s.Paths,
		GapFrequency:          float64(s.GapFrequency),
		GapFrequencyByHorizon: s.GapFrequencyByHorizon,
		CI95:                  []float64{s.CI95.Low, s.CI95.High},
		MeanGapCents:          s.MeanGap.Cents(),
		P95GapCents:           s.P95Gap.Cents(),
	}
}

func projectTension(factors []riskdomain.TensionFactor) []TensionFactor {
	out := make([]TensionFactor, 0, len(factors))
	for _, f := range factors {
		item := TensionFactor{
			Factor:        f.Factor,
			Stack:         f.Stack,
			StackLabel:    stackLabels[f.Stack],
			Label:         factorLabels[f.Factor],
			Tension:       f.Tension,
			RangeSource:   string(f.Source),
			SearchBounded: f.SearchBounded,
		}
		switch f.Unit {
		case riskdomain.UnitCents:
			margin, rng := int64(math.Round(f.Margin)), int64(math.Round(f.Range))
			item.MarginCents, item.RangeCents = &margin, &rng
		case riskdomain.UnitDays:
			margin, rng := int(math.Round(f.Margin)), int(math.Round(f.Range))
			item.MarginDays, item.RangeDays = &margin, &rng
		case riskdomain.UnitPP:
			margin, rng := f.Margin, f.Range
			item.MarginPP, item.RangePP = &margin, &rng
		default:
			margin, rng := f.Margin, f.Range
			item.Margin, item.Range = &margin, &rng
		}
		out = append(out, item)
	}
	return out
}

func projectPath(p *riskdomain.PropagationPath) *PropagationPath {
	if p == nil {
		return nil
	}
	labels := make(map[string]string, len(p.Nodes))
	for _, node := range p.Nodes {
		label, ok := nodeLabels[node]
		if !ok {
			label = node
		}
		labels[node] = label
	}
	return &PropagationPath{
		Nodes:        p.Nodes,
		NodeLabels:   labels,
		OriginNode:   p.Origin,
		BreakingNode: p.Breaking,
	}
}

func projectReinforcement(a riskdomain.Assessment) *Reinforcement {
	r := a.Reinforcement
	if r == nil {
		return nil
	}
	out := &Reinforcement{
		Kind:                 string(r.Kind),
		Label:                reinforcementLabel(r),
		Percentage:           r.Percentage,
		AdditionalPercentage: r.AdditionalPercentage,
		Required:             r.Required,
		Found:                r.Found,
		GridPointsEvaluated:  r.GridPoints,
		Before: Before{
			GapFrequency: float64(a.Simulation.GapFrequency),
			Weeks:        a.Survival.Weeks,
			UpperBounded: a.Survival.UpperBounded,
			State:        string(a.Survival.State),
			StateLabel:   stateLabels[a.Survival.State],
		},
	}
	if r.Amount != nil {
		cents := r.Amount.Cents()
		out.AmountCents = &cents
	}
	// The "after" figures exist only when the grid found a reinforcement; when it
	// did not, the columns are absent rather than zero, and Module E carries the
	// matching notice.
	if r.Found {
		frequency := float64(r.GapFrequencyAfter)
		weeks := r.WeeksAfter
		bounded := r.UpperBoundedAfter
		state := string(r.StateAfter)
		label := stateLabels[r.StateAfter]
		out.GapFrequencyAfter = &frequency
		out.CI95After = []float64{r.CI95After.Low, r.CI95After.High}
		out.WeeksAfter = &weeks
		out.UpperBoundedAfter = &bounded
		out.StateAfter = &state
		out.StateLabelAfter = &label
	}
	return out
}

func notices(codes []string) []Notice {
	out := make([]Notice, 0, len(codes))
	for _, code := range codes {
		label, ok := warningLabels[code]
		if !ok {
			label = code
		}
		out = append(out, Notice{Code: code, Label: label})
	}
	return out
}

// round applies half-away-from-zero rounding to a fixed number of decimals. It
// matches Python's round() everywhere the engine's inputs can reach: the values
// rounded here are ratios of small integers, which never land exactly on a tie.
func round(x float64, decimals int) float64 {
	factor := math.Pow(10, float64(decimals))
	return math.Round(x*factor) / factor
}
