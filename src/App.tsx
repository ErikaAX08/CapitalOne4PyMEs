import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, CircleHelp, Layers3, ShieldCheck } from "lucide-react";
import { scenarios } from "./entities/scenario";
import type { Business, FinancialTransaction } from "./entities/business";
import { mockFinancialDataSource } from "./entities/business";
import type { SimulationOutput } from "./entities/simulation";
import { simulateFinancialDecision } from "./entities/simulation";
import { formatMoney } from "./shared";
import {
  useSimulationFlow,
  ScenarioList,
  ScenarioDialog,
  SimulationProgress,
  SimulationResult,
} from "./features/scenario-simulation";
import { IntroScreen } from "./features/onboarding";
import { FinancialOverview } from "./features/financial-overview";
import { TechnicalExplanationDialog } from "./features/technical-explanation";
import { TowerCard } from "./features/resilience-tower";
import {
  ExpensePanel,
  ExpenseFeedback,
  useExpenses,
} from "./features/expense-simulation";
type BusinessDataState =
  | { status: "loading" }
  | { status: "ready"; business: Business; transactions: FinancialTransaction[] }
  | { status: "empty" }
  | { status: "error" };
const EMPTY_OUTPUT: SimulationOutput = {
  removedExpenseBlocks: 0,
  simulatedExpenseTotal: 0,
  fragilityScore: 0,
  survivalWeeks: 0,
  recommendedBuffer: 0,
  minimumProjectedBalance: 0,
  criticalWeek: null,
  weeklyProjections: [],
  towerBlockChanges: [],
  recommendation: "",
  status: "Estable",
};
function useBusinessData(): BusinessDataState {
  const [state, setState] = useState<BusinessDataState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mockFinancialDataSource.getBusiness(),
      mockFinancialDataSource.getTransactions(),
    ])
      .then(([business, transactions]) => {
        if (cancelled) return;
        setState(
          transactions.length
            ? { status: "ready", business, transactions }
            : { status: "empty" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
function Logo() {
  return (
    <div className="logo">
      <span className="logo-symbol">
        <Layers3 size={23} />
      </span>
      resilia<span className="logo-dot">.</span>
    </div>
  );
}
function DemoBadge() {
  return (
    <span className="demo-badge">
      <span />
      Demo con datos simulados
    </span>
  );
}
export default function App() {
  const data = useBusinessData();
  const {
    expenses,
    add: addExpenseEntry,
    undo: undoExpense,
    reset: resetExpenses,
  } = useExpenses();
  const [technical, setTechnical] = useState(false);
  const reduced = !!useReducedMotion();
  const [flow, dispatch] = useSimulationFlow(reduced);
  const mitigated = flow.state === "mitigating" || flow.state === "recovered";
  const active =
    flow.state === "simulating" || flow.state === "result" || mitigated;
  const baseline = useMemo(
    () =>
      data.status === "ready"
        ? simulateFinancialDecision(data.business, data.transactions, null)
        : EMPTY_OUTPUT,
    [data],
  );
  const output = useMemo(
    () =>
      data.status === "ready"
        ? simulateFinancialDecision(
            data.business,
            data.transactions,
            active ? flow.scenario : null,
            mitigated ? ["advance40"] : [],
            expenses,
          )
        : EMPTY_OUTPUT,
    [data, flow.scenario, active, mitigated, expenses],
  );
  const starting = useMemo(
    () =>
      data.status === "ready"
        ? simulateFinancialDecision(
            data.business,
            data.transactions,
            null,
            [],
            expenses,
          )
        : EMPTY_OUTPUT,
    [data, expenses],
  );
  const beforeMitigation = useMemo(
    () =>
      data.status === "ready"
        ? simulateFinancialDecision(
            data.business,
            data.transactions,
            flow.scenario,
            [],
            expenses,
          )
        : EMPTY_OUTPUT,
    [data, flow.scenario, expenses],
  );
  if (data.status !== "ready") {
    return (
      <div className="app">
        <header>
          <Logo />
          <div className="header-right">
            <DemoBadge />
          </div>
        </header>
        <main role="status" aria-live="polite" style={{ padding: "3rem" }}>
          {data.status === "loading"
            ? "Cargando datos del negocio…"
            : data.status === "empty"
              ? "No hay transacciones disponibles para simular."
              : "No pudimos cargar los datos del negocio. Intenta de nuevo."}
        </main>
      </div>
    );
  }
  function reset() {
    resetExpenses();
    dispatch({ type: "RESET" });
  }
  function addExpense(category: string, amount: number) {
    addExpenseEntry(category, amount);
    dispatch({ type: "CLEAR_SKIP" });
    if (window.innerWidth <= 700)
      document.querySelector(".tower-card")?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
  }
  function simulate() {
    dispatch({ type: "START_SIMULATION" });
  }
  const shown =
    flow.state === "simulating"
      ? {
          ...output,
          fragilityScore: Math.round(
            starting.fragilityScore +
              (output.fragilityScore - starting.fragilityScore) *
                flow.progress,
          ),
          survivalWeeks: Math.round(
            starting.survivalWeeks +
              (output.survivalWeeks - starting.survivalWeeks) * flow.progress,
          ),
          recommendedBuffer: Math.round(
            starting.recommendedBuffer +
              (output.recommendedBuffer - starting.recommendedBuffer) *
                flow.progress,
          ),
        }
      : output;
  const phase =
    flow.progress < 0.2
      ? "Aplicamos la inversión inicial"
      : flow.progress < 0.4
        ? "El efectivo sale hoy. El ingreso llega después."
        : flow.progress < 0.58
          ? "Los cobros futuros no cubren los pagos de hoy"
          : flow.progress < 0.78
            ? "Tu cliente principal retrasó su pago 30 días"
            : "Sin liquidez, la estructura pierde su soporte";
  return (
    <div className="app">
      <header>
        <Logo />
        <div className="header-right">
          <DemoBadge />
          <span className="header-divider" />
          <div className="avatar">ML</div>
          <span className="owner">
            Mariana Luna<small>Administradora</small>
          </span>
        </div>
      </header>
      <AnimatePresence mode="wait">
        {flow.state === "intro" ? (
          <IntroScreen
            onEnter={() => dispatch({ type: "ENTER_DASHBOARD" })}
            reduced={reduced}
            baseline={baseline}
          />
        ) : (
          <motion.main
            key="dashboard"
            className="dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="page-heading">
              <div>
                <div className="breadcrumb">
                  MI NEGOCIO <ChevronRight size={12} /> ESTABILIDAD FINANCIERA
                </div>
                <h1>
                  Una visión clara. <span>Mejores decisiones.</span>
                </h1>
                <p>Hola, Mariana. Así se ve el futuro de Distribuidora Luna.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setTechnical(true)}
              >
                <CircleHelp size={17} /> ¿Cómo lo calculamos?
              </button>
            </div>
            <div className="workspace">
              <FinancialOverview
                availableBalance={
                  (data.status === "ready" ? data.business.balance : 0) -
                  output.simulatedExpenseTotal
                }
                hasExpenses={expenses.length > 0}
                fragilityScore={shown.fragilityScore}
                survivalWeeks={shown.survivalWeeks}
                recommendedBuffer={shown.recommendedBuffer}
                contextMessage={
                  active || expenses.length > 0
                    ? `${shown.survivalWeeks} semanas de operación estimadas en este escenario simulado.`
                    : baseline.recommendation
                }
              />
              <TowerCard
                flowState={flow.state}
                status={output.status}
                expenseBlocks={output.removedExpenseBlocks}
                instantResult={flow.skipAnimation}
                progress={active ? flow.progress : 0}
                output={output}
                resetKey={flow.resetKey}
                reduced={reduced}
                onReset={reset}
              />
              <section className="decisions">
                <ExpensePanel
                  expenses={expenses}
                  onAdd={addExpense}
                  onUndo={undoExpense}
                  disabled={
                    flow.state === "simulating" || flow.state === "mitigating"
                  }
                />
                {expenses.length > 0 && (
                  <ExpenseFeedback
                    isCritical={output.minimumProjectedBalance < 0}
                    recommendation={output.recommendation}
                  />
                )}
                <div className="decision-heading">
                  <div>
                    <span className="eyebrow blue">
                      EXPLORA ANTES DE ACTUAR
                    </span>
                    <h2>Prueba una decisión</h2>
                  </div>
                  <span className="subtle">Sin afectar tu negocio real</span>
                </div>
                {flow.state === "simulating" || flow.state === "mitigating" ? (
                  <SimulationProgress
                    mitigating={flow.state === "mitigating"}
                    scenarioTitle={flow.scenario?.title}
                    isContract={flow.scenario?.id === "contract"}
                    phase={phase}
                    progress={flow.progress}
                    onSkip={() =>
                      dispatch({
                        type:
                          flow.state === "mitigating"
                            ? "FINISH_MITIGATION"
                            : "SHOW_RESULT",
                        skip: true,
                      })
                    }
                  />
                ) : flow.state === "result" || flow.state === "recovered" ? (
                  <SimulationResult
                    recovered={flow.state === "recovered"}
                    isContract={flow.scenario?.id === "contract"}
                    status={output.status}
                    minimumProjectedBalance={output.minimumProjectedBalance}
                    recommendedBuffer={output.recommendedBuffer}
                    recommendation={output.recommendation}
                    fragilityBefore={
                      flow.state === "recovered"
                        ? beforeMitigation.fragilityScore
                        : starting.fragilityScore
                    }
                    fragilityAfter={output.fragilityScore}
                    survivalBefore={
                      flow.state === "recovered"
                        ? beforeMitigation.survivalWeeks
                        : starting.survivalWeeks
                    }
                    survivalAfter={output.survivalWeeks}
                    criticalWeek={output.criticalWeek}
                    canMitigate={
                      flow.scenario?.id === "contract" &&
                      flow.state === "result"
                    }
                    onMitigate={() => dispatch({ type: "START_MITIGATION" })}
                    onReset={reset}
                  />
                ) : (
                  <ScenarioList
                    scenarios={scenarios}
                    onSelect={(s) =>
                      dispatch({ type: "SELECT_SCENARIO", scenario: s })
                    }
                  />
                )}
              </section>
            </div>
            <footer>
              <span>
                <ShieldCheck size={14} /> Un espacio seguro para explorar tus
                decisiones.
              </span>
              <span>Cada decisión cuenta. Cada gasto tiene un impacto.</span>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>
      {flow.state === "scenarioSelected" && flow.scenario && (
        <ScenarioDialog
          scenario={flow.scenario}
          onClose={() => dispatch({ type: "CLOSE_SCENARIO" })}
          onSimulate={simulate}
        />
      )}
      {technical && (
        <TechnicalExplanationDialog onClose={() => setTechnical(false)} />
      )}
    </div>
  );
}
