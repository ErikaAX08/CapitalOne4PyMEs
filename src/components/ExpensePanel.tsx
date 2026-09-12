import { useState, type FormEvent } from "react";
import { ArrowDownRight, Plus, RotateCcw, Wallet } from "lucide-react";
import type { SimulatedExpense } from "../entities/simulation";
import { formatMoney } from "../shared";
export function ExpensePanel({
  expenses,
  onAdd,
  onUndo,
  disabled,
}: {
  expenses: SimulatedExpense[];
  onAdd: (category: string, amount: number) => void;
  onUndo: () => void;
  disabled: boolean;
}) {
  const [category, setCategory] = useState("Nómina");
  const [amount, setAmount] = useState("");
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 10000000) return;
    onAdd(category, value);
    setAmount("");
  }
  return (
    <section className="expense-panel">
      <div className="expense-heading">
        <span className="scenario-icon icon-0">
          <Wallet size={20} />
        </span>
        <div>
          <span className="eyebrow blue">CADA GASTO CAMBIA TU BASE</span>
          <h2>Agrega un gasto. Ve el impacto.</h2>
        </div>
        <span className="version-tag">3D</span>
      </div>
      <p>
        Registra una salida de efectivo y observa cómo se retiran bloques de la
        torre.
      </p>
      <form onSubmit={submit}>
        <div className="expense-fields">
          <label>
            Tipo de gasto
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={disabled}
            >
              {[
                "Nómina",
                "Inventario",
                "Renta",
                "Servicios",
                "Crédito",
                "Impuestos",
                "Transporte",
                "Mantenimiento",
                "Otro gasto",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Monto del gasto <span>MXN</span>
            <div className="amount-input">
              <span>$</span>
              <input
                aria-label="Monto del gasto"
                type="number"
                inputMode="decimal"
                min="1"
                max="10000000"
                step="1"
                placeholder="24,000"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={disabled}
              />
            </div>
          </label>
        </div>
        <button className="primary full" type="submit" disabled={disabled}>
          <Plus size={18} /> Agregar gasto a la simulación
        </button>
      </form>
      <div className="quick-expenses">
        <span>Prueba rápido</span>
        {[
          ["Nómina", 72000],
          ["Inventario", 95000],
          ["Renta", 24000],
        ].map(([label, value]) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => onAdd(String(label), Number(value))}
          >
            {label} <strong>{formatMoney(Number(value))}</strong>
          </button>
        ))}
      </div>
      {expenses.length > 0 && (
        <div className="expense-history" aria-live="polite">
          <div className="expense-total">
            <span>
              Gastos agregados <small>({expenses.length})</small>
            </span>
            <strong>−{formatMoney(total)}</strong>
          </div>
          <ol>
            {expenses
              .slice(-3)
              .reverse()
              .map((e) => (
                <li key={e.id}>
                  <ArrowDownRight size={15} />
                  <span>{e.category}</span>
                  <strong>−{formatMoney(e.amount)}</strong>
                </li>
              ))}
          </ol>
          <button className="text-button" onClick={onUndo} disabled={disabled}>
            <RotateCcw size={14} /> Deshacer último gasto
          </button>
        </div>
      )}
      <small className="expense-note">
        Representación ilustrativa: a mayor gasto, más bloques de soporte se
        retiran. No modifica tus cuentas reales.
      </small>
    </section>
  );
}
