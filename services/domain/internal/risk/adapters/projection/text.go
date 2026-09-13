package projection

import (
	"fmt"
	"strings"
	"unicode"

	riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"
	scenariodomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/scenario/domain"
	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

// capitalize reproduces Python's str.capitalize: upper-case the first rune and
// lower-case the rest.
func capitalize(s string) string {
	runes := []rune(s)
	if len(runes) == 0 {
		return s
	}
	out := make([]rune, len(runes))
	out[0] = unicode.ToUpper(runes[0])
	for i := 1; i < len(runes); i++ {
		out[i] = unicode.ToLower(runes[i])
	}
	return string(out)
}

func obligationPhrase(kind string) string {
	if label, ok := obligationLabels[kind]; ok {
		return label
	}
	return "la obligación"
}

// percent renders a frequency in [0,1] as a percentage with one decimal.
func percent(p kernel.Probability) string {
	return kernel.FormatFixed(float64(p)*100, 1)
}

// headline is Module A's dynamic text (PRD §3.1). It always names the concrete
// obligation: "tu nómina del 26 de noviembre" drives action, "riesgo elevado"
// does not.
func headline(s *riskdomain.Survival, kind scenariodomain.ActionKind, horizon kernel.Horizon, dateText string) string {
	if s.First == nil {
		if kind == scenariodomain.ActionNone {
			return "Operación actual, sin el proyecto en evaluación. " +
				"Introduce una decisión para ver su efecto."
		}
		return fmt.Sprintf("Ninguna obligación queda descubierta en el horizonte de %d días.", horizon.Days())
	}
	name := capitalize(obligationPhrase(s.First.Kind))
	amount := s.First.Gap.FormatMXN()
	if s.State == riskdomain.StateCrisis {
		return fmt.Sprintf("%s del día %d queda descubierta por %s. Se requiere acción.",
			name, s.First.Day, amount)
	}
	return fmt.Sprintf("%s del %s queda descubierta por %s. Hay margen para reforzar.",
		name, dateText, amount)
}

// reinforcementLabel is Module D's recommended action.
func reinforcementLabel(r *riskdomain.Reinforcement) string {
	if r == nil {
		return ""
	}
	if r.Amount == nil {
		return "Ningún refuerzo dentro del rango evaluado"
	}
	if !r.Required {
		return "No se requiere refuerzo: la frecuencia de brecha ya está bajo el 5%"
	}
	if r.Kind == riskdomain.ReinforcementAdvance {
		return fmt.Sprintf("Solicitar un anticipo de %s%% (%s)",
			percentageText(r.Percentage), r.Amount.FormatMXN())
	}
	return fmt.Sprintf("Inyectar capital de trabajo por %s", r.Amount.FormatMXN())
}

// percentageText renders an advance percentage with no decimals.
func percentageText(p *float64) string {
	if p == nil {
		return "0"
	}
	return kernel.FormatFixed(*p, 0)
}

// explanation is the one sentence of PRD §3.4, composed from response fields and
// never hard-coded: if the user changes a parameter and the sentence does not
// change, the judge will notice.
func explanation(
	a riskdomain.Assessment,
	scenario scenariodomain.Scenario,
	horizon kernel.Horizon,
) string {
	survival, r := a.Survival, a.Reinforcement
	kind := scenario.Action().Kind()
	if survival.First == nil {
		if kind == scenariodomain.ActionNone {
			return fmt.Sprintf(
				"Operación actual, sin la decisión en evaluación. Ninguna obligación queda "+
					"descubierta en el horizonte de %d días.", horizon.Days())
		}
		text := fmt.Sprintf("Ninguna obligación queda descubierta en el horizonte de %d días.",
			horizon.Days())
		if r != nil && r.Required && r.Amount != nil && *r.Amount != 0 {
			var name string
			if r.Kind == riskdomain.ReinforcementAdvance {
				name = fmt.Sprintf("un anticipo de %s%% (%s)",
					percentageText(r.Percentage), r.Amount.FormatMXN())
			} else {
				name = fmt.Sprintf("una inyección de capital de %s", r.Amount.FormatMXN())
			}
			text += fmt.Sprintf(
				" Aun así, en %s%% de %s futuros simulados aparece una brecha; %s la reduce a %s%%.",
				percent(a.Simulation.GapFrequency), kernel.FormatCount(a.Simulation.Paths),
				name, percent(r.GapFrequencyAfter))
		}
		return text
	}

	obligation := obligationPhrase(survival.First.Kind)
	var parts []string
	if scenario.Stress().MainCustomerLost {
		parts = append(parts, "Sin el cliente principal, los cobros base ya no sostienen la operación.")
	}
	collection := a.EffectiveCollectionDays
	if day, ok := collection["project.collection"]; ok {
		switch {
		case day > horizon.Days():
			parts = append(parts, fmt.Sprintf(
				"El cobro del proyecto llega después del horizonte de %d días.", horizon.Days()))
		case day > survival.First.Day:
			parts = append(parts, fmt.Sprintf("El cobro llega el día %d, después de %s del día %d.",
				day, obligation, survival.First.Day))
		default:
			parts = append(parts, fmt.Sprintf("%s del día %d queda descubierta.",
				capitalize(obligation), survival.First.Day))
		}
	} else if day, ok := collection["credit.deferred_collection"]; ok {
		parts = append(parts, fmt.Sprintf(
			"El cobro diferido llega el día %d, después de %s del día %d.",
			day, obligation, survival.First.Day))
	} else {
		parts = append(parts, fmt.Sprintf("%s del día %d queda descubierta.",
			capitalize(obligation), survival.First.Day))
	}
	parts = append(parts, fmt.Sprintf("Faltan %s.", survival.First.Gap.FormatMXN()))

	if r != nil && r.Amount != nil {
		var name string
		if r.Kind == riskdomain.ReinforcementAdvance {
			name = fmt.Sprintf("Un anticipo de %s%% (%s)",
				percentageText(r.Percentage), r.Amount.FormatMXN())
		} else {
			name = fmt.Sprintf("Una inyección de capital de %s", r.Amount.FormatMXN())
		}
		if r.StateAfter == riskdomain.StateStable {
			parts = append(parts, fmt.Sprintf("%s elimina esta brecha en este escenario.", name))
		} else {
			parts = append(parts, fmt.Sprintf(
				"%s reduce la frecuencia de brecha de %s%% a %s%%, sin eliminarla.",
				name, percent(a.Simulation.GapFrequency), percent(r.GapFrequencyAfter)))
		}
	} else if r != nil && !r.Found {
		parts = append(parts, "Ningún refuerzo dentro del rango evaluado elimina esta brecha.")
	}
	return strings.Join(parts, " ")
}

// warnings are always present and always rendered: a non-empty array that does
// not appear on screen is a defect, not an aesthetic omission (PRD §5.3).
func warnings(a riskdomain.Assessment, horizon kernel.Horizon) []string {
	out := append([]string(nil), baseWarnings...)
	for _, day := range a.EffectiveCollectionDays {
		if day > horizon.Days() {
			out = append(out, "collection_beyond_horizon")
			break
		}
	}
	if r := a.Reinforcement; r != nil {
		if !r.Found {
			out = append(out, "no_reinforcement_within_grid")
		}
		if r.Kind == riskdomain.ReinforcementCapitalInjection {
			out = append(out, "reinforcement_grid_is_capital_injection")
		}
	}
	for _, f := range a.Tension {
		if f.SearchBounded != nil && *f.SearchBounded {
			out = append(out, "tolerance_beyond_search_range")
			break
		}
	}
	return out
}
