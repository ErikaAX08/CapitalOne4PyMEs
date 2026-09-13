import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  COMMON_NODES,
  nodeLabel,
  type MovementDraft,
} from "@entities/business";
import {
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared";

/** The category each direction opens on. Money coming in is a collection;
 *  money going out is most often payroll. Without this, choosing "Entrada"
 *  would leave the form proposing an incoming payroll, which is not a thing. */
const DEFAULT_NODE = { in: "collection", out: "payroll" } as const;

/** Records one movement in the company's ledger.
 *
 *  This is the real ledger, not the "¿qué pasa si?" panel of the dashboard: a
 *  movement entered here is stored in the database and is what the engine
 *  eventually reads. The copy says so, because the two are easy to confuse. */
export function MovementForm({
  cutoffDate,
  saving,
  rejection,
  onAdd,
}: {
  cutoffDate: string;
  saving: boolean;
  rejection?: string;
  onAdd: (draft: MovementDraft) => Promise<boolean>;
}) {
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [node, setNode] = useState<string>(DEFAULT_NODE.out);
  const [dueDate, setDueDate] = useState(cutoffDate);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [invalid, setInvalid] = useState<string | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pesos = Number(amount);
    if (!Number.isFinite(pesos) || pesos <= 0) {
      setInvalid("Escribe un monto mayor que cero.");
      return;
    }
    if (!dueDate) {
      setInvalid("Escribe la fecha del movimiento.");
      return;
    }
    setInvalid(undefined);
    const created = await onAdd({
      node,
      direction,
      dueDate,
      // Money crosses the boundary as an integer count of cents, never a float.
      amountCents: Math.round(pesos * 100),
      description: description.trim() || undefined,
    });
    if (created) {
      setAmount("");
      setDescription("");
    }
  }

  const problem = invalid ?? rejection;

  return (
    <Card className="gap-0 p-[22px] max-[700px]:p-[18px]">
      <div>
        <span className="font-mono block text-[11px] font-medium tracking-normal text-body-muted uppercase">
          Registra un movimiento
        </span>
        <h2 className="font-title mt-1 text-xl font-semibold tracking-[-0.02em] max-[700px]:text-lg">
          Una entrada o una salida
        </h2>
        <p className="mt-[10px] text-[12px] leading-[1.7] text-body-muted">
          Queda guardado en el libro de la empresa. Es distinto de los gastos
          simulados del panel, que solo exploran un escenario.
        </p>
      </div>

      <form onSubmit={submit} className="mt-[18px]">
        <div
          role="radiogroup"
          aria-label="Tipo de movimiento"
          className="mb-[14px] grid grid-cols-2 gap-2"
        >
          {(
            [
              ["out", "Salida", "Un pago o una obligación"],
              ["in", "Entrada", "Un cobro o un ingreso"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={direction === value}
              onClick={() => {
                setDirection(value);
                // Only move the category if the user has not chosen one that
                // differs from the outgoing default already.
                setNode((current) =>
                  current === DEFAULT_NODE.in || current === DEFAULT_NODE.out
                    ? DEFAULT_NODE[value]
                    : current,
                );
              }}
              disabled={saving}
              className={`rounded-lg border p-[11px_13px] text-left transition-colors ${
                direction === value
                  ? "border-brand-blue bg-brand-blue-soft"
                  : "border-hairline bg-surface-subtle hover:border-hairline-strong"
              }`}
            >
              <strong className="block text-[13px] font-semibold text-ink">
                {label}
              </strong>
              <small className="mt-0.5 block text-[10px] text-body-muted">
                {hint}
              </small>
            </button>
          ))}
        </div>

        <div className="mb-[13px] grid grid-cols-2 gap-[13px] max-[700px]:grid-cols-1 max-[700px]:gap-[10px]">
          <Label className="block text-[12px] font-normal text-body-muted">
            Categoría
            <Select value={node} onValueChange={setNode} disabled={saving}>
              <SelectTrigger className="mt-[7px] h-[46px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orderedNodes(direction).map((id) => (
                  <SelectItem key={id} value={id}>
                    {nodeLabel(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label className="block text-[12px] font-normal text-body-muted">
            Fecha del movimiento
            <input
              type="date"
              required
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={saving}
              className="mt-[7px] h-[46px] w-full rounded-md border border-hairline bg-surface-subtle px-3 text-[14px] text-ink shadow-geist-small transition-colors hover:border-hairline-strong focus-visible:border-brand-blue focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-1"
            />
          </Label>
        </div>

        <div className="mb-[13px] grid grid-cols-2 gap-[13px] max-[700px]:grid-cols-1 max-[700px]:gap-[10px]">
          <Label className="block text-[12px] font-normal text-body-muted">
            Monto{" "}
            <span className="float-right text-[10px] text-body-subtle">
              MXN
            </span>
            <div className="mt-[7px] flex h-[46px] w-full items-center gap-2 rounded-md border border-hairline bg-surface-subtle px-3 text-[14px] text-ink shadow-geist-small transition-colors hover:border-hairline-strong focus-within:border-brand-blue focus-within:outline-2 focus-within:outline-focus-ring focus-within:outline-offset-1">
              <span className="text-body-subtle">$</span>
              <input
                aria-label="Monto"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="72,000"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={saving}
                className="w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none"
              />
            </div>
          </Label>
          <Label className="block text-[12px] font-normal text-body-muted">
            Descripción <span className="text-[10px]">(opcional)</span>
            <input
              type="text"
              maxLength={120}
              placeholder="Nómina quincenal"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
              className="mt-[7px] h-[46px] w-full rounded-md border border-hairline bg-surface-subtle px-3 text-[14px] text-ink shadow-geist-small transition-colors hover:border-hairline-strong focus-visible:border-brand-blue focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-1"
            />
          </Label>
        </div>

        {problem && (
          <p
            role="alert"
            className="mb-[13px] border-l-4 border-danger bg-danger-soft p-[10px_12px] text-[11px] leading-[1.6] text-ink"
          >
            {problem}
          </p>
        )}

        <Button
          variant="primary"
          type="submit"
          disabled={saving}
          className="w-full gap-3 max-[700px]:min-h-[46px]"
        >
          <Plus size={18} />
          {saving ? "Guardando…" : "Guardar movimiento"}
        </Button>
      </form>
    </Card>
  );
}

/** The categories, with the ones that fit this direction first. `collection` is
 *  the only incoming node among the common ones; the rest are commitments. */
function orderedNodes(direction: "in" | "out"): readonly string[] {
  if (direction === "in") {
    return [
      "collection",
      ...COMMON_NODES.filter((node) => node !== "collection"),
    ];
  }
  return COMMON_NODES;
}
