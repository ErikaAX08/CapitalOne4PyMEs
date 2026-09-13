import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Activity,
  Building2,
  ChartColumn,
  CircleHelp,
  Info,
  Layers3,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import { scenarios } from "@entities/scenario";
import type { Business, FinancialTransaction } from "@entities/business";
import { mockFinancialDataSource } from "@entities/business";
import type { SimulationOutput } from "@entities/simulation";
import { simulateFinancialDecision } from "@entities/simulation";
import {
  useSimulationFlow,
  ScenarioList,
  ScenarioDialog,
  SimulationProgress,
  SimulationResult,
} from "@features/scenario-simulation";
import { IntroScreen } from "@features/onboarding";
import { BusinessSignals } from "@features/financial-overview";
import {
  AssumptionsPanel,
  ScenarioComparator,
  SimulationHistory,
} from "@features/dashboard-guidance";
import { TechnicalExplanationDialog } from "@features/technical-explanation";
import { TowerCard } from "@features/resilience-tower";
import {
  ExpensePanel,
  ExpenseFeedback,
  useExpenses,
} from "@features/expense-simulation";
import { CompanySelect } from "@features/company-picker";
import { useMovements } from "@features/movements-ledger";
import { AppShell } from "@features/app-shell";
import type { ShellSection, ShellTool } from "@features/app-shell";
import { Logo } from "@shared";
import AnalysisPage from "./AnalysisPage";
import MovementsPage from "./MovementsPage";
import { useAnalysis } from "./useAnalysis";

/** The cut-off the domain service dates its runs from; it matches
 *  DOMAIN_CUTOFF_DATE and ENGINE_CUTOFF_DATE, so a movement entered here is
 *  dated the same way the engine reads it. */
const CUTOFF_DATE = "2026-09-12";
type BusinessDataState =
  | { status: "loading" }
  | {
      status: "ready";
      business: Business;
      transactions: FinancialTransaction[];
    }
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
/** The sections of the dashboard the shell's sidebar can scroll to. The
 *  identifiers are the ones the corresponding landmarks carry below. */
const DASHBOARD_SECTIONS: ShellSection[] = [
  { id: "decisiones", label: "Prueba una decisión", icon: Sparkles },
  { id: "estructura", label: "Estructura 3D", icon: Layers3 },
  { id: "gastos", label: "Gastos simulados", icon: Wallet },
];
/** The five PRD modules of the structural-fragility view, in reading order.
 *  The identifiers are the ones `AnalysisPage` puts on their wrappers. */
const ANALYSIS_SECTIONS: ShellSection[] = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "supervivencia", label: "Supervivencia", icon: Activity },
  { id: "simulador", label: "Simulador", icon: SlidersHorizontal },
  { id: "tension", label: "Tensión estructural", icon: ChartColumn },
  { id: "refuerzo", label: "Refuerzo mínimo", icon: Wrench },
  { id: "limitaciones", label: "Alcance y límites", icon: Info },
];
/** The ledger route. It owns the movements controller so the shell's sections
 *  and commands and the page's own controls drive one state. */
function MovementsView() {
  const movements = useMovements();
  const sections: ShellSection[] = [
    { id: "resumen-libro", label: "Resumen del libro", icon: ScanSearch },
    {
      id: "lista-movimientos",
      label: "Lista de movimientos",
      icon: ReceiptText,
    },
    { id: "registrar", label: "Registrar movimiento", icon: Plus },
  ];
  const tools: ShellTool[] = [
    {
      label: "Actualizar libro",
      icon: RotateCcw,
      onClick: movements.refresh,
      disabled: movements.loading,
    },
  ];
  return (
    <AppShell
      eyebrow="Movimientos"
      title={
        <>
          Todo lo que entra{" "}
          <span className="font-subtitle font-semibold text-body-subtle">
            y todo lo que sale.
          </span>
        </>
      }
      sections={sections}
      sectionsLabel="Libro"
      tools={tools}
    >
      <MovementsPage movements={movements} cutoffDate={CUTOFF_DATE} />
    </AppShell>
  );
}

/** The structural-fragility route. It owns the analysis controller so the
 *  shell's commands and the page's own controls drive the same state; keeping
 *  it in its own component means the engine loop only runs on this route. */
function AnalysisView({
  company,
  onCompanyChange,
}: {
  company: string;
  onCompanyChange: (companyId: string) => void;
}) {
  const analysis = useAnalysis(company);
  const tools: ShellTool[] = [
    {
      label: "Ejecutar simulación",
      icon: Play,
      onClick: analysis.run,
      disabled: analysis.pending,
    },
    {
      label: "Restablecer valores",
      icon: RotateCcw,
      onClick: analysis.reset,
      disabled: analysis.pending,
    },
  ];
  return (
    <AppShell
      eyebrow="Fragilidad estructural"
      title={
        <>
          Antes de decidir,{" "}
          <span className="font-subtitle font-semibold text-body-subtle">
            mira qué se debilita.
          </span>
        </>
      }
      sections={ANALYSIS_SECTIONS}
      sectionsLabel="Análisis"
      tools={tools}
      companySelector={
        <CompanySelect selected={company} onSelect={onCompanyChange} />
      }
    >
      <AnalysisPage analysis={analysis} />
    </AppShell>
  );
}
const DASHBOARD_TITLE = (
  <>
    Una visión clara.{" "}
    <span className="font-subtitle font-semibold text-body-subtle max-[1000px]:mt-1 max-[1000px]:block min-[701px]:max-[1000px]:inline">
      Mejores decisiones.
    </span>
  </>
);
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
/** The landing page sits outside the application shell: it has no navigation
 *  and no account context, only the centred wordmark. */
function LandingHeader() {
  return (
    <header className="flex h-[72px] items-center justify-center border-b border-hairline bg-canvas p-[0_max(5vw,24px)] max-[700px]:h-14 max-[700px]:p-[0_16px]">
      <Logo className="w-[250px] max-[700px]:w-[175px]" />
    </header>
  );
}
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === "/dashboard";
  const isAnalysis = location.pathname === "/analysis";
  const isMovements = location.pathname === "/movements";
  const data = useBusinessData();
  const {
    expenses,
    add: addExpenseEntry,
    undo: undoExpense,
    reset: resetExpenses,
  } = useExpenses();
  // Which company the shell is looking at. It lives here because the header
  // owns the control and more than one view reads the selection; an empty
  // string means "whatever the service serves by default", which the selector
  // resolves to a real id as soon as the catalogue answers.
  const [company, setCompany] = useState("");
  const [technical, setTechnical] = useState(false);
  const [simulationWeeks, setSimulationWeeks] = useState(12);
  const reduced = !!useReducedMotion();
  const [flow, dispatch] = useSimulationFlow(reduced, isDashboard);
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
            mitigated ? ["advance25"] : [],
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
  const reinforcedOutput = useMemo(
    () =>
      data.status === "ready"
        ? simulateFinancialDecision(
            data.business,
            data.transactions,
            flow.scenario,
            ["advance25"],
            expenses,
          )
        : EMPTY_OUTPUT,
    [data, flow.scenario, expenses],
  );
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
  function enterDashboard() {
    dispatch({ type: "ENTER_DASHBOARD" });
    navigate("/dashboard");
  }
  const tools: ShellTool[] = [
    {
      label: "¿Cómo lo calculamos?",
      icon: CircleHelp,
      onClick: () => setTechnical(true),
    },
    { label: "Reiniciar simulación", icon: RotateCcw, onClick: reset },
  ];
  // The structural-fragility view is fed by the engine through /v1/analysis; it
  // shares no state with the mock business data source, so it must not wait
  // behind that load. Every hook above has already run, so the order is stable.
  if (isAnalysis) {
    return <AnalysisView company={company} onCompanyChange={setCompany} />;
  }
  // The ledger has its own data path too: it reads the database, not the mock
  // business data source, so it must not wait behind that load either.
  if (isMovements) {
    return <MovementsView />;
  }
  if (data.status !== "ready") {
    const message =
      data.status === "loading"
        ? "Cargando datos del negocio…"
        : data.status === "empty"
          ? "No hay transacciones disponibles para simular."
          : "No pudimos cargar los datos del negocio. Intenta de nuevo.";
    return isDashboard ? (
      <AppShell
        eyebrow="Estabilidad financiera"
        title={DASHBOARD_TITLE}
        subtitle="Hola, Mariana. Así se ve el futuro de Distribuidora Luna."
      >
        <main role="status" aria-live="polite" className="p-[24px_32px]">
          {message}
        </main>
      </AppShell>
    ) : (
      <div>
        <LandingHeader />
        <main role="status" aria-live="polite" style={{ padding: "3rem" }}>
          {message}
        </main>
      </div>
    );
  }
  const shown =
    flow.state === "simulating"
      ? {
          ...output,
          fragilityScore: Math.round(
            starting.fragilityScore +
              (output.fragilityScore - starting.fragilityScore) * flow.progress,
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
      ? "El nuevo proyecto entra a la estructura"
      : flow.progress < 0.4
        ? "Los costos comienzan antes de recibir el pago"
        : flow.progress < 0.58
          ? "Cuentas por cobrar pierde alineación con la base"
          : flow.progress < 0.78
            ? "El cliente retrasa el pago 20 días"
            : "Día 75: faltan $40,000 para cubrir la nómina";
  return (
    <div>
      <Routes location={location}>
        <Route
          path="/"
          element={
            <div>
              <LandingHeader />
              <IntroScreen onEnter={enterDashboard} />
            </div>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AppShell
              eyebrow="Estabilidad financiera"
              title={DASHBOARD_TITLE}
              subtitle="Hola, Mariana. Así se ve el futuro de Distribuidora Luna."
              sections={DASHBOARD_SECTIONS}
              tools={tools}
            >
              <motion.main
                key="dashboard"
                className="dashboard flex flex-col gap-5 p-[0_32px_0] max-[1000px]:gap-[18px] max-[1000px]:p-[0_16px_0]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="grid gap-5 max-[700px]:gap-[19px] min-[701px]:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)] min-[701px]:gap-[18px] min-[1001px]:gap-5">
                  <section
                    id="decisiones"
                    aria-label="Prueba una decisión"
                    className="min-[701px]:col-start-2 min-[701px]:row-start-1"
                  >
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <span className="font-mono text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
                          Explora antes de actuar
                        </span>
                        <h2 className="font-title mt-1 text-2xl font-semibold tracking-[-0.04em] max-[700px]:text-xl">
                          {active ? "Resultado de tu decisión" : "Prueba una decisión"}
                        </h2>
                      </div>
                      <span className="text-[11px] font-normal text-body-muted">
                        Simulación
                      </span>
                    </div>
                    {flow.state === "simulating" ||
                    flow.state === "mitigating" ? (
                      <SimulationProgress
                        mitigating={flow.state === "mitigating"}
                        scenarioTitle={flow.scenario?.title}
                        isContract={flow.scenario?.id === "contract"}
                        phase={phase}
                        progress={flow.progress}
                        simulationWeeks={simulationWeeks}
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
                    ) : flow.state === "result" ||
                      flow.state === "recovered" ? (
                      <>
                        <SimulationResult
                          recovered={flow.state === "recovered"}
                          isContract={flow.scenario?.id === "contract"}
                          status={output.status}
                          minimumProjectedBalance={output.minimumProjectedBalance}
                          recommendedBuffer={output.recommendedBuffer}
                          recommendation={output.recommendation}
                          fragilityBefore={flow.state === "recovered" ? beforeMitigation.fragilityScore : starting.fragilityScore}
                          fragilityAfter={output.fragilityScore}
                          survivalBefore={flow.state === "recovered" ? beforeMitigation.survivalWeeks : starting.survivalWeeks}
                          survivalAfter={output.survivalWeeks}
                          criticalWeek={output.criticalWeek}
                          simulationWeeks={simulationWeeks}
                          canMitigate={flow.scenario?.id === "contract" && flow.state === "result"}
                          onMitigate={() => dispatch({ type: "START_MITIGATION" })}
                          onReset={reset}
                        />
                        <ScenarioComparator
                          current={starting}
                          decision={beforeMitigation}
                          reinforcement={reinforcedOutput}
                          reinforced={flow.state === "recovered"}
                        />
                      </>
                    ) : (
                      <ScenarioList scenarios={scenarios} onSelect={(scenario) => dispatch({ type: "SELECT_SCENARIO", scenario })} />
                    )}
                  </section>
                  <div
                    id="estructura"
                    className="min-[701px]:col-start-1 min-[701px]:row-[1/6]"
                  >
                    <TowerCard
                      flowState={flow.state}
                      status={output.status}
                      expenseBlocks={output.removedExpenseBlocks}
                      instantResult={flow.skipAnimation}
                      progress={active ? flow.progress : 0}
                      output={output}
                      resetKey={flow.resetKey}
                      reduced={reduced}
                      simulationWeeks={simulationWeeks}
                      onReset={reset}
                    />
                  </div>
                  <BusinessSignals
                    contextMessage={
                      active || expenses.length > 0
                        ? `${shown.survivalWeeks} semanas de operación estimadas en este escenario simulado.`
                        : baseline.recommendation
                    }
                  />
                  <section
                    id="gastos"
                    aria-label="Gastos simulados"
                    className="flex flex-col gap-4 min-[701px]:col-start-2"
                  >
                    <ExpensePanel
                      expenses={expenses}
                      onAdd={addExpense}
                      onUndo={undoExpense}
                      disabled={
                        flow.state === "simulating" ||
                        flow.state === "mitigating"
                      }
                    />
                    {expenses.length > 0 && (
                      <ExpenseFeedback
                        isCritical={output.minimumProjectedBalance < 0}
                        recommendation={output.recommendation}
                      />
                    )}
                  </section>
                  <SimulationHistory
                    scenario={active ? flow.scenario : null}
                    expenses={expenses}
                    onUndoExpense={undoExpense}
                    onClearScenario={() => dispatch({ type: "RESET" })}
                  />
                  <AssumptionsPanel simulationWeeks={simulationWeeks} />
                </div>
                <footer className="mt-3 flex justify-between border-t border-hairline p-[23px_0] text-[11px] text-body-muted max-[700px]:p-[18px_0] max-[700px]:leading-[1.7]">
                  <span className="flex items-center gap-[6px]">
                    <ShieldCheck size={14} /> Un espacio seguro para explorar
                    tus decisiones.
                  </span>
                  <span className="flex items-center gap-[6px] max-[700px]:hidden">
                    Cada decisión cuenta. Cada gasto tiene un impacto.
                  </span>
                </footer>
              </motion.main>
            </AppShell>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isDashboard && flow.state === "scenarioSelected" && flow.scenario && (
        <ScenarioDialog
          scenario={flow.scenario}
          simulationWeeks={simulationWeeks}
          onSimulationWeeksChange={setSimulationWeeks}
          onClose={() => dispatch({ type: "CLOSE_SCENARIO" })}
          onSimulate={simulate}
        />
      )}
      {isDashboard && technical && (
        <TechnicalExplanationDialog onClose={() => setTechnical(false)} />
      )}
    </div>
  );
}
