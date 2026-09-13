import type { ActionKind } from "./types";
import type { ParameterValues } from "./actions";

/** Everything that identifies one run. It is the cache key: the response is a
 *  pure function of it, which is why it travels in the query string of a GET
 *  rather than in the body of a POST (docs/architecture.md decision 1). */
export interface AnalysisRequest {
  action: ActionKind;
  parameters: ParameterValues;
  stress: ParameterValues;
  run: ParameterValues;
}

/** Builds the query string of GET /v1/analysis. Every parameter id travels
 *  verbatim; ids the request omits take the schema default on the backend. */
export function toQueryString(request: AnalysisRequest): string {
  const query = new URLSearchParams();
  query.set("action", request.action);
  for (const values of [request.parameters, request.stress, request.run]) {
    for (const [id, value] of Object.entries(values)) {
      query.set(id, String(value));
    }
  }
  // Sorted so the same parameterization always produces the same URL, and
  // therefore the same cache entry, regardless of the order the interface
  // happened to build it in.
  query.sort();
  return query.toString();
}
