import { useEffect, useReducer, type Dispatch } from "react";
import {
  flowReducer,
  initialFlowState,
  type FlowEvent,
  type FlowState,
} from "./simulationFlow";
export function useSimulationFlow(
  reduced: boolean,
): [FlowState, Dispatch<FlowEvent>] {
  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  useEffect(() => {
    if (flow.state !== "simulating" && flow.state !== "mitigating") return;
    const wasMitigating = flow.state === "mitigating";
    const started = performance.now();
    const duration = reduced ? 100 : wasMitigating ? 1800 : 8000;
    const timer = setInterval(() => {
      const p = Math.min((performance.now() - started) / duration, 1);
      dispatch({ type: "TICK", progress: p });
      if (p === 1) {
        clearInterval(timer);
        dispatch({
          type: wasMitigating ? "FINISH_MITIGATION" : "SHOW_RESULT",
        });
      }
    }, 40);
    return () => clearInterval(timer);
  }, [flow.state, reduced]);
  useEffect(() => {
    if (
      window.innerWidth <= 700 &&
      (flow.state === "simulating" || flow.state === "mitigating")
    )
      document.querySelector(".tower-card")?.scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
  }, [flow.state, reduced]);
  return [flow, dispatch];
}
