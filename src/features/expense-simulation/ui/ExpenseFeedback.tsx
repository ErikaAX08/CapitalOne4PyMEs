import { TriangleAlert } from "lucide-react";
export function ExpenseFeedback({
  isCritical,
  recommendation,
}: {
  isCritical: boolean;
  recommendation: string;
}) {
  return (
    <div
      className={`expense-feedback ${isCritical ? "expense-critical" : ""}`}
      role="status"
    >
      <TriangleAlert size={18} />
      <p>{recommendation}</p>
    </div>
  );
}
