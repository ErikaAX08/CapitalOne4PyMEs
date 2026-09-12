import { useState } from "react";
import type { SimulatedExpense } from "@entities/simulation";
export function useExpenses() {
  const [expenses, setExpenses] = useState<SimulatedExpense[]>([]);
  function add(category: string, amount: number) {
    setExpenses((current) => [
      ...current,
      { id: crypto.randomUUID(), category, amount },
    ]);
  }
  function undo() {
    setExpenses((current) => current.slice(0, -1));
  }
  function reset() {
    setExpenses([]);
  }
  return { expenses, add, undo, reset };
}
