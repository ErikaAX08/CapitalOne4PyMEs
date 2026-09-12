import { useState, type FormEvent } from "react";
import { ArrowDownRight, Plus, RotateCcw, Wallet } from "lucide-react";
import type { SimulatedExpense } from "@entities/simulation";
import { formatMoney } from "@shared";
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
    <section className="mb-6 rounded-[13px] border border-[#bfd4f0] bg-white p-[22px] shadow-[0_4px_20px_#264d7d05] max-[700px]:p-[18px]">
      <div className="flex items-center gap-[11px] max-[700px]:gap-[9px]">
        <span className="grid h-[37px] w-[37px] place-items-center rounded-[9px] bg-[#e5effd] text-[#4280d5]">
          <Wallet size={20} />
        </span>
        <div>
          <span className="block text-[9px] font-semibold tracking-[1.4px] text-[#467dd0] max-[700px]:text-[8px]">
            CADA GASTO CAMBIA TU BASE
          </span>
          <h2 className="mt-[5px] text-[17px] font-semibold tracking-[-0.5px] max-[700px]:text-[16px]">
            Agrega un gasto. Ve el impacto.
          </h2>
        </div>
        <span className="ml-auto rounded-[5px] border border-[#dbe6f3] bg-[#f5f9ff] p-[4px_6px] text-[10px] font-semibold text-[#4d7fba]">
          3D
        </span>
      </div>
      <p className="mt-[14px] mb-[18px] text-[12px] leading-[1.8] text-[#7889a0]">
        Registra una salida de efectivo y observa cómo se retiran bloques de la
        torre.
      </p>
      <form onSubmit={submit}>
        <div className="mb-[13px] grid grid-cols-2 gap-[13px] max-[700px]:gap-[10px]">
          <label className="block text-[12px] text-[#64788f] max-[700px]:text-[11px]">
            Tipo de gasto
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={disabled}
              className="mt-[7px] h-[46px] w-full rounded-lg border border-[#dbe4f0] bg-[#fbfcfe] px-[10px] text-[14px] text-[#314d70] focus-visible:outline-2 focus-visible:outline-[#6d9ce0] focus-visible:outline-offset-2"
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
          <label className="block text-[12px] text-[#64788f] max-[700px]:text-[11px]">
            Monto del gasto{" "}
            <span className="float-right text-[10px] text-[#8998ac]">
              MXN
            </span>
            <div className="mt-[7px] flex h-[46px] w-full items-center gap-2 rounded-lg border border-[#dbe4f0] bg-[#fbfcfe] px-3 text-[14px] text-[#314d70] focus-within:outline-2 focus-within:outline-[#6d9ce0] focus-within:outline-offset-2">
              <span className="text-[#8a9aae]">$</span>
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
                className="w-full min-w-0 border-0 bg-transparent text-[14px] text-[#314d70] outline-none"
              />
            </div>
          </label>
        </div>
        <button
          className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-[#296bd5] bg-[#296bd5] px-[18px] py-[14px] text-[13px] font-medium text-white shadow-[0_4px_9px_#296bd51a] hover:bg-[#205cbd] disabled:cursor-wait disabled:opacity-45 max-[700px]:min-h-[46px] max-[700px]:text-[12px]"
          type="submit"
          disabled={disabled}
        >
          <Plus size={18} /> Agregar gasto a la simulación
        </button>
      </form>
      <div className="my-[15px] flex flex-wrap gap-[6px]">
        <span className="mb-[3px] w-full text-[10px] text-[#8494a8]">
          Prueba rápido
        </span>
        {[
          ["Nómina", 72000],
          ["Inventario", 95000],
          ["Renta", 24000],
        ].map(([label, value]) => (
          <button
            key={label}
            disabled={disabled}
            onClick={() => onAdd(String(label), Number(value))}
            className="flex gap-[5px] rounded-md border border-[#e2e9f2] bg-[#f8fafd] p-2 text-[10px] text-[#667c98] disabled:cursor-wait disabled:opacity-45 max-[700px]:min-h-[40px]"
          >
            {label}{" "}
            <strong className="font-medium text-[#3f6b9c]">
              {formatMoney(Number(value))}
            </strong>
          </button>
        ))}
      </div>
      {expenses.length > 0 && (
        <div
          className="mt-[15px] border-t border-[#e7edf5] pt-[14px]"
          aria-live="polite"
        >
          <div className="flex justify-between text-[12px] text-[#75899f]">
            <span>
              Gastos agregados{" "}
              <small className="text-[11px]">({expenses.length})</small>
            </span>
            <strong className="text-[16px] font-semibold text-[#c07764]">
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
                  className="flex items-center gap-[7px] py-2 text-[12px] text-[#7b8da3]"
                >
                  <ArrowDownRight size={15} className="text-[#cf9281]" />
                  <span>{e.category}</span>
                  <strong className="ml-auto font-medium text-[#6c7f98]">
                    −{formatMoney(e.amount)}
                  </strong>
                </li>
              ))}
          </ol>
          <button
            className="inline-flex items-center gap-[7px] border-0 bg-transparent py-[10px] text-[11px] text-[#60758e]"
            onClick={onUndo}
            disabled={disabled}
          >
            <RotateCcw size={14} /> Deshacer último gasto
          </button>
        </div>
      )}
      <small className="block text-[10px] leading-[1.7] text-[#8595a9] max-[700px]:text-[11px]">
        Representación ilustrativa: a mayor gasto, más bloques de soporte se
        retiran. No modifica tus cuentas reales.
      </small>
    </section>
  );
}
