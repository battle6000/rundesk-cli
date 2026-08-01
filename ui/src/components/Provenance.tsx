import { Github, Package, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { Provenance } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Where a skill came from, said in one badge.
 *
 * Three sources and three marks, because "what put it there" is a different question from
 * "whose it is" and an owner acts on it differently: one arrives with a release, one is
 * somewhere they can go and read, and one is theirs.
 *
 * **Every badge is the same width**, so the column reads as a column: a catalog may be
 * named anything at all, and a row that sized itself to its name would put the control
 * beside it in a different place on every line. A name too long for it is cut rather than
 * allowed to push, and the whole name stays in the title for anyone who needs it.
 */
const WIDTH = "w-[150px] justify-start gap-1.5 text-xs font-normal";

function Mark({ said }: { said: Provenance }) {
  // `shrink-0`, or the icon is what gives way when the name is too long — leaving a row
  // that says where a skill came from with everything except the part that said it.
  const shared = "size-3 shrink-0";
  if (said.kind === "rundesk") return <Package className={shared} aria-hidden />;
  if (said.kind === "custom") return <PenLine className={shared} aria-hidden />;
  return <Github className={shared} aria-hidden />;
}

function named(said: Provenance): string {
  if (said.kind === "rundesk") return "rundesk";
  if (said.kind === "custom") return "custom";
  return said.name;
}

export function ProvenanceBadge({ said }: { said: Provenance }) {
  const label = named(said);
  const inside = (
    <>
      <Mark said={said} />
      <span className="truncate">{label}</span>
    </>
  );

  // **A link only when there is somewhere to go.** A catalog may have been installed from a
  // directory or an archive as easily as from a repository, and a badge that looked
  // clickable and went nowhere would be worse than one that never offered.
  const href = said.kind === "catalog" ? said.href : null;
  if (!href) {
    return (
      <Badge variant="outline" className={cn("shrink-0", WIDTH)} title={label}>
        {inside}
      </Badge>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      // `noreferrer` as well as `noopener`: the page being opened has no business being
      // told which address on this machine sent somebody to it.
      rel="noopener noreferrer"
      title={href}
      className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge
        variant="outline"
        className={cn(
          WIDTH,
          // **Only the name underlines.** The badge itself does not change: it says where
          // a skill came from whether or not there is anywhere to go, so lighting it up
          // would make the same fact look like two different ones. The mark stays clear of
          // the rule too — a line under an icon reads as a box that lost its bottom edge.
          "[&>span]:hover:underline [&>span]:hover:underline-offset-2",
        )}
      >
        {inside}
      </Badge>
    </a>
  );
}
