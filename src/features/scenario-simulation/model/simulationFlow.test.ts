import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flowReducer,
  initialFlowState,
  type FlowState,
} from "./simulationFlow";
import { scenarios } from "@entities/scenario";

const contract = scenarios[0];

test("happy path: intro -> stable -> scenarioSelected -> simulating -> result -> mitigating -> recovered", () => {
  let flow: FlowState = initialFlowState;
  flow = flowReducer(flow, { type: "ENTER_DASHBOARD" });
  assert.equal(flow.state, "stable");
  flow = flowReducer(flow, { type: "SELECT_SCENARIO", scenario: contract });
  assert.equal(flow.state, "scenarioSelected");
  assert.equal(flow.scenario, contract);
  flow = flowReducer(flow, { type: "START_SIMULATION" });
  assert.equal(flow.state, "simulating");
  assert.equal(flow.progress, 0);
  assert.equal(flow.skipAnimation, false);
  const resetKeyAfterStart = flow.resetKey;
  flow = flowReducer(flow, { type: "TICK", progress: 0.5 });
  assert.equal(flow.progress, 0.5);
  assert.equal(flow.state, "simulating");
  flow = flowReducer(flow, { type: "SHOW_RESULT" });
  assert.equal(flow.state, "result");
  assert.equal(flow.progress, 1);
  assert.equal(flow.skipAnimation, false, "natural completion is not a skip");
  flow = flowReducer(flow, { type: "START_MITIGATION" });
  assert.equal(flow.state, "mitigating");
  assert.equal(flow.progress, 0);
  assert.ok(flow.resetKey > resetKeyAfterStart);
  flow = flowReducer(flow, { type: "TICK", progress: 1 });
  flow = flowReducer(flow, { type: "FINISH_MITIGATION" });
  assert.equal(flow.state, "recovered");
  assert.equal(flow.skipAnimation, false);
});

test("SHOW_RESULT and FINISH_MITIGATION mark skipAnimation only when explicitly skipped", () => {
  let flow: FlowState = {
    ...initialFlowState,
    state: "simulating",
    scenario: contract,
  };
  flow = flowReducer(flow, { type: "SHOW_RESULT", skip: true });
  assert.equal(flow.state, "result");
  assert.equal(flow.skipAnimation, true);
  flow = { ...flow, state: "mitigating" };
  flow = flowReducer(flow, { type: "FINISH_MITIGATION", skip: true });
  assert.equal(flow.state, "recovered");
  assert.equal(flow.skipAnimation, true);
});

test("CLEAR_SKIP only resets skipAnimation, nothing else", () => {
  const flow: FlowState = {
    state: "result",
    scenario: contract,
    progress: 1,
    resetKey: 3,
    skipAnimation: true,
  };
  const cleared = flowReducer(flow, { type: "CLEAR_SKIP" });
  assert.deepEqual(cleared, { ...flow, skipAnimation: false });
  assert.deepEqual(flowReducer(cleared, { type: "CLEAR_SKIP" }), cleared);
});

test("invalid transitions are ignored and return the same state", () => {
  assert.equal(
    flowReducer(initialFlowState, {
      type: "SELECT_SCENARIO",
      scenario: contract,
    }),
    initialFlowState,
    "cannot select a scenario before entering the dashboard",
  );
  const stable: FlowState = { ...initialFlowState, state: "stable" };
  assert.equal(
    flowReducer(stable, { type: "START_SIMULATION" }),
    stable,
    "cannot start simulating without a selected scenario",
  );
  assert.equal(
    flowReducer(stable, { type: "TICK", progress: 0.4 }),
    stable,
    "ticking outside simulating/mitigating has no effect",
  );
  const scenarioSelected: FlowState = {
    ...initialFlowState,
    state: "scenarioSelected",
    scenario: contract,
  };
  assert.equal(
    flowReducer(scenarioSelected, { type: "START_MITIGATION" }),
    scenarioSelected,
    "mitigation can only start from a result",
  );
  const result: FlowState = {
    ...initialFlowState,
    state: "result",
    scenario: contract,
  };
  assert.equal(
    flowReducer(result, { type: "FINISH_MITIGATION" }),
    result,
    "cannot finish a mitigation that never started",
  );
});

test("RESET always returns to stable with a fresh resetKey, regardless of current state", () => {
  const midFlow: FlowState = {
    state: "mitigating",
    scenario: contract,
    progress: 0.6,
    resetKey: 5,
    skipAnimation: true,
  };
  const reset = flowReducer(midFlow, { type: "RESET" });
  assert.deepEqual(reset, {
    state: "stable",
    scenario: null,
    progress: 0,
    resetKey: 6,
    skipAnimation: false,
  });
});
