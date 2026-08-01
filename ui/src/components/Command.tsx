import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HELD_FOR_MS = 1600;

/**
 * Something to type into a terminal, shown the way the terminal would show it.
 *
 * `copy` earns its answer: "Copied" appears when the clipboard actually took it, never
 * because the button was pressed.
 */
export function Command({
  text,
  copy = false,
  className,
}: {
  text: string;
  copy?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const clearing = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(clearing.current), []);

  const take = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      window.clearTimeout(clearing.current);
      clearing.current = window.setTimeout(() => setCopied(false), HELD_FOR_MS);
    });
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 font-mono text-[12px] break-all",
        className,
      )}
    >
      {text}
      {copy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={take}
          aria-label={copied ? "copied" : "copy this command"}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      ) : null}
    </span>
  );
}
