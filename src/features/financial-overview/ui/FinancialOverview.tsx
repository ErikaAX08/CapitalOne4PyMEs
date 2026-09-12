import { Building2, CircleHelp, Clock3, ShieldCheck } from "lucide-react";
import { formatMoney } from "../../../shared";
export function FinancialOverview({
  availableBalance,
  hasExpenses,
  fragilityScore,
  survivalWeeks,
  recommendedBuffer,
  contextMessage,
}: {
  availableBalance: number;
  hasExpenses: boolean;
  fragilityScore: number;
  survivalWeeks: number;
  recommendedBuffer: number;
  contextMessage: string;
}) {
  return (
    <section className="overview">
      <div className="section-heading">
        <span>
          <Building2 size={18} /> Distribuidora Luna
        </span>
        <span className="subtle">12 empleados</span>
      </div>
      <div className="balance">
        <span>Saldo disponible</span>
        <div>
          {formatMoney(availableBalance)} <small>MXN</small>
        </div>
        <span className="balance-note">
          <span />{" "}
          {hasExpenses
            ? "Saldo después de los gastos simulados"
            : "Operación actual · antes de la decisión"}
        </span>
      </div>
      <div className="metrics">
        <div className="metric fragility">
          <div className="metric-label">
            Índice de Fragilidad <CircleHelp size={14} />
          </div>
          <div className="score-row">
            <strong>
              {fragilityScore}
              <small>/100</small>
            </strong>
            <span
              className={`status ${fragilityScore >= 70 ? "danger" : fragilityScore >= 40 ? "warning" : "stable"}`}
            >
              <span />
              {fragilityScore >= 70
                ? "Crítico"
                : fragilityScore >= 40
                  ? "Precaución"
                  : "Estable"}
            </span>
          </div>
          <div className="gauge">
            <i style={{ left: `${fragilityScore}%` }} />
          </div>
          <div className="gauge-labels">
            <span>Menor fragilidad</span>
            <span>Mayor fragilidad</span>
          </div>
        </div>
        <div className="metric">
          <span className="metric-label">
            <Clock3 size={16} /> Supervivencia
          </span>
          <strong>
            {survivalWeeks} <small>semanas</small>
          </strong>
          <span className="metric-foot">Horizonte de operación</span>
        </div>
        <div className="metric">
          <span className="metric-label">
            <ShieldCheck size={16} /> Buffer recomendado
          </span>
          <strong className="buffer-value">
            {formatMoney(recommendedBuffer)}
          </strong>
          <span className="metric-foot">Capital de trabajo · MXN</span>
        </div>
      </div>
      <div className="context">
        <ShieldCheck size={18} />
        <p>{contextMessage}</p>
      </div>
      <div className="upcoming">
        <span>
          <span className="mini-icon coral">
            <Clock3 size={16} />
          </span>
          <span>
            Próximo pago crítico<strong>Nómina en 6 días</strong>
          </span>
        </span>
        <span className="upcoming-amount">$72,000</span>
      </div>
      <div className="concentration">
        <span>Concentración del principal cliente</span>
        <strong>42%</strong>
      </div>
    </section>
  );
}
