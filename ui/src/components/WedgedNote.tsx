import { Command } from "@/components/Command";
import { cn } from "@/lib/utils";

/**
 * What WEDGED means, next to the badge that says it.
 *
 * Wedged is a state a gateway is in, not a failure of this console — so it is said in the
 * row, in the muted tone, and never in a panel that looks like something went wrong here.
 */
export function WedgedNote({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      not round the loop lately
      <Command text={`rundesk restart ${name}`} />
    </span>
  );
}
