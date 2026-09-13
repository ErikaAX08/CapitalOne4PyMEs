import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CancelledError,
  createMovementsDataSource,
  RejectedError,
  UnreachableError,
  type Movement,
  type MovementDraft,
  type MovementsFailure,
  type MovementsOrigin,
} from "@entities/business";

/** A movement the user recorded that could not reach the database. It is kept
 *  so the work is not lost and retried on demand — never presented as stored. */
export interface PendingMovement {
  id: string;
  draft: MovementDraft;
  error: string;
}

export interface MovementsState {
  movements: Movement[];
  pending: PendingMovement[];
  origin: MovementsOrigin;
  reason?: MovementsFailure;
  loading: boolean;
  /** Set while an addition is in flight, so the form can disable itself. */
  saving: boolean;
  /** A rejection of the last addition: the draft is wrong or conflicts, and
   *  retrying it unchanged would fail again. */
  rejection?: string;
  add: (draft: MovementDraft) => Promise<boolean>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => void;
  refresh: () => void;
}

/** Drives the ledger view: reads /v1/movements, degrades to the bundled
 *  fixture when it cannot, and queues an addition the service could not take. */
export function useMovements(): MovementsState {
  const source = useMemo(() => createMovementsDataSource(), []);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [pending, setPending] = useState<PendingMovement[]>([]);
  const [origin, setOrigin] = useState<MovementsOrigin>("fallback");
  const [reason, setReason] = useState<MovementsFailure | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rejection, setRejection] = useState<string | undefined>();
  const [nonce, setNonce] = useState(0);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    source
      .list(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setMovements(result.movements);
        setOrigin(result.origin);
        setReason(result.reason);
        setLoading(false);
      })
      .catch((error: unknown) => {
        // A cancellation means a newer request is already running; leaving the
        // state untouched keeps the previous answer on screen until it lands.
        if (error instanceof CancelledError) return;
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [source, nonce]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const store = useCallback(
    async (draft: MovementDraft): Promise<Movement | UnreachableError> => {
      const stored = await source.add(draft);
      // The list is re-sorted on the stored movement's own date, so a new row
      // lands where the ledger says it belongs, not at the top.
      setMovements((current) =>
        [stored, ...current].sort((a, b) =>
          a.dueDate === b.dueDate
            ? b.id.localeCompare(a.id)
            : b.dueDate.localeCompare(a.dueDate),
        ),
      );
      // A successful write proves the database is reachable, so a list that had
      // degraded is no longer approximate.
      setOrigin("database");
      setReason(undefined);
      return stored;
    },
    [source],
  );

  const add = useCallback(
    async (draft: MovementDraft) => {
      setSaving(true);
      setRejection(undefined);
      try {
        await store(draft);
        return true;
      } catch (error) {
        if (error instanceof CancelledError) return false;
        if (error instanceof RejectedError) {
          // The server judged this movement. Queueing it would only fail again.
          setRejection(error.message);
          return false;
        }
        const message =
          error instanceof UnreachableError
            ? error.message
            : "No pudimos guardar el movimiento.";
        setPending((current) => [
          ...current,
          { id: crypto.randomUUID(), draft, error: message },
        ]);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [store],
  );

  const retry = useCallback(
    async (id: string) => {
      const entry = pending.find((p) => p.id === id);
      if (!entry) return;
      setSaving(true);
      try {
        await store(entry.draft);
        setPending((current) => current.filter((p) => p.id !== id));
      } catch (error) {
        const message =
          error instanceof RejectedError || error instanceof UnreachableError
            ? error.message
            : "No pudimos guardar el movimiento.";
        setPending((current) =>
          current.map((p) => (p.id === id ? { ...p, error: message } : p)),
        );
      } finally {
        setSaving(false);
      }
    },
    [pending, store],
  );

  const discard = useCallback((id: string) => {
    setPending((current) => current.filter((p) => p.id !== id));
  }, []);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return {
    movements,
    pending,
    origin,
    reason,
    loading,
    saving,
    rejection,
    add,
    retry,
    discard,
    refresh,
  };
}
