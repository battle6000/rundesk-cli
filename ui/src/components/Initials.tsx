import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

/** An agent, before you have read its name. Two letters, always the same two for a name. */
export function Initials({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-medium text-secondary-foreground",
        large ? "size-14 text-[19px]" : "size-8 text-[11.5px]",
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
