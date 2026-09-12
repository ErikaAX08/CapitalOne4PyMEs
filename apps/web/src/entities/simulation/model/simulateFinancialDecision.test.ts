import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateFinancialDecision } from "./simulateFinancialDecision";
import { business, transactions } from "@entities/business";
import { scenarios } from "@entities/scenario";
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
    ["advance25"],
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
    [78, 11, -40000, 11, 40000],
  );
  assert.deepEqual(
    [
      recovered.fragilityScore,
      recovered.survivalWeeks,
      recovered.recommendedBuffer,
      recovered.minimumProjectedBalance,
    ],
    [36, 14, 18000, 32000],
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

test("equipment and delay scenarios keep documented risk metrics", () => {
  const equipment = simulateFinancialDecision(
    business,
    transactions,
    scenarios[1],
  );
  const delay = simulateFinancialDecision(business, transactions, scenarios[2]);
  assert.equal(scenarios[1].id, "equipment");
  assert.deepEqual(
    [
      equipment.fragilityScore,
      equipment.survivalWeeks,
      equipment.recommendedBuffer,
      equipment.minimumProjectedBalance,
    ],
    [49, 10, 42000, 92000],
  );
  assert.equal(scenarios[2].id, "delay");
  assert.deepEqual(
    [
      delay.fragilityScore,
      delay.survivalWeeks,
      delay.recommendedBuffer,
      delay.minimumProjectedBalance,
    ],
    [64, 8, 72000, 4000],
  );
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

test("$191,000 in combined expenses matches the documented worked example", () => {
  const third = { id: "expense-3", category: "Renta", amount: 24000 };
  const combined = simulateFinancialDecision(
    business,
    transactions,
    null,
    [],
    [
      { id: "expense-1", category: "Nómina", amount: 72000 },
      { id: "expense-2", category: "Inventario", amount: 95000 },
      third,
    ],
  );
  assert.equal(combined.simulatedExpenseTotal, 191000);
  assert.equal(business.balance - combined.simulatedExpenseTotal, 89000);
  assert.deepEqual(
    [
      combined.removedExpenseBlocks,
      combined.fragilityScore,
      combined.survivalWeeks,
      combined.recommendedBuffer,
    ],
    [8, 95, 4, 52650],
  );
  assert.equal(combined.status, "Crítico");
});
