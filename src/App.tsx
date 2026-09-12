import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Hand,
  Layers3,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { scenarios } from "./entities/scenario";
import type { Business, FinancialTransaction } from "./entities/business";
import { mockFinancialDataSource } from "./entities/business";
import type { SimulationOutput } from "./entities/simulation";
import { simulateFinancialDecision } from "./entities/simulation";
import { formatMoney, Modal } from "./shared";
import { useSimulationFlow } from "./features/scenario-simulation";
import { IntroScreen } from "./features/onboarding";
import { FinancialOverview } from "./features/financial-overview";
import { TechnicalExplanationDialog } from "./features/technical-explanation";
import { ResilienceTower } from "./components/ResilienceTower";
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
              <section className="tower-card">
                <div className="tower-heading">
                  <div>
                    <span className="eyebrow">TU NEGOCIO, EN PERSPECTIVA</span>
                    <h2>Torre de estabilidad · 3D</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Reiniciar simulación"
                    title="Reiniciar simulación"
                    onClick={reset}
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
                <div className="tower-status">
                  <span
                    className={`status ${output.status === "Crítico" ? "danger" : output.status === "Precaución" ? "warning" : "stable"}`}
                  >
                    <span />
                    {flow.state === "simulating"
                      ? "Simulando decisión"
                      : flow.state === "mitigating"
                        ? "Recuperando estabilidad"
                        : output.status === "Estable"
                          ? "Tu negocio tiene una base sólida"
                          : output.status === "Crítico"
                            ? "La liquidez necesita refuerzo"
                            : "Una estructura con más perspectiva"}
                  </span>
                </div>
                <div className="scene">
                  <ResilienceTower
                    expenseBlocks={output.removedExpenseBlocks}
                    instantResult={flow.skipAnimation}
                    state={flow.state}
                    progress={active ? flow.progress : 0}
                    output={output}
                    resetKey={flow.resetKey}
                    reduced={reduced}
                  />
                  <div className="week-marker top">
                    SEMANA 12<span>Ingresos futuros</span>
                  </div>
                  <div className="week-marker bottom">
                    SEMANA 1<span>Tu base de hoy</span>
                  </div>
                  <div className="scene-hint">
                    <Hand size={15} /> Cada gasto retira soporte · Toca un
                    bloque
                  </div>
                </div>
                <div className="legend">
                  {[
                    "Liquidez",
                    "Cobros",
                    "Gastos",
                    "Obligaciones",
                    "Inciertos",
                  ].map((label, i) => (
                    <span key={label}>
                      <i
                        style={{
                          background: [
                            "#4285dc",
                            "#54b69a",
                            "#b1bac7",
                            "#e88478",
                            "#e5bb54",
                          ][i],
                        }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
                <div className="tower-footer">
                  <Layers3 size={15} /> 12 niveles. 12 semanas. Una mirada al
                  futuro.
                </div>
              </section>
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
                  <div className="simulation" aria-live="polite">
                    <div className="simulation-title">
                      <Sparkles size={20} />
                      <strong>
                        {flow.state === "mitigating"
                          ? "Un anticipo cambia la historia"
                          : flow.scenario?.title}
                      </strong>
                      <button
                        className="text-button"
                        onClick={() =>
                          dispatch({
                            type:
                              flow.state === "mitigating"
                                ? "FINISH_MITIGATION"
                                : "SHOW_RESULT",
                            skip: true,
                          })
                        }
                      >
                        Ver resultado <ArrowRight size={15} />
                      </button>
                    </div>
                    <p>
                      {flow.state === "mitigating"
                        ? "El 40% de anticipo refuerza las primeras semanas."
                        : flow.scenario?.id === "contract"
                          ? phase
                          : flow.progress < 0.6
                            ? "Proyectamos cobros y obligaciones de las próximas semanas…"
                            : "Evaluamos el efecto sobre tu liquidez."}
                    </p>
                    <div className="progress-track">
                      <div style={{ width: `${flow.progress * 100}%` }} />
                    </div>
                    <div className="timeline">
                      <span>01 · Decisión</span>
                      <span>02 · Flujo de caja</span>
                      <span>03 · Estabilidad</span>
                    </div>
                  </div>
                ) : flow.state === "result" || flow.state === "recovered" ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`result ${flow.state === "recovered" && output.minimumProjectedBalance >= 0 ? "recovered" : ""}`}
                    aria-live="polite"
                  >
                    <div className="result-title">
                      {flow.state === "recovered" ? (
                        <ShieldCheck size={22} />
                      ) : (
                        <TriangleAlert size={22} />
                      )}
                      <h3>
                        {flow.state === "recovered"
                          ? output.minimumProjectedBalance < 0
                            ? "El anticipo aún no cubre tus gastos"
                            : "Una decisión más resiliente"
                          : flow.scenario?.id === "contract"
                            ? "Rentable no siempre significa sostenible"
                            : "Así cambia tu estabilidad"}
                      </h3>
                      <span
                        className={`status ${output.status === "Crítico" ? "danger" : "warning"}`}
                      >
                        {output.status}
                      </span>
                    </div>
                    <p>
                      {flow.state === "recovered"
                        ? output.recommendation
                        : flow.scenario?.id === "contract"
                          ? "El contrato es rentable, pero tu negocio podría quedarse sin efectivo antes de cobrarlo."
                          : output.recommendation}
                    </p>
                    <div className="result-metrics">
                      <span>
                        Fragilidad
                        <strong>
                          {flow.state === "recovered"
                            ? beforeMitigation.fragilityScore
                            : starting.fragilityScore}{" "}
                          → {output.fragilityScore}
                        </strong>
                      </span>
                      <span>
                        Supervivencia
                        <strong>
                          {flow.state === "recovered"
                            ? beforeMitigation.survivalWeeks
                            : starting.survivalWeeks}{" "}
                          → {output.survivalWeeks} semanas
                        </strong>
                      </span>
                      <span>
                        {flow.state === "recovered"
                          ? "Buffer restante"
                          : "Saldo mínimo proyectado"}
                        <strong>
                          {formatMoney(
                            flow.state === "recovered"
                              ? output.recommendedBuffer
                              : output.minimumProjectedBalance,
                          )}{" "}
                          MXN
                        </strong>
                      </span>
                      {output.criticalWeek && (
                        <span>
                          Semana crítica
                          <strong>Semana {output.criticalWeek}</strong>
                        </span>
                      )}
                    </div>
                    {flow.state !== "recovered" && (
                      <div className="recommendation">
                        <Sparkles size={19} />
                        <div>
                          <strong>Tu siguiente mejor paso</strong>
                          <p>{output.recommendation}</p>
                        </div>
                      </div>
                    )}
                    <div className="result-actions">
                      {flow.scenario?.id === "contract" &&
                        flow.state === "result" && (
                          <button
                            className="primary"
                            onClick={() =>
                              dispatch({ type: "START_MITIGATION" })
                            }
                          >
                            Aplicar anticipo del 40% <ArrowRight size={17} />
                          </button>
                        )}
                      <button className="secondary" onClick={reset}>
                        <RotateCcw size={16} /> Reiniciar simulación
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="scenario-grid">
                    {scenarios.map((s, i) => (
                      <button
                        className={`scenario-card ${i === 0 ? "featured" : ""}`}
                        key={s.id}
                        onClick={() =>
                          dispatch({ type: "SELECT_SCENARIO", scenario: s })
                        }
                      >
                        <div className="scenario-top">
                          <span className={`scenario-icon icon-${i}`}>
                            {i === 0 ? (
                              <TrendingUp size={21} />
                            ) : i === 1 ? (
                              <Truck size={21} />
                            ) : (
                              <Clock3 size={21} />
                            )}
                          </span>
                          {i === 0 && (
                            <span className="scenario-tag">
                              Pruébalo primero
                            </span>
                          )}
                          <ArrowUpRight size={18} />
                        </div>
                        <h3>{s.title}</h3>
                        <p>{s.description}</p>
                        <div className="scenario-bottom">
                          <span>
                            {i === 0
                              ? "Inversión"
                              : i === 1
                                ? "Pago inicial"
                                : "Cobro afectado"}
                          </span>
                          <strong>
                            {formatMoney(s.amount)} <ChevronRight size={15} />
                          </strong>
                        </div>
                      </button>
                    ))}
                  </div>
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
        <Modal
          title={flow.scenario.title}
          onClose={() => dispatch({ type: "CLOSE_SCENARIO" })}
        >
          <p>{flow.scenario.description}</p>
          <div className="sheet-business">
            <Building2 size={19} /> Distribuidora Luna <span>MXN</span>
          </div>
          <dl>
            {flow.scenario.details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {flow.scenario.id === "contract" && (
            <div className="sheet-note">
              <TriangleAlert size={20} />
              <p>
                El inventario y la nómina se pagan antes de cobrar. La
                simulación también probará un retraso de 30 días de tu cliente
                principal.
              </p>
            </div>
          )}
          <p className="fine-print">
            Cifras ilustrativas. El margen considera otros costos del contrato;
            la inversión inicial no equivale al costo total.
          </p>
          <button className="primary full" onClick={simulate}>
            Simular decisión <ArrowRight size={18} />
          </button>
          <span className="sheet-time">
            <Clock3 size={14} /> 8 segundos para ver una nueva perspectiva
          </span>
        </Modal>
      )}
      {technical && (
        <TechnicalExplanationDialog onClose={() => setTechnical(false)} />
      )}
    </div>
  );
}
