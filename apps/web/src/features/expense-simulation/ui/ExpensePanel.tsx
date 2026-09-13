import { useState, type FormEvent } from "react";
import { ArrowDownRight, Plus, RotateCcw, Wallet } from "lucide-react";
import type { SimulatedExpense } from "@entities/simulation";
import {
  formatMoney,
  Card,
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared";

const EXPENSE_CATEGORIES = [
  "Nómina",
  "Inventario",
  "Renta",
  "Servicios",
  "Crédito",
  "Impuestos",
  "Transporte",
  "Mantenimiento",
  "Otro gasto",
];

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
    <Card className="gap-0 p-[22px] max-[700px]:p-[18px]">
      <div className="flex items-center gap-[11px] max-[700px]:gap-[9px]">
        <span className="grid h-[37px] w-[37px] place-items-center rounded-lg bg-surface-muted text-ink">
          <Wallet size={20} />
        </span>
        <div>
          <span className="font-mono block text-[11px] font-medium tracking-normal text-body-muted uppercase">
            Cada gasto cambia tu base
          </span>
          <h2 className="font-title mt-1 text-xl font-semibold tracking-[-0.02em] max-[700px]:text-lg">
            Agrega un gasto. Ve el impacto.
          </h2>
        </div>
        <Badge
          variant="brand"
          className="ml-auto h-auto px-[6px] py-[4px] text-[10px]"
        >
          3D
        </Badge>
      </div>
      <p className="mt-[14px] mb-[18px] text-[12px] leading-[1.8] text-body-muted">
        Registra una salida de efectivo y observa cómo se retiran bloques de la
        torre.
      </p>
      <form onSubmit={submit}>
        <div className="mb-[13px] grid grid-cols-2 gap-[13px] max-[700px]:gap-[10px]">
          <Label className="block text-[12px] font-normal text-body-muted max-[700px]:text-[11px]">
            Tipo de gasto
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={disabled}
            >
              <SelectTrigger className="mt-[7px] h-[46px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="block text-[12px] font-normal text-body-muted max-[700px]:text-[11px]">
            Monto del gasto{" "}
            <span className="float-right text-[10px] text-body-subtle">
              MXN
            </span>
            <div className="mt-[7px] flex h-[46px] w-full items-center gap-2 rounded-md border border-hairline bg-surface-subtle px-3 text-[14px] text-ink shadow-geist-small transition-colors hover:border-hairline-strong focus-within:border-brand-blue focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-1">
              <span className="text-body-subtle">$</span>
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
                className="w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none"
              />
            </div>
          </Label>
        </div>
        <Button
          variant="primary"
          type="submit"
          disabled={disabled}
          className="w-full gap-3 max-[700px]:min-h-[46px] max-[700px]:text-[12px]"
        >
          <Plus size={18} /> Simular gasto
        </Button>
      </form>
      <div className="my-[15px] flex flex-wrap gap-[6px]">
        <span className="mb-[3px] w-full text-[10px] text-body-subtle">
          Prueba rápido
        </span>
        {[
          ["Nómina", 72000],
          ["Inventario", 95000],
          ["Renta", 24000],
        ].map(([label, value]) => (
          <Button
            key={label}
            variant="tertiary"
            disabled={disabled}
            onClick={() => onAdd(String(label), Number(value))}
            className="h-auto gap-[5px] p-2 text-[10px] font-normal max-[700px]:min-h-[40px]"
          >
            {label}{" "}
            <strong className="font-medium text-brand-blue">
              {formatMoney(Number(value))}
            </strong>
          </Button>
        ))}
      </div>
      {expenses.length > 0 && (
        <div
          className="mt-[15px] border-t border-hairline pt-[14px]"
          aria-live="polite"
        >
          <div className="flex justify-between text-[12px] text-body-subtle">
            <span>
              Gastos agregados{" "}
              <small className="text-[11px]">({expenses.length})</small>
            </span>
            <strong className="text-[16px] font-semibold text-danger">
              −{formatMoney(total)}
            </strong>
          </div>
          <ol className="mt-[11px] list-none p-0">
            {expenses
              .slice(-3)
              .reverse()
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-[7px] py-2 text-[12px] text-body-muted"
                >
                  <ArrowDownRight size={15} className="text-danger" />
                  <span>{e.category}</span>
                  <strong className="ml-auto font-medium text-body">
                    −{formatMoney(e.amount)}
                  </strong>
                </li>
              ))}
          </ol>
          <Button
            variant="ghost"
            className="gap-[7px] py-[10px] text-[11px]"
            onClick={onUndo}
            disabled={disabled}
          >
            <RotateCcw size={14} /> Deshacer último gasto
          </Button>
        </div>
      )}
    </Card>
  );
}
