import type { Scenario } from "@entities/scenario";
export type SimulationFlowState =
  | "intro"
  | "stable"
  | "scenarioSelected"
  | "simulating"
  | "result"
  | "mitigating"
  | "recovered";
export interface FlowState {
  state: SimulationFlowState;
  scenario: Scenario | null;
  progress: number;
  resetKey: number;
  skipAnimation: boolean;
}
export type FlowEvent =
  | { type: "ENTER_DASHBOARD" }
  | { type: "SELECT_SCENARIO"; scenario: Scenario }
  | { type: "CLOSE_SCENARIO" }
  | { type: "START_SIMULATION" }
  | { type: "TICK"; progress: number }
  | { type: "SHOW_RESULT"; skip?: boolean }
  | { type: "START_MITIGATION" }
  | { type: "FINISH_MITIGATION"; skip?: boolean }
  | { type: "CLEAR_SKIP" }
  | { type: "RESET" };
export const initialFlowState: FlowState = {
  state: "intro",
  scenario: null,
  progress: 0,
  resetKey: 0,
  skipAnimation: false,
};
export function flowReducer(current: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "ENTER_DASHBOARD":
      return current.state === "intro"
        ? { ...current, state: "stable" }
        : current;
    case "SELECT_SCENARIO":
      return current.state === "stable"
        ? { ...current, state: "scenarioSelected", scenario: event.scenario }
        : current;
    case "CLOSE_SCENARIO":
      return current.state === "scenarioSelected"
        ? { ...current, state: "stable", scenario: null }
        : current;
    case "START_SIMULATION":
      return current.state === "scenarioSelected"
        ? {
            ...current,
            state: "simulating",
            progress: 0,
            skipAnimation: false,
            resetKey: current.resetKey + 1,
          }
        : current;
    case "TICK":
      return current.state === "simulating" || current.state === "mitigating"
        ? { ...current, progress: event.progress }
        : current;
    case "SHOW_RESULT":
      return current.state === "simulating"
        ? {
            ...current,
            state: "result",
            progress: 1,
            skipAnimation: !!event.skip,
          }
        : current;
    case "START_MITIGATION":
      return current.state === "result"
        ? {
            ...current,
            state: "mitigating",
            progress: 0,
            resetKey: current.resetKey + 1,
          }
        : current;
    case "FINISH_MITIGATION":
      return current.state === "mitigating"
        ? {
            ...current,
            state: "recovered",
            progress: 1,
            skipAnimation: !!event.skip,
          }
        : current;
    case "CLEAR_SKIP":
      // A new expense should always collapse the tower animated, even if a
      // previous scenario result was reached via the "Ver resultado" skip.
      return current.skipAnimation
        ? { ...current, skipAnimation: false }
        : current;
    case "RESET":
      return {
        state: "stable",
        scenario: null,
        progress: 0,
        resetKey: current.resetKey + 1,
        skipAnimation: false,
      };
    default:
      return current;
  }
}
