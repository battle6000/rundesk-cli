import { cn } from "@/lib/utils";

/**
 * One polled value under its name.
 *
 * Tabular figures, because a row whose numbers change under a three-second refresh must not
 * move sideways while somebody is reading it.
 */
export function Metric({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn("tnum truncate font-mono text-[12px]", dim && "text-muted-foreground")}>
        {value}
      </div>
    </div>
  );
}
