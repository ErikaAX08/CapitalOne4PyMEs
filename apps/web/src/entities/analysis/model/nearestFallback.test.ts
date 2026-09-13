import assert from "node:assert/strict";
import { test } from "node:test";
import { nearestFallback } from "./nearestFallback";
import type { AnalysisRequest } from "./query";
import type { Parameterization, StateDocument } from "./types";

/** The four parameterizations of PRD 5.4, as the fallback documents carry them. */
function state(id: string, parameterization: Parameterization): StateDocument {
  return { state_id: id, parameterization } as unknown as StateDocument;
}

const states = [
  state("stable", {
    action: "none",
    collection_delay_days: 0,
    main_customer_lost: false,
    capital_injection_cents: 0,
  }),
  state("tension", {
    action: "accept_project",
    collection_delay_days: 16,
    main_customer_lost: false,
    capital_injection_cents: 0,
    advance_pct: 0,
  }),
  state("crisis", {
    action: "accept_project",
    collection_delay_days: 16,
    main_customer_lost: true,
    capital_injection_cents: 0,
    advance_pct: 0,
  }),
  state("reinforced", {
    action: "accept_project",
    collection_delay_days: 16,
    main_customer_lost: false,
    capital_injection_cents: 0,
    advance_pct: 25,
  }),
];

function request(overrides: Partial<AnalysisRequest> = {}): AnalysisRequest {
  return {
    action: "accept_project",
    parameters: { advance_pct: 0 },
    stress: {
      collection_delay_days: 0,
      main_customer_lost: false,
      capital_injection_cents: 0,
    },
    run: { seed: 42, paths: 5000, horizon_days: 180 },
    ...overrides,
  };
}

test("the current operation falls back to the base state", () => {
  const chosen = nearestFallback(
    states,
    request({ action: "none", parameters: {} }),
  );
  assert.equal(chosen?.state_id, "stable");
});

test("crossing the breaking point falls back to tension", () => {
  const chosen = nearestFallback(
    states,
    request({
      stress: {
        collection_delay_days: 16,
        main_customer_lost: false,
        capital_injection_cents: 0,
      },
    }),
  );
  assert.equal(chosen?.state_id, "tension");
});

test("losing the main customer escalates the fallback to crisis", () => {
  const chosen = nearestFallback(
    states,
    request({
      stress: {
        collection_delay_days: 16,
        main_customer_lost: true,
        capital_injection_cents: 0,
      },
    }),
  );
  assert.equal(chosen?.state_id, "crisis");
});

test("reaching the minimum advance returns the fallback to reinforced", () => {
  const chosen = nearestFallback(
    states,
    request({
      parameters: { advance_pct: 25 },
      stress: {
        collection_delay_days: 16,
        main_customer_lost: false,
        capital_injection_cents: 0,
      },
    }),
  );
  assert.equal(chosen?.state_id, "reinforced");
});

test("a different decision never wins over a matching one", () => {
  // hire_staff has no precomputed state; the nearest must still be a document
  // whose action differs, and it must not silently pass as an accept_project.
  const chosen = nearestFallback(states, request({ action: "hire_staff" }));
  assert.ok(chosen, "no fallback was chosen");
  assert.notEqual(chosen?.parameterization?.action, "hire_staff");
});

test("a document without a parameterization is never chosen over one with it", () => {
  const abstention = {
    state_id: "abstention",
    parameterization: null,
  } as unknown as StateDocument;
  const chosen = nearestFallback(
    [abstention, ...states],
    request({ action: "none", parameters: {} }),
  );
  assert.equal(chosen?.state_id, "stable");
});
