import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * A gateway's state, in its own colour.
 *
 * A state this release has not met is shown in the neutral tone with its own word intact,
 * because printing a state the command did not say would be worse than printing it plainly.
 */
const TONES: Record<string, string> = {
  RUNNING: "bg-rd-running-soft text-rd-running",
  WEDGED: "bg-rd-wedged-soft text-rd-wedged",
  STOPPED: "bg-rd-stopped-soft text-rd-stopped",
};

export function StateBadge({ state, className }: { state: string; className?: string }) {
  return (
    <Badge
      variant="ghost"
      className={cn(
        "gap-1.5 px-2 text-[10.5px] tracking-wide",
        TONES[state] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {state}
    </Badge>
  );
}
