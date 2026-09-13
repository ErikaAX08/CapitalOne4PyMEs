import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CancelledError,
  createMovementsDataSource,
  RejectedError,
  UnreachableError,
} from "./movementsDataSource";
import { movementFixtures } from "../fixtures/movements";
import type { MovementDraft } from "../model/types";

const draft: MovementDraft = {
  node: "payroll",
  direction: "out",
  dueDate: "2026-09-18",
  amountCents: 7_200_000,
};

const stored = {
  ...draft,
  id: "01M2CEXD39RHN35DFD5CCBNA31",
  companyId: "co_demo_agency",
  settledCents: 0,
  status: "expected" as const,
  knownAt: "2026-09-12",
  source: "manual" as const,
  shift: "none" as const,
  scale: "none" as const,
  exposure: "none" as const,
  provenance: "known" as const,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

test("list returns what the database holds", async () => {
  const source = createMovementsDataSource({
    fetchImpl: async () => json({ movements: [stored] }),
  });
  const result = await source.list();
  assert.equal(result.origin, "database");
  assert.deepEqual(result.movements, [stored]);
  assert.equal(result.reason, undefined);
});

test("list degrades to the fixture and names the reason", async () => {
  for (const [label, fetchImpl, reason] of [
    [
      "a dead network",
      async () => {
        throw new TypeError("failed to fetch");
      },
      "network",
    ],
    ["a server error", async () => json({}, 503), "unavailable"],
    ["an unknown shape", async () => json({ rows: [] }), "unavailable"],
  ] as const) {
    const result = await createMovementsDataSource({ fetchImpl }).list();
    assert.equal(result.origin, "fallback", label);
    assert.equal(result.reason, reason, label);
    assert.deepEqual(result.movements, movementFixtures, label);
  }
});

test("list degrades when the read takes longer than its budget", async () => {
  const source = createMovementsDataSource({
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const result = await source.list();
  assert.equal(result.origin, "fallback");
  assert.equal(result.reason, "timeout");
});

test("add returns the movement as the database stored it", async () => {
  let sent: RequestInit | undefined;
  const source = createMovementsDataSource({
    fetchImpl: async (_input, init) => {
      sent = init;
      return json(stored, 201);
    },
  });
  const movement = await source.add(draft);
  assert.equal(movement.id, stored.id);
  assert.equal(sent?.method, "POST");
  assert.deepEqual(JSON.parse(String(sent?.body)), draft);
});

test("add reports a rejection rather than queueing it", async () => {
  for (const [status, conflict] of [
    [400, false],
    [409, true],
  ] as const) {
    const source = createMovementsDataSource({
      fetchImpl: async () => json({ message: "nope" }, status),
    });
    await assert.rejects(
      () => source.add(draft),
      (error: unknown) => {
        assert.ok(error instanceof RejectedError);
        assert.equal(error.conflict, conflict);
        assert.equal(error.message, "nope");
        return true;
      },
    );
  }
});

test("add reports an unreachable service, which is what may be retried", async () => {
  for (const fetchImpl of [
    async () => {
      throw new TypeError("failed to fetch");
    },
    async () => json({}, 503),
  ]) {
    await assert.rejects(
      () => createMovementsDataSource({ fetchImpl }).add(draft),
      (error: unknown) => error instanceof UnreachableError,
    );
  }
});

test("a write never degrades into a fabricated success", async () => {
  const source = createMovementsDataSource({
    fetchImpl: async () => json({}, 500),
  });
  await assert.rejects(() => source.add(draft));
});

test("a cancelled read is propagated, never degraded", async () => {
  // Degrading here would flag the ledger as approximate while the newer
  // request that replaced this one is still on its way.
  const source = createMovementsDataSource({
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const caller = new AbortController();
  const inFlight = source.list(caller.signal);
  caller.abort();
  await assert.rejects(
    () => inFlight,
    (error: unknown) => error instanceof CancelledError,
  );
});

test("a cancelled write is propagated, so it is not queued as unsent", async () => {
  const source = createMovementsDataSource({
    fetchImpl: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  const caller = new AbortController();
  const inFlight = source.add(draft, caller.signal);
  caller.abort();
  await assert.rejects(
    () => inFlight,
    (error: unknown) => error instanceof CancelledError,
  );
});
