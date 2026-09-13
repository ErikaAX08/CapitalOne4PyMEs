import { Link } from "react-router-dom";
import { Clock3, RotateCcw } from "lucide-react";
import type { Scenario } from "@entities/scenario";
import type { SimulatedExpense } from "@entities/simulation";
import { Button, formatMoney } from "@shared";

export function SimulationHistory({
  scenario,
  expenses,
  onUndoExpense,
  onClearScenario,
}: {
  scenario: Scenario | null;
  expenses: SimulatedExpense[];
  onUndoExpense: () => void;
  onClearScenario: () => void;
}) {
  if (!scenario && expenses.length === 0) return null;
  return (
    <section className="rounded-xl border border-hairline bg-canvas p-4" aria-labelledby="history-title">
      <div className="flex items-center gap-2">
        <Clock3 size={15} className="text-brand-blue" />
        <h2 id="history-title" className="text-xs font-semibold text-ink">Historial de esta exploración</h2>
      </div>
      <ul className="mt-3 space-y-2 text-[11px] text-body-muted">
        {scenario && <li className="flex justify-between gap-3"><span>Decisión · {scenario.title}</span><Button variant="ghost" size="compact" onClick={onClearScenario}>Deshacer</Button></li>}
        {expenses.slice(-2).reverse().map((expense, index) => (
          <li key={expense.id} className="flex items-center justify-between gap-3 border-t border-hairline pt-2">
            <span>Gasto simulado · {expense.category} · {formatMoney(expense.amount)}</span>
            {index === 0 && <Button variant="ghost" size="compact" onClick={onUndoExpense}><RotateCcw size={12} /> Deshacer</Button>}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-hairline pt-3 text-[10px] leading-5 text-body-muted">
        Esta exploración no modifica tu libro. <Link className="font-semibold text-brand-blue" to="/movements">Ver movimientos reales</Link>
      </p>
    </section>
  );
}
