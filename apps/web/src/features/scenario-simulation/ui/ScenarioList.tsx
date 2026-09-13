import {
  ArrowUpRight,
  ChevronRight,
  Clock3,
  TrendingUp,
  Truck,
} from "lucide-react";
import type { Scenario } from "@entities/scenario";
import { formatMoney, Badge } from "@shared";
const ICON_STYLES = [
  "bg-brand-blue-soft text-brand-blue",
  "bg-surface-muted text-body-muted",
  "bg-warning-soft text-warning",
];
export function ScenarioList({
  scenarios,
  onSelect,
}: {
  scenarios: Scenario[];
  onSelect: (scenario: Scenario) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-[12px] min-[701px]:gap-[10px]">
      {scenarios.map((s, i) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`min-h-[175px] rounded-xl border p-[17px_19px] text-left text-inherit shadow-geist-small transition-[background-color,border-color,box-shadow] min-[701px]:grid min-[701px]:min-h-0 min-[701px]:grid-cols-[42px_1fr_auto] min-[701px]:items-start min-[701px]:gap-x-3 min-[701px]:p-[15px_17px] ${
            i === 0
              ? "border-brand-blue bg-brand-blue-soft hover:border-brand-blue-hover"
              : "border-hairline bg-surface-subtle hover:border-hairline-strong hover:shadow-geist-floating"
          }`}
        >
          <div className="flex items-center gap-[10px] min-[701px]:col-start-1 min-[701px]:row-[1/4] min-[701px]:self-center">
            <span
              className={`grid h-[35px] w-[35px] place-items-center rounded-lg min-[701px]:h-[37px] min-[701px]:w-[37px] ${ICON_STYLES[i]}`}
            >
              {i === 0 ? (
                <TrendingUp size={21} />
              ) : i === 1 ? (
                <Truck size={21} />
              ) : (
                <Clock3 size={21} />
              )}
            </span>
            {i === 0 && (
              <Badge
                variant="brand"
                className="h-auto px-[7px] py-[4px] text-[12px] min-[701px]:hidden"
              >
                Pruébalo primero
              </Badge>
            )}
            <ArrowUpRight
              size={20}
              className="ml-auto text-body-subtle min-[701px]:hidden"
            />
          </div>
          <h3 className="mt-3 text-[14px] font-semibold min-[701px]:col-start-2 min-[701px]:m-0 min-[701px]:text-[13px]">
            {s.title}
          </h3>
          <p className="mt-[7px] text-[11px] text-body-muted min-[701px]:col-start-2 min-[701px]:mt-[6px]">
            {s.description}
          </p>
          <div className="mt-[15px] flex items-center justify-between border-t border-hairline pt-[13px] text-[11px] text-body-muted min-[701px]:col-start-3 min-[701px]:row-[1/3] min-[701px]:m-0 min-[701px]:flex-col min-[701px]:items-end min-[701px]:gap-[6px] min-[701px]:self-center min-[701px]:border-0 min-[701px]:p-0">
            <span>
              {i === 0
                ? "Inversión"
                : i === 1
                  ? "Pago inicial"
                  : "Cobro afectado"}
            </span>
            <strong className="flex items-center gap-[7px] text-[13px] font-medium text-body min-[701px]:text-[12px]">
              {formatMoney(s.amount)} <ChevronRight size={15} />
            </strong>
          </div>
        </button>
      ))}
    </div>
  );
}
