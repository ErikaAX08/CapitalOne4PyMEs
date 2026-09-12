import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTowerViewModel } from "./towerPresentation";
import type { SimulationOutput, TowerChange } from "@entities/simulation";

function output(overrides: Partial<SimulationOutput> = {}): SimulationOutput {
  return {
    removedExpenseBlocks: 0,
    simulatedExpenseTotal: 0,
    fragilityScore: 31,
    survivalWeeks: 14,
    recommendedBuffer: 24000,
    minimumProjectedBalance: 156000,
    criticalWeek: null,
    weeklyProjections: [],
    towerBlockChanges: [],
    recommendation: "",
    status: "Estable",
    ...overrides,
  };
}

const contractChanges: TowerChange[] = [
  ...[1, 2, 3, 4].map((week) => ({ week, action: "removeLiquidity" as const })),
  ...[9, 10, 11, 12].map((week) => ({ week, action: "addIncome" as const })),
  { week: 7, action: "delayIncome" },
];

test("computeTowerViewModel never touches WebGL/Canvas -- pure data in, data out", () => {
  const vm = computeTowerViewModel({
    state: "stable",
    progress: 0,
    output: output(),
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(vm.lost, 0);
  assert.equal(vm.collapsed, false);
  assert.equal(vm.staticFall, false);
  assert.equal(vm.risk, false);
  assert.equal(vm.blockColors.length, 36);
});

test("lost blocks: simulating ramps up scenario loss with progress, result applies it fully", () => {
  const stable = output({ towerBlockChanges: contractChanges });
  const half = computeTowerViewModel({
    state: "simulating",
    progress: 0.225, // half of the 0.45 ramp
    output: stable,
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    half.lost,
    2,
    "4 removeLiquidity blocks at half ramp -> floor(4*0.5)=2",
  );
  const full = computeTowerViewModel({
    state: "result",
    progress: 1,
    output: stable,
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(full.lost, 4);
  const idle = computeTowerViewModel({
    state: "scenarioSelected",
    progress: 0,
    output: stable,
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    idle.lost,
    0,
    "no scenario loss is applied before simulating starts",
  );
});

test("expense blocks and scenario loss combine but cap at 35", () => {
  const vm = computeTowerViewModel({
    state: "result",
    progress: 1,
    output: output({ towerBlockChanges: contractChanges }),
    expenseBlocks: 34,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    vm.lost,
    35,
    "34 expense blocks + 4 scenario blocks caps at 35, not 38",
  );
});

test("collapse from expenses alone does not require Crítico status", () => {
  const vm = computeTowerViewModel({
    state: "stable",
    progress: 0,
    output: output({ status: "Estable", minimumProjectedBalance: -1 }),
    expenseBlocks: 5,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    vm.collapsed,
    true,
    "negative minimum balance from expenses collapses the tower even in a nominally stable scenario",
  );
});

test("collapse from a scenario requires Crítico status and being at/near the result", () => {
  const critical = output({
    status: "Crítico",
    minimumProjectedBalance: -96000,
  });
  assert.equal(
    computeTowerViewModel({
      state: "simulating",
      progress: 0.5,
      output: critical,
      expenseBlocks: 0,
      reduced: false,
      instantResult: false,
    }).collapsed,
    false,
    "not collapsed mid-animation before the 0.78 threshold",
  );
  assert.equal(
    computeTowerViewModel({
      state: "simulating",
      progress: 0.8,
      output: critical,
      expenseBlocks: 0,
      reduced: false,
      instantResult: false,
    }).collapsed,
    true,
  );
  assert.equal(
    computeTowerViewModel({
      state: "result",
      progress: 1,
      output: critical,
      expenseBlocks: 0,
      reduced: false,
      instantResult: false,
    }).collapsed,
    true,
  );
});

test("staticFall only applies once collapsed, driven by reduced motion or an explicit skip", () => {
  const critical = output({ status: "Crítico", minimumProjectedBalance: -1 });
  const base = {
    state: "result" as const,
    progress: 1,
    output: critical,
    expenseBlocks: 0,
  };
  assert.equal(
    computeTowerViewModel({ ...base, reduced: false, instantResult: false })
      .staticFall,
    false,
  );
  assert.equal(
    computeTowerViewModel({ ...base, reduced: true, instantResult: false })
      .staticFall,
    true,
  );
  assert.equal(
    computeTowerViewModel({ ...base, reduced: false, instantResult: true })
      .staticFall,
    true,
  );
});

test("risk mirrors the 40-point fragility threshold used for status coloring", () => {
  assert.equal(
    computeTowerViewModel({
      state: "stable",
      progress: 0,
      output: output({ fragilityScore: 39 }),
      expenseBlocks: 0,
      reduced: false,
      instantResult: false,
    }).risk,
    false,
  );
  assert.equal(
    computeTowerViewModel({
      state: "stable",
      progress: 0,
      output: output({ fragilityScore: 40 }),
      expenseBlocks: 0,
      reduced: false,
      instantResult: false,
    }).risk,
    true,
  );
});

test("blockColors: delayed-income and added-income weeks are recolored only in their active window", () => {
  const vm = computeTowerViewModel({
    state: "simulating",
    progress: 0.6,
    output: output({ towerBlockChanges: contractChanges }),
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  // week = floor(index/3)+1; weeks 6-8 -> delayIncome color 4; weeks >=9 -> addIncome color 1
  const weekOf = (index: number) => Math.floor(index / 3) + 1;
  for (let index = 0; index < 36; index++) {
    const week = weekOf(index);
    if (week >= 6 && week <= 8) assert.equal(vm.blockColors[index], 4);
    else if (week >= 9) assert.equal(vm.blockColors[index], 1);
  }
});

test("blockColors: mitigating/recovered weeks 1-4 turn liquidity-colored (0) regardless of scenario changes", () => {
  const vm = computeTowerViewModel({
    state: "recovered",
    progress: 1,
    output: output({ towerBlockChanges: contractChanges }),
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  for (let index = 0; index < 12; index++)
    assert.equal(vm.blockColors[index], 0);
});

test("description reports collapsed vs the engine status, lost blocks and survival weeks", () => {
  const stableVm = computeTowerViewModel({
    state: "stable",
    progress: 0,
    output: output({ status: "Estable", survivalWeeks: 14 }),
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    stableVm.description,
    "Torre 3D: estable. 0 bloques retirados. 14 semanas de supervivencia.",
  );
  const collapsedVm = computeTowerViewModel({
    state: "result",
    progress: 1,
    output: output({
      status: "Crítico",
      survivalWeeks: 7,
      minimumProjectedBalance: -96000,
      towerBlockChanges: contractChanges,
    }),
    expenseBlocks: 0,
    reduced: false,
    instantResult: false,
  });
  assert.equal(
    collapsedVm.description,
    "Torre 3D: colapsada. 4 bloques retirados. 7 semanas de supervivencia.",
  );
});
