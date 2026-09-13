import { ChevronRight } from "lucide-react";
import { cn } from "@shared";
import type { PropagationPath as Path } from "@entities/analysis";

/** The right half of Module D: where the stress enters and where it breaks.
 *
 *  Five nodes and a CSS transition, not a three-dimensional structure. The
 *  highlight propagates left to right with a stagger, which is the highest
 *  impact narrative animation in the MVP at a fraction of the cost. */
export function PropagationPath({ path }: { path: Path }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {path.nodes.map((node, index) => {
        const isOrigin = node === path.origin_node;
        const isBreaking = node === path.breaking_node;
        return (
          <li key={node} className="flex items-center">
            <span
              className={cn(
                "rounded-lg border p-[7px_11px] text-[11px] font-medium transition-colors duration-[400ms] ease-out motion-safe:animate-in motion-safe:fade-in",
                isBreaking
                  ? "border-danger/25 bg-danger-soft text-danger"
                  : isOrigin
                    ? "border-tension/25 bg-tension-soft text-warning"
                    : "border-hairline bg-surface-subtle text-body-muted",
              )}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              {path.node_labels[node] ?? node}
              {isOrigin && (
                <span className="mt-0.5 block text-[9px] font-normal opacity-80">
                  origen
                </span>
              )}
              {isBreaking && (
                <span className="mt-0.5 block text-[9px] font-normal opacity-80">
                  se rompe
                </span>
              )}
            </span>
            {index < path.nodes.length - 1 && (
              <ChevronRight
                size={13}
                aria-hidden="true"
                className="mx-1 shrink-0 text-body-subtle"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
