import { FALLBACK_STATES } from "./fallbackStates";
import { nearestFallback } from "../model/nearestFallback";
import { toQueryString, type AnalysisRequest } from "../model/query";
import { isStateDocument, type StateDocument } from "../model/types";

/** Where a rendered document came from. The interface must say which: a
 *  precomputed state presented as a live answer would be the one dishonest
 *  thing this product cannot afford. */
export type Origin = "engine" | "fallback";

export type FallbackReason =
  "timeout" | "network" | "server_error" | "unknown_schema";

export interface AnalysisResult {
  document: StateDocument;
  origin: Origin;
  /** Present only when `origin` is "fallback". */
  reason?: FallbackReason;
}

/** A request the caller cancelled. It is not a failure and must not degrade to
 *  a fallback: a newer request is already in flight. */
export class CancelledError extends Error {
  constructor() {
    super("analysis request cancelled");
    this.name = "CancelledError";
  }
}

export interface AnalysisDataSource {
  run(request: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisResult>;
}

/** PRD 5.5: a response that takes longer than three seconds is a failure, and
 *  the interface degrades rather than making the user wait. */
export const RESPONSE_BUDGET_MS = 3000;

interface Options {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Calls GET /v1/analysis and degrades to the nearest precomputed state when it
 *  cannot. It never throws for a transport failure -- degrading is the
 *  behaviour, not the error path -- but it does re-throw a cancellation. */
export function createAnalysisDataSource(
  options: Options = {},
): AnalysisDataSource {
  const baseUrl = options.baseUrl ?? "/v1/analysis";
  const timeoutMs = options.timeoutMs ?? RESPONSE_BUDGET_MS;
  const call = options.fetchImpl ?? globalThis.fetch.bind(globalThis);

  return {
    async run(request, signal) {
      const url = `${baseUrl}?${toQueryString(request)}`;
      const budget = new AbortController();
      const timer = setTimeout(() => budget.abort("timeout"), timeoutMs);
      const onAbort = () => budget.abort("cancelled");
      signal?.addEventListener("abort", onAbort, { once: true });

      try {
        const response = await call(url, {
          signal: budget.signal,
          headers: { accept: "application/json" },
        });
        if (!response.ok) return degrade(request, "server_error");
        const payload: unknown = await response.json();
        if (!isStateDocument(payload))
          return degrade(request, "unknown_schema");
        return { document: payload, origin: "engine" };
      } catch {
        if (signal?.aborted) throw new CancelledError();
        return degrade(
          request,
          budget.signal.reason === "timeout" ? "timeout" : "network",
        );
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}

function degrade(
  request: AnalysisRequest,
  reason: FallbackReason,
): AnalysisResult {
  const document = nearestFallback(FALLBACK_STATES, request);
  if (!document) {
    throw new Error("no fallback state is available");
  }
  return { document, origin: "fallback", reason };
}
