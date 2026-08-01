import { Command } from "@/components/Command";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ruleHref } from "@/lib/route";
import { cn } from "@/lib/utils";

/**
 * The pages an agent is run by, in the order an agent reads them.
 *
 * The order is the product's, not this file's opinion: what an agent is comes before what it
 * remembers, and the provider's own page comes last.
 */
const PAGES = ["AGENTS.md", "SOUL.md", "MEMORY.md", "CLAUDE.md"];

export function RulesTab({
  agent,
  file,
  home,
  loading,
}: {
  agent: string;
  file: string | null;
  home: string | null;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-[190px_1fr] gap-5">
      <nav className="flex flex-col gap-0.5">
        {PAGES.map((page) => (
          <a
            key={page}
            href={ruleHref(agent, page)}
            aria-current={page === file ? "page" : undefined}
            className={cn(
              "truncate rounded-md px-2.5 py-1.5 font-mono text-[12.5px] transition-colors",
              page === file
                ? "bg-rd-accent-soft text-rd-accent"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
            )}
          >
            {page}
          </a>
        ))}
      </nav>

      <section className="flex flex-col overflow-hidden rounded-lg border bg-card">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <span className="truncate font-mono text-[12.5px]">{file ?? "Rules"}</span>
          <div className="flex gap-2">
            {/* Both are here and both refuse: this release reads an install and writes
                nothing, and a button that looked ready would promise the opposite. */}
            <Button variant="outline" size="sm" disabled>
              Preview
            </Button>
            <Button size="sm" disabled>
              Save
            </Button>
          </div>
        </header>

        <div className="px-6 py-14 text-center">
          <p className="font-medium">Not shown here yet</p>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Reading page contents arrives in a later release. This release shows your install;
            it does not open the files inside it.
          </p>
        </div>

        <footer className="flex h-11 items-center gap-2 border-t px-4 text-muted-foreground">
          {/* Said only once it is known: a path that has not been read yet is not a path
              this agent does not have, and saying so before the read lands is a fault
              reported for a command that had not answered. */}
          {loading ? <Skeleton className="h-3 w-64" /> : null}
          {!loading && home ? (
            <>
              These live in
              <Command text={home} />
            </>
          ) : null}
          {!loading && !home ? "Where these live was not read." : null}
        </footer>
      </section>
    </div>
  );
}
