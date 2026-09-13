import assert from "node:assert/strict";
import { test } from "node:test";
import { CancelledError, createAnalysisDataSource } from "./analysisDataSource";
import type { AnalysisRequest } from "../model/query";

const request: AnalysisRequest = {
  action: "accept_project",
  parameters: { advance_pct: 0, total_revenue_cents: 80000000 },
  stress: {
    collection_delay_days: 16,
    main_customer_lost: false,
    capital_injection_cents: 0,
  },
  run: { seed: 42, paths: 5000, horizon_days: 180 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const validDocument = {
  schema: "v1",
  state_id: "tension",
  tension: [],
  warnings: ["synthetic_assumptions"],
  notices: [
    { code: "synthetic_assumptions", label: "Escenario sintético en MXN" },
  ],
  explanation: "El cobro llega tarde.",
};

test("a successful response is reported as coming from the engine", async () => {
  const source = createAnalysisDataSource({
    fetchImpl: async () => jsonResponse(validDocument),
  });
  const result = await source.run(request);
  assert.equal(result.origin, "engine");
  assert.equal(result.document.state_id, "tension");
  assert.equal(result.reason, undefined);
});

test("every parameter travels in the query string", async () => {
  let seen = "";
  const source = createAnalysisDataSource({
    fetchImpl: async (url) => {
      seen = String(url);
      return jsonResponse(validDocument);
    },
  });
  await source.run(request);
  const query = new URLSearchParams(seen.split("?")[1]);
  assert.equal(query.get("action"), "accept_project");
  assert.equal(query.get("collection_delay_days"), "16");
  assert.equal(query.get("total_revenue_cents"), "80000000");
  // The seed is part of the cache key: without it the response would not be a
  // pure function of the parameters.
  assert.equal(query.get("seed"), "42");
});

test("the same parameterization always produces the same URL", async () => {
  const urls: string[] = [];
  const source = createAnalysisDataSource({
    fetchImpl: async (url) => {
      urls.push(String(url));
      return jsonResponse(validDocument);
    },
  });
  await source.run(request);
  await source.run({
    ...request,
    // Same values, different insertion order.
    parameters: { total_revenue_cents: 80000000, advance_pct: 0 },
  });
  assert.equal(urls[0], urls[1]);
});

test("a 5xx degrades to a precomputed state and says so", async () => {
  const source = createAnalysisDataSource({
    fetchImpl: async () => jsonResponse({ error: "EngineError" }, 502),
  });
  const result = await source.run(request);
  assert.equal(result.origin, "fallback");
  assert.equal(result.reason, "server_error");
  // The fallback does not invent: it is a real document from a real run.
  assert.equal(result.document.schema, "v1");
  assert.ok(
    result.document.survival || result.document.state_id === "abstention",
  );
});

test("the network being down degrades rather than throwing", async () => {
  const source = createAnalysisDataSource({
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    },
  });
  const result = await source.run(request);
  assert.equal(result.origin, "fallback");
  assert.equal(result.reason, "network");
});

test("a response over the three-second budget degrades as a timeout", async () => {
  const source = createAnalysisDataSource({
    timeoutMs: 10,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const result = await source.run(request);
  assert.equal(result.origin, "fallback");
  assert.equal(result.reason, "timeout");
});

test("an unknown schema version is a visible failure, not a silent zero", async () => {
  const source = createAnalysisDataSource({
    fetchImpl: async () => jsonResponse({ ...validDocument, schema: "v2" }),
  });
  const result = await source.run(request);
  assert.equal(result.origin, "fallback");
  assert.equal(result.reason, "unknown_schema");
});

test("a cancelled request is not a failure and does not degrade", async () => {
  const controller = new AbortController();
  const source = createAnalysisDataSource({
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const pending = source.run(request, controller.signal);
  controller.abort();
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof CancelledError,
  );
});
