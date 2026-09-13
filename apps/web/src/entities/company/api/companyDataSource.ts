import type { CompanyCatalog } from "../model/types";

/** A request the caller cancelled. It is not a failure: a newer one is already
 *  in flight, and treating it as an error would blank a list that is about to
 *  be replaced. */
export class CancelledError extends Error {
  constructor() {
    super("company catalog request cancelled");
    this.name = "CancelledError";
  }
}

export interface CatalogFilter {
  search?: string;
  outcome?: "all" | "bankrupt" | "survivor";
  limit?: number;
  offset?: number;
}

export interface CompanyDataSource {
  list(filter: CatalogFilter, signal?: AbortSignal): Promise<CompanyCatalog>;
}

/** A listing that takes longer than this is a failure. */
export const CATALOG_BUDGET_MS = 5000;

/** What to actually do when the catalogue cannot be read. The `/v1` proxy
 *  points at localhost:8080 by default (vite.config.ts), so a service started
 *  on another port looks exactly like no service at all. */
const START_HINT =
  "Inicia el servicio con: cd services/domain && go run ./cmd/analysis";

/** Calls GET /v1/companies.
 *
 *  Unlike the analysis, this one does not degrade to a bundled list: there is
 *  no honest fallback for "which companies exist", and offering a stale one
 *  would let someone pick a company the service cannot analyse. */
export function createCompanyDataSource(
  options: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): CompanyDataSource {
  const baseUrl = options.baseUrl ?? "/v1/companies";
  const call = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return {
    async list(filter, signal) {
      const query = new URLSearchParams();
      if (filter.search) query.set("q", filter.search);
      if (filter.outcome && filter.outcome !== "all") {
        query.set("outcome", filter.outcome);
      }
      query.set("limit", String(filter.limit ?? 50));
      if (filter.offset) query.set("offset", String(filter.offset));

      const budget = new AbortController();
      const timer = setTimeout(
        () => budget.abort("timeout"),
        CATALOG_BUDGET_MS,
      );
      const onAbort = () => budget.abort("cancelled");
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await call(`${baseUrl}?${query}`, {
          signal: budget.signal,
        });
        if (!response.ok) {
          // Say what to do about it. "No pudimos leerlo" is true and useless:
          // the usual cause is that the domain service simply is not running,
          // and nothing on screen hints at that.
          throw new Error(
            response.status === 503
              ? `El servicio no tiene base de datos disponible. ${START_HINT}`
              : `El servicio respondió ${response.status}. ${START_HINT}`,
          );
        }
        return (await response.json()) as CompanyCatalog;
      } catch (error) {
        if (signal?.aborted) throw new CancelledError();
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(
            `El catálogo tardó más de ${CATALOG_BUDGET_MS / 1000} s. ${START_HINT}`,
          );
        }
        if (error instanceof Error && error.message.startsWith("El ")) {
          throw error;
        }
        // A transport failure never reaches the service at all, which is what
        // happens when nothing is listening on the proxy's target.
        throw new Error(`No hay conexión con el servicio. ${START_HINT}`);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
