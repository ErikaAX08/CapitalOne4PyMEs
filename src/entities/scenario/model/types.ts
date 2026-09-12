export type ScenarioId = "contract" | "equipment" | "delay";
export interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  amount: number;
  details: [string, string][];
}
