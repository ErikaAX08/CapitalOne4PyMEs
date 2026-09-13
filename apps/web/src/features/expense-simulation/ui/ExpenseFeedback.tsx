import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@shared";
export function ExpenseFeedback({
  isCritical,
  recommendation,
}: {
  isCritical: boolean;
  recommendation: string;
}) {
  return (
    <Alert variant={isCritical ? "destructive" : "info"} role="status">
      <TriangleAlert
        size={18}
        className={`mt-[2px] shrink-0 ${isCritical ? "text-danger" : "text-info"}`}
      />
      <AlertDescription className="text-[12px] leading-[1.8]">
        {recommendation}
      </AlertDescription>
    </Alert>
  );
}
