// Package projection turns an Assessment into the state document of
// contracts/state.schema.json.
//
// This is the language boundary. Field names stay English; `label`, `headline`,
// `explanation` and `notices` are Spanish because they are rendered to the user.
// The front-end formats — currency, percentages, Title Case — it does not
// translate and it does not compute.
//
// engine/projection.py is the reference implementation: both must produce the
// same document, and projection_test.go checks this one against the four
// fallback states the Python side generated.
package projection

import riskdomain "github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/risk/domain"

// factorLabels names the six bars of Module C.
var factorLabels = map[string]string{
	"payroll_coverage":            "Cobertura De Nómina",
	"average_collection_period":   "Plazo Promedio De Cobro",
	"collection_delay_tolerance":  "Retraso En Cobranza",
	"cost_increase_tolerance":     "Incremento De Costos",
	"sales_drop_tolerance":        "Caída De Ventas",
	"main_customer_concentration": "Concentración De Clientes",
}

// obligationLabels are the sentence forms, used inside prose.
var obligationLabels = map[string]string{
	"payroll":    "la nómina",
	"supplier":   "el pago a proveedores",
	"debt":       "el servicio de deuda",
	"tax":        "el pago de impuestos",
	"materials":  "el pago de materiales",
	"hiring":     "el costo del personal del proyecto",
	"collection": "la venta a crédito",
}

// obligationTitles are the Title Case forms PRD §4.3 requires for names.
var obligationTitles = map[string]string{
	"payroll":    "Nómina",
	"supplier":   "Pago A Proveedores",
	"debt":       "Servicio De Deuda",
	"tax":        "Impuestos",
	"materials":  "Materiales",
	"hiring":     "Personal Del Proyecto",
	"collection": "Venta A Crédito",
}

// baseWarnings are emitted on every run: the limits of what this system
// demonstrates do not depend on the parameterization (PRD §2.2).
var baseWarnings = []string{
	"synthetic_assumptions",
	"no_mexico_validation",
	"declared_reference_range",
	"monte_carlo_excludes_distribution_error",
}

// warningLabels is the Spanish copy for every code the interface renders.
var warningLabels = map[string]string{
	"synthetic_assumptions":                   "Escenario sintético en MXN",
	"no_mexico_validation":                    "Sin validación en población mexicana",
	"declared_reference_range":                "Dos rangos de referencia son supuestos declarados",
	"monte_carlo_excludes_distribution_error": "Los intervalos Monte Carlo no cubren el error de distribución",
	"insufficient_data_coverage":              "Cobertura de datos insuficiente",
	"collection_beyond_horizon":               "El cobro cae fuera del horizonte",
	"no_reinforcement_within_grid":            "Ningún refuerzo en el rango evaluado elimina la brecha",
	"reinforcement_grid_is_capital_injection": "Refuerzo evaluado como inyección de capital",
	"tolerance_beyond_search_range":           "Alguna tolerancia excede el rango de búsqueda",
}

var stateLabels = map[riskdomain.State]string{
	riskdomain.StateStable:     "Estable",
	riskdomain.StateTension:    "Tensión",
	riskdomain.StateCrisis:     "Crisis Estructural",
	riskdomain.StateAbstention: "Sin Estimación",
}

var stackLabels = map[string]string{
	"finance":    "Finanzas",
	"sales":      "Ventas",
	"operations": "Operaciones",
	"people":     "Personas",
	"technology": "Tecnología",
	"compliance": "Cumplimiento",
}

var nodeLabels = map[string]string{
	"delivery":   "Entrega",
	"invoice":    "Factura",
	"collection": "Cobro",
	"cash":       "Efectivo",
	"payroll":    "Nómina",
	"supplier":   "Proveedores",
	"customer":   "Cliente Principal",
	"sales":      "Ventas",
	"materials":  "Materiales",
	"hiring":     "Contratación",
	"credit":     "Crédito",
	"debt":       "Deuda",
	"tax":        "Impuestos",
}

// definitions are the tooltips the PRD requires next to each headline figure. A
// large number without a definition is exactly the figure a judge asks you to
// justify (PRD §3.1).
var definitions = map[string]string{
	"survival_weeks": "Semanas completas entre la fecha de corte y la primera obligación que queda " +
		"descubierta, sobre la ruta determinista del escenario evaluado y sin choque " +
		"aleatorio. Si no aparece brecha en el horizonte, se reporta la cota que el " +
		"horizonte permite afirmar.",
	"tension": "Tensión = 1 − (margen disponible ÷ rango de referencia), acotada a [0, 1]. Es una " +
		"normalización de tolerancias univariadas, no una atribución causal aprendida. Los " +
		"rangos marcados como supuesto declarado son supuestos, no mediciones.",
	"gap_frequency": "Proporción de futuros simulados en los que alguna obligación queda descubierta " +
		"dentro del horizonte. Condicionada a los supuestos del escenario; no es una " +
		"probabilidad calibrada.",
}

// abstentionExplanation is the only sentence an abstention carries.
const abstentionExplanation = "Cobertura de datos insuficiente. No se emite estimación."
