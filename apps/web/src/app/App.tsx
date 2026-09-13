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
  ChevronRight,
  CircleHelp,
  Gauge,
  Layers3,
  ScanSearch,
  ShieldCheck,
  Sparkles,
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
import { FinancialOverview } from "@features/financial-overview";
import { TechnicalExplanationDialog } from "@features/technical-explanation";
import { TowerCard } from "@features/resilience-tower";
import {
  ExpensePanel,
  ExpenseFeedback,
  useExpenses,
} from "@features/expense-simulation";
import { Badge, Button, cn } from "@shared";
import AnalysisPage from "./AnalysisPage";
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
    <img
      src="/capital-one-for-pymes.png"
      alt="Capital One For PyMES"
      width={738}
      height={136}
      className="h-auto w-[250px] object-contain max-[700px]:w-[175px]"
    />
  );
}
function DemoBadge() {
  return (
    <Badge
      variant="neutral"
      className="h-auto gap-[7px] px-[11px] py-[8px] text-[12px] max-[700px]:px-[8px] max-[700px]:py-[7px] max-[700px]:text-[11px]"
    >
      <span className="h-[5px] w-[5px] rounded-full bg-body-subtle" />
      <span className="max-[420px]:hidden">Demo con datos simulados</span>
      <span className="hidden max-[420px]:inline">Demo</span>
    </Badge>
  );
}
function AppHeader({
  showDashboardContext,
}: {
  showDashboardContext: boolean;
}) {
  return (
    <header
      className={cn(
        "flex h-[72px] items-center border-b border-hairline bg-canvas p-[0_max(5vw,24px)] max-[700px]:h-14 max-[700px]:p-[0_16px]",
        showDashboardContext ? "justify-between" : "justify-center",
      )}
    >
      <Logo />
      {showDashboardContext && (
        <div className="flex items-center gap-[13px]">
          <DemoBadge />
          <span className="mx-[9px] h-[27px] w-px bg-hairline max-[700px]:hidden" />
          <div className="grid size-9 place-items-center rounded-full border border-hairline bg-surface-subtle text-xs font-medium text-ink max-[700px]:hidden">
            ML
          </div>
          <span className="text-[12px] font-semibold max-[700px]:hidden">
            Mariana Luna
            <small className="mt-1 block text-[11px] font-normal text-body-subtle">
              Administradora
            </small>
          </span>
        </div>
      )}
    </header>
  );
}
export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === "/dashboard";
  const isAnalysis = location.pathname === "/analysis";
  const data = useBusinessData();
  const {
    expenses,
    add: addExpenseEntry,
    undo: undoExpense,
    reset: resetExpenses,
  } = useExpenses();
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
  // The structural-fragility view is fed by the engine through /v1/analysis; it
  // shares no state with the mock business data source, so it must not wait
  // behind that load. Every hook above has already run, so the order is stable.
  if (isAnalysis) {
    return (
      <div>
        <AppHeader showDashboardContext />
        <AnalysisPage />
      </div>
    );
  }
  if (data.status !== "ready") {
    return (
      <div>
        <AppHeader showDashboardContext={isDashboard} />
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
  function enterDashboard() {
    dispatch({ type: "ENTER_DASHBOARD" });
    navigate("/dashboard");
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
      <AppHeader showDashboardContext={isDashboard} />
      <Routes location={location}>
        <Route path="/" element={<IntroScreen onEnter={enterDashboard} />} />
        <Route
          path="/dashboard"
          element={
            <motion.main
              key="dashboard"
              className="dashboard mx-auto max-w-[1200px] p-[48px_24px_0] min-[701px]:max-[1000px]:p-[32px_24px_0] max-[700px]:p-[24px_16px_0]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="mb-[30px] flex items-center justify-between min-[1550px]:mb-[35px] max-[700px]:block max-[700px]:mb-[17px]">
                <div>
                  <div className="font-mono mb-3 flex items-center gap-2 text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
                    Mi negocio <ChevronRight size={12} /> Estabilidad financiera
                  </div>
                  <h1 className="font-title text-[2rem] leading-10 font-semibold tracking-[-0.04em] min-[701px]:max-[1000px]:text-[1.75rem] max-[700px]:text-2xl max-[700px]:leading-8">
                    Una visión clara.{" "}
                    <span className="font-subtitle font-semibold text-body-subtle min-[701px]:max-[1000px]:mt-1 min-[701px]:max-[1000px]:block max-[700px]:inline">
                      Mejores decisiones.
                    </span>
                  </h1>
                  <p className="mt-[9px] text-[13px] text-body-muted max-[700px]:text-[11px] max-[700px]:leading-[1.7]">
                    Hola, Mariana. Así se ve el futuro de Distribuidora Luna.
                  </p>
                </div>
                <div className="flex items-center gap-1 max-[700px]:mt-[6px]">
                  <Button
                    variant="ghost"
                    className="inline-flex items-center gap-[7px] py-[10px] text-[12px] no-underline hover:underline max-[700px]:pb-0 max-[700px]:text-[11px]"
                    onClick={() => navigate("/analysis")}
                  >
                    <Gauge size={17} /> Fragilidad estructural
                  </Button>
                  <Button
                    variant="ghost"
                    className="inline-flex items-center gap-[7px] py-[10px] text-[12px] no-underline hover:underline max-[700px]:pb-0 max-[700px]:text-[11px]"
                    onClick={() => setTechnical(true)}
                  >
                    <CircleHelp size={17} /> ¿Cómo lo calculamos?
                  </Button>
                </div>
              </div>
              <div className="mb-6 grid rounded-xl border border-hairline bg-canvas min-[701px]:grid-cols-3 max-[700px]:divide-y max-[700px]:divide-hairline min-[701px]:divide-x min-[701px]:divide-hairline">
                {[
                  {
                    icon: ScanSearch,
                    title: "1. Revisa tu base",
                    copy: "Saldo, fragilidad y obligaciones próximas.",
                  },
                  {
                    icon: Layers3,
                    title: "2. Lee la estructura",
                    copy: "La torre conecta liquidez, cobros y compromisos.",
                  },
                  {
                    icon: Sparkles,
                    title: "3. Prueba una decisión",
                    copy: "Compara el impacto antes de actuar.",
                  },
                ].map(({ icon: Icon, title, copy }, index) => (
                  <div
                    key={title}
                    className={cn(
                      "flex items-center gap-3 p-[13px_16px]",
                      index === 1 && "bg-brand-blue-soft/55",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-subtle text-brand-blue">
                      <Icon size={16} />
                    </span>
                    <span>
                      <strong className="block text-[12px] font-semibold text-body">
                        {title}
                      </strong>
                      <small className="mt-0.5 block text-[10px] leading-[1.45] text-body-muted">
                        {copy}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 min-[701px]:max-[1000px]:grid-cols-2 min-[701px]:max-[1000px]:gap-[18px] max-[700px]:grid-cols-1 max-[700px]:gap-[19px]">
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
                  simulationWeeks={simulationWeeks}
                  onReset={reset}
                />
                <section className="pt-[2px] pb-[10px] min-[701px]:col-start-1 min-[701px]:row-start-2 max-[700px]:pt-[5px]">
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
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <span className="font-mono text-xs font-medium tracking-normal text-body-muted uppercase max-[700px]:text-[11px]">
                        Explora antes de actuar
                      </span>
                      <h2 className="font-title mt-1 text-2xl font-semibold tracking-[-0.04em] max-[700px]:text-xl">
                        Prueba una decisión
                      </h2>
                    </div>
                    <span className="text-[11px] font-normal text-body-muted">
                      Sin afectar tu negocio real
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
                      simulationWeeks={simulationWeeks}
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
              <footer className="mt-3 flex justify-between border-t border-hairline p-[23px_0] text-[11px] text-body-muted max-[700px]:p-[18px_0] max-[700px]:leading-[1.7]">
                <span className="flex items-center gap-[6px]">
                  <ShieldCheck size={14} /> Un espacio seguro para explorar tus
                  decisiones.
                </span>
                <span className="flex items-center gap-[6px] max-[700px]:hidden">
                  Cada decisión cuenta. Cada gasto tiene un impacto.
                </span>
              </footer>
            </motion.main>
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
