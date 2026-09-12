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
      className={`-mt-[10px] mb-[23px] flex gap-[10px] rounded-[9px] border p-[13px] ${
        isCritical
          ? "border-[#f0d7cd] bg-[#fff3ef] text-[#b66d56]"
          : "border-[#dce8f4] bg-[#eff6fe] text-[#6382a8]"
      }`}
      role="status"
    >
      <TriangleAlert size={18} className="mt-[2px] shrink-0" />
      <p className="text-[12px] leading-[1.8]">{recommendation}</p>
    </div>
  );
}
