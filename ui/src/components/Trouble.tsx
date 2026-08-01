import { TriangleAlert } from "lucide-react";

import { Command } from "@/components/Command";
import { Button } from "@/components/ui/button";
import type { Trouble } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * What a read's failure looks like.
 *
 * **The command's own wording is printed as it was said.** Softening it, or putting a
 * friendlier sentence in front of it, leaves the owner searching for words that are not
 * there — the message they can act on is the one the command actually printed.
 */

function saidBy(trouble: Trouble): string {
  return trouble.kind === "not_serving"
    ? "Nothing answered on this address."
    : trouble.said;
}

/** The failure has the page, because there is nothing behind it to show. */
export function TroubleView({
  trouble,
  onRetry,
  busy = false,
}: {
  trouble: Trouble;
  onRetry: () => void;
  busy?: boolean;
}) {
  if (trouble.kind === "session_ended") {
    // No retry: this window's key is gone, and every attempt with it would be refused the
    // same way. What ends this is starting the console again, so that is all it offers.
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h2 className="text-[15px] font-medium">This window's session has ended</h2>
        <p className="mt-2 text-muted-foreground">{trouble.said}</p>
        <div className="mt-5 flex justify-center">
          <Command text={trouble.fix ?? "rundesk ui"} copy />
        </div>
      </div>
    );
  }

  if (trouble.kind === "not_serving") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h2 className="text-[15px] font-medium">Rundesk is no longer serving this page</h2>
        <p className="mt-2 text-muted-foreground">
          Nothing answered on this address. The console that opened this window may have been
          stopped.
        </p>
        <Button className="mt-5" variant="outline" size="sm" onClick={onRetry} disabled={busy}>
          Retry
        </Button>
      </div>
    );
  }

  return <TroublePanel trouble={trouble} onRetry={onRetry} busy={busy} className="mt-2" />;
}

/** A command that failed, said the way it said it. */
export function TroublePanel({
  trouble,
  onRetry,
  busy = false,
  className,
}: {
  trouble: Trouble;
  onRetry: () => void;
  busy?: boolean;
  className?: string;
}) {
  const fix = trouble.kind === "refused" ? trouble.fix : null;
  const stderr = trouble.kind === "refused" ? trouble.stderr : null;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-card p-4", className)}>
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-rd-wedged" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{saidBy(trouble)}</p>
        {fix ? <Command text={fix} className="mt-2.5" /> : null}
        {stderr ? (
          <details className="mt-2.5">
            <summary className="cursor-pointer text-muted-foreground">what it printed</summary>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-background p-3 font-mono text-[12px] whitespace-pre-wrap">
              {stderr}
            </pre>
          </details>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={busy}>
        Retry
      </Button>
    </div>
  );
}

/**
 * A refresh that failed behind data that is still good.
 *
 * A thin strip and nothing more: replacing a working view with a failure would take away
 * the last known state of an install at the exact moment somebody wanted to look at it.
 */
export function TroubleStrip({
  trouble,
  onRetry,
  busy = false,
}: {
  trouble: Trouble;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-md border border-dashed px-3 py-1.5">
      <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-rd-wedged" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">
        {saidBy(trouble)} — showing what was last read.
      </span>
      <Button variant="ghost" size="xs" onClick={onRetry} disabled={busy}>
        Retry
      </Button>
    </div>
  );
}
