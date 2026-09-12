import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateFinancialDecision } from "./mockFinancialEngine";
import { business } from "../data/business";
import { transactions } from "../data/transactions";
import { scenarios } from "../data/scenarios";
test("contract cash gap and advance mitigation remain deterministic", () => {
  const stable = simulateFinancialDecision(business, transactions, null);
  const contract = simulateFinancialDecision(
    business,
    transactions,
    scenarios[0],
  );
  const recovered = simulateFinancialDecision(
    business,
    transactions,
    scenarios[0],
    ["advance40"],
  );
  assert.deepEqual(
    [stable.fragilityScore, stable.survivalWeeks, stable.recommendedBuffer],
    [31, 14, 24000],
  );
  assert.deepEqual(
    [
      contract.fragilityScore,
      contract.survivalWeeks,
      contract.minimumProjectedBalance,
      contract.criticalWeek,
      contract.recommendedBuffer,
    ],
    [78, 7, -96000, 7, 96000],
  );
  assert.deepEqual(
    [
      recovered.fragilityScore,
      recovered.survivalWeeks,
      recovered.recommendedBuffer,
    ],
    [43, 12, 18000],
  );
  assert.ok(recovered.weeklyProjections.every((w) => w.balance > 0));
  assert.deepEqual(
    contract,
    simulateFinancialDecision(business, transactions, scenarios[0]),
  );
  assert.ok(transactions.length >= 30);
  for (const output of [
    stable,
    contract,
    recovered,
    ...scenarios
      .slice(1)
      .map((s) => simulateFinancialDecision(business, transactions, s)),
  ]) {
    assert.equal(output.weeklyProjections.length, 12);
    let previous = business.balance;
    for (const week of output.weeklyProjections) {
      assert.equal(previous + week.income - week.expenses, week.balance);
      previous = week.balance;
    }
  }
});

test("each additional expense removes support and undo restores the baseline", () => {
  const first = { id: "expense-1", category: "Nómina", amount: 72000 };
  const second = { id: "expense-2", category: "Inventario", amount: 95000 };
  const one = simulateFinancialDecision(
    business,
    transactions,
    null,
    [],
    [first],
  );
  const two = simulateFinancialDecision(
    business,
    transactions,
    null,
    [],
    [first, second],
  );
  assert.equal(one.simulatedExpenseTotal, 72000);
  assert.equal(one.removedExpenseBlocks, 3);
  assert.equal(two.simulatedExpenseTotal, 167000);
  assert.ok(two.removedExpenseBlocks > one.removedExpenseBlocks);
  assert.ok(two.minimumProjectedBalance < 0);
  assert.equal(two.status, "Crítico");
  assert.ok(two.fragilityScore > one.fragilityScore);
  let previous = business.balance;
  for (const week of two.weeklyProjections) {
    assert.equal(previous + week.income - week.expenses, week.balance);
    previous = week.balance;
  }
  assert.equal(
    simulateFinancialDecision(business, transactions, null, [], [])
      .fragilityScore,
    31,
  );
  assert.throws(() =>
    simulateFinancialDecision(
      business,
      transactions,
      null,
      [],
      [{ ...first, amount: -1 }],
    ),
  );
});
