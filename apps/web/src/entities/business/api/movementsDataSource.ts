import type { Movement, MovementDraft } from "../model/types";
import { movementFixtures } from "../fixtures/movements";

/** Where a rendered ledger came from. The interface says which: a local fixture
 *  presented as the company's real ledger would be the one dishonest thing this
 *  product cannot afford — the same rule `/analysis` follows. */
export type MovementsOrigin = "database" | "fallback";

export type MovementsFailure = "timeout" | "network" | "unavailable";

export interface MovementsResult {
  movements: Movement[];
  origin: MovementsOrigin;
  /** Present only when `origin` is "fallback". */
  reason?: MovementsFailure;
}

/** An addition the server refused on its merits: an invalid draft (400) or a
 *  conflicting re-import (409). Retrying it unchanged would fail again, so it
 *  is never queued. */
export class RejectedError extends Error {
  readonly conflict: boolean;
  constructor(message: string, conflict: boolean) {
    super(message);
    this.name = "RejectedError";
    this.conflict = conflict;
  }
}

/** A request the caller cancelled. It is not a failure and must not degrade to
 *  the fixture: a newer request is already in flight, and letting a cancelled
 *  one resolve to a fallback would flag the ledger as approximate while the
 *  real answer is still on its way. Mirrors CancelledError in
 *  `entities/analysis`. */
export class CancelledError extends Error {
  constructor() {
    super("movements request cancelled");
    this.name = "CancelledError";
  }
}

/** An addition that could not reach the database. The movement is real and the
 *  user's intent stands, so it is queued rather than discarded. */
export class UnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableError";
  }
}

export interface MovementsDataSource {
  list(signal?: AbortSignal): Promise<MovementsResult>;
  add(draft: MovementDraft, signal?: AbortSignal): Promise<Movement>;
}

/** A read that takes longer than this is a failure and the list degrades,
 *  matching the budget `/analysis` works to (PRD 5.5). */
export const READ_BUDGET_MS = 3000;

/** A write gets longer: degrading is not an option for it, so the only thing a
 *  short budget would buy is a queued movement that had actually been stored. */
export const WRITE_BUDGET_MS = 8000;

interface Options {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface ListResponse {
  movements: Movement[];
}

/** Calls /v1/movements.
 *
 *  Reading degrades to the bundled fixture and says so. Writing never degrades:
 *  it either stores the movement or reports that it could not, because a ledger
 *  that silently forgets what it was told is worse than one that says it is
 *  unavailable. */
export function createMovementsDataSource(
  options: Options = {},
): MovementsDataSource {
  const baseUrl = options.baseUrl ?? "/v1/movements";
  const call = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  /** Runs `run` under a deadline, and reports which side ended it: the caller
   *  cancelling is not the same as the budget expiring, and only the second one
   *  is a reason to degrade. */
  async function withBudget<T>(
    ms: number,
    signal: AbortSignal | undefined,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const budget = new AbortController();
    const timer = setTimeout(() => budget.abort("timeout"), ms);
    const onAbort = () => budget.abort("cancelled");
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      return await run(budget.signal);
    } catch (error) {
      if (signal?.aborted) throw new CancelledError();
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return {
    async list(signal) {
      try {
        return await withBudget(READ_BUDGET_MS, signal, async (inner) => {
          const response = await call(baseUrl, { signal: inner });
          if (!response.ok) {
            return fallback("unavailable");
          }
          const body = (await response.json()) as ListResponse;
          if (!Array.isArray(body?.movements)) {
            return fallback("unavailable");
          }
          return { movements: body.movements, origin: "database" as const };
        });
      } catch (error) {
        // A cancellation belongs to the caller, not to the ledger's health.
        if (error instanceof CancelledError) throw error;
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        return fallback(aborted ? "timeout" : "network");
      }
    },

    async add(draft, signal) {
      let response: Response;
      try {
        response = await withBudget(WRITE_BUDGET_MS, signal, (inner) =>
          call(baseUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(draft),
            signal: inner,
          }),
        );
      } catch (error) {
        if (error instanceof CancelledError) throw error;
        throw new UnreachableError(
          "No pudimos guardar el movimiento: no hay conexión con el servicio.",
        );
      }
      if (response.status === 201) {
        return (await response.json()) as Movement;
      }
      // 400 and 409 are decisions about this movement; anything else is the
      // service failing, and the movement can be retried unchanged.
      if (response.status === 400 || response.status === 409) {
        const body = await response
          .json()
          .catch(() => ({ message: "El movimiento fue rechazado." }));
        throw new RejectedError(
          String(body?.message ?? "El movimiento fue rechazado."),
          response.status === 409,
        );
      }
      throw new UnreachableError(
        "No pudimos guardar el movimiento: el servicio no está disponible.",
      );
    },
  };
}

function fallback(reason: MovementsFailure): MovementsResult {
  return { movements: movementFixtures, origin: "fallback", reason };
}
