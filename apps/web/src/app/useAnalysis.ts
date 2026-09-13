import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACTIONS,
  CancelledError,
  DEFAULT_ACTION,
  INITIAL_STATE,
  createAnalysisDataSource,
  defaultRun,
  defaultStress,
  defaultsFor,
  type ActionKind,
  type AnalysisRequest,
  type AnalysisResult,
  type ParameterValue,
  type ParameterValues,
} from "@entities/analysis";

/** PRD 3.2: the computation fires on control release, with 400 ms of debounce
 *  and cancellation of the previous request. */
const DEBOUNCE_MS = 400;

export interface AnalysisController {
  /** The company being analysed; empty means the service's default. */
  companyId: string;
  /** Profile variables supplied for this run, for the ones the database
   *  does not hold. */
  declared: Record<string, number>;
  setDeclared: (values: Record<string, number>) => void;
  action: ActionKind;
  parameters: ParameterValues;
  stress: ParameterValues;
  result: AnalysisResult;
  /** True while a request is in flight; the cards dim rather than disappear. */
  pending: boolean;
  setAction: (kind: ActionKind) => void;
  setParameter: (id: string, value: ParameterValue) => void;
  setStress: (id: string, value: ParameterValue) => void;
  run: () => void;
  reset: () => void;
}

function initialRequest(): AnalysisRequest {
  return {
    action: DEFAULT_ACTION,
    parameters: defaultsFor(DEFAULT_ACTION),
    stress: defaultStress(),
    run: defaultRun(),
  };
}

/** Wires the controls to GET /v1/analysis.
 *
 *  The interface opens on the precomputed base state so it renders without
 *  waiting for the network, then requests the real answer. Every later change
 *  debounces, cancels whatever was in flight, and degrades to the nearest
 *  precomputed state if the engine cannot answer within its budget. */
export function useAnalysis(companyId: string): AnalysisController {
  const source = useMemo(() => createAnalysisDataSource(), []);
  const [request, setRequest] = useState<AnalysisRequest>(initialRequest);
  const [result, setResult] = useState<AnalysisResult>({
    document: INITIAL_STATE,
    origin: "fallback",
  });
  const [pending, setPending] = useState(true);
  // Bumped to re-run the same parameterization on demand ("Ejecutar Simulación").
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setPending(true);
      source
        .run(request, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setResult(next);
            setPending(false);
          }
        })
        .catch((error: unknown) => {
          // A cancellation means a newer request is already running; leaving
          // `pending` true keeps the cards dimmed until that one answers.
          if (error instanceof CancelledError) return;
          // Anything else is a bug, not a transport failure: the data source
          // already degrades to a precomputed state for a timeout, a 5xx, a
          // dead network or an unknown schema. Re-throwing surfaces it instead
          // of leaving a stale document on screen as if it were current.
          setPending(false);
          throw error;
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [source, request, nonce]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const setAction = useCallback((kind: ActionKind) => {
    setRequest((current) =>
      current.action === kind
        ? current
        : // A decision's parameters belong to that decision; carrying the
          // previous one's values across would send ids the contract does not
          // declare for it.
          { ...current, action: kind, parameters: defaultsFor(kind) },
    );
  }, []);

  const setParameter = useCallback((id: string, value: ParameterValue) => {
    setRequest((current) => ({
      ...current,
      parameters: { ...current.parameters, [id]: value },
    }));
  }, []);

  const setStress = useCallback((id: string, value: ParameterValue) => {
    setRequest((current) => ({
      ...current,
      stress: { ...current.stress, [id]: value },
    }));
  }, []);

  // The selection lives in the shell, because the header owns it and more than
  // one view reads it. A declaration belongs to the company it was made for, so
  // changing company drops it: carrying one company's payroll onto another
  // would quietly analyse the second with the first one's numbers.
  useEffect(() => {
    setRequest((current) =>
      current.companyId === companyId
        ? current
        : { ...current, companyId, declared: {} },
    );
  }, [companyId]);

  const setDeclared = useCallback((values: Record<string, number>) => {
    setRequest((current) => ({ ...current, declared: values }));
  }, []);

  const run = useCallback(() => setNonce((value) => value + 1), []);
  const reset = useCallback(() => setRequest(initialRequest()), []);

  return {
    companyId: request.companyId ?? "",
    declared: request.declared ?? {},
    setDeclared,
    action: request.action,
    parameters: request.parameters,
    stress: request.stress,
    result,
    pending,
    setAction,
    setParameter,
    setStress,
    run,
    reset,
  };
}

/** The label of the decision currently selected, for the page heading. */
export function actionLabel(kind: ActionKind): string {
  return ACTIONS[kind]?.label ?? kind;
}
