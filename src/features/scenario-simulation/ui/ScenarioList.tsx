import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { Scenario } from "../../../entities/scenario";
import { formatMoney } from "../../../shared";
export function ScenarioList({
  scenarios,
  onSelect,
}: {
  scenarios: Scenario[];
  onSelect: (scenario: Scenario) => void;
}) {
  return (
    <div className="scenario-grid">
      {scenarios.map((s, i) => (
        <button
          className={`scenario-card ${i === 0 ? "featured" : ""}`}
          key={s.id}
          onClick={() => onSelect(s)}
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
              <span className="scenario-tag">Pruébalo primero</span>
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
  );
}
