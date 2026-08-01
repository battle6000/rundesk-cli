import { useCallback } from "react";
import { ChevronLeft, Play } from "lucide-react";

import { Initials } from "@/components/Initials";
import { StateBadge } from "@/components/StateBadge";
import { TroubleStrip, TroubleView } from "@/components/Trouble";
import { WedgedNote } from "@/components/WedgedNote";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/useResource";
import {
  AGENTS_EVERY_MS,
  readAgent,
  readAgents,
  type Trouble,
  type Unfinished,
  type Working,
} from "@/lib/api";
import { subtitleOf } from "@/lib/format";
import { AGENTS_HREF, agentHref, type Tab } from "@/lib/route";
import { cn } from "@/lib/utils";
import { RulesTab } from "@/views/RulesTab";
import { SkillsTab } from "@/views/SkillsTab";
import { TasksTab } from "@/views/TasksTab";

const TABS: { tab: Tab; label: string }[] = [
  { tab: "rules", label: "Rules" },
  { tab: "skills", label: "Skills" },
  { tab: "tasks", label: "Tasks" },
];

const IN_FLIGHT = "grid grid-cols-[90px_1fr_150px_80px_80px] items-center gap-3 px-4";
const UNFINISHED = "grid grid-cols-[1fr_130px_110px_1fr] items-center gap-3 px-4";

function TabBar({ agent, current }: { agent: string; current: Tab }) {
  return (
    <nav className="mt-6 flex gap-6 border-b">
      {TABS.map(({ tab, label }) => (
        <a
          key={tab}
          href={agentHref(agent, tab)}
          aria-current={tab === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 pb-2.5 font-medium transition-colors",
            tab === current
              ? "border-rd-accent text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <div className="border-b px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function InFlight({ working }: { working: Working[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border bg-card">
      <Heading>In flight</Heading>
      <div className={cn(IN_FLIGHT, "border-b py-1.5 text-xs tracking-wide text-muted-foreground uppercase")}>
        <span>Kind</span>
        <span>Source</span>
        <span>Conversation</span>
        <span>PID</span>
        <span>Elapsed</span>
      </div>
      <ul>
        {working.map((one, at) => (
          <li key={`${one.pid}-${at}`} className={cn(IN_FLIGHT, "border-b py-2 last:border-b-0")}>
            <span className="truncate">{one.kind}</span>
            <span className="truncate text-muted-foreground">{one.source}</span>
            <span className="truncate font-mono text-[12px]">{one.conversation}</span>
            <span className="tnum font-mono text-[12px]">{one.pid}</span>
            <span className="tnum font-mono text-[12px]">{one.elapsed}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UnfinishedTurns({ unfinished }: { unfinished: Unfinished[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-lg border bg-card">
      <Heading>Unfinished</Heading>
      <div className={cn(UNFINISHED, "border-b py-1.5 text-xs tracking-wide text-muted-foreground uppercase")}>
        <span>Turn</span>
        <span>At</span>
        <span>Ended</span>
        <span>Why</span>
      </div>
      <ul>
        {unfinished.map((one, at) => (
          <li key={`${one.unfinished}-${at}`} className={cn(UNFINISHED, "border-b py-2 last:border-b-0")}>
            <span className="truncate font-mono text-[12px]">{one.unfinished}</span>
            <span className="tnum truncate font-mono text-[12px]">{one.at}</span>
            <span className="truncate">{one.ended}</span>
            <span className="truncate text-muted-foreground">{one.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One agent: who it is at the top, and what it holds underneath.
 *
 * Two reads, because the two halves live in two commands. State, uptime and version are only
 * ever printed by the agents listing, so they are read from there — the agent's own route
 * does not carry them, and inventing them from what it does carry would be a guess on screen.
 */
export function AgentDetail({ agent, tab, file }: { agent: string; tab: Tab; file: string | null }) {
  const shown = useResource(readAgents, AGENTS_EVERY_MS);
  const readThis = useCallback((signal: AbortSignal) => readAgent(agent, signal), [agent]);
  const held = useResource(readThis);

  const ended: Trouble | null =
    shown.trouble?.kind === "session_ended"
      ? shown.trouble
      : held.trouble?.kind === "session_ended"
        ? held.trouble
        : null;
  if (ended) return <TroubleView trouble={ended} onRetry={shown.reload} busy={shown.refreshing} />;

  const row = shown.data?.agents.find((one) => one.name === agent) ?? null;
  if (shown.data && !row) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="font-medium">This install has no agent called {agent}</p>
        <a href={AGENTS_HREF} className="mt-3 inline-block text-muted-foreground hover:text-foreground">
          Back to agents
        </a>
      </div>
    );
  }

  const working = shown.data?.working.filter((one) => one.agent === agent) ?? [];
  const unfinished = held.data?.unfinished ?? [];
  const trouble = shown.trouble ?? held.trouble;
  const busy = shown.refreshing || held.refreshing;
  const retry = () => {
    shown.reload();
    held.reload();
  };

  return (
    <>
      <a
        href={AGENTS_HREF}
        className="mb-4 inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Agents
      </a>

      {trouble ? <TroubleStrip trouble={trouble} onRetry={retry} busy={busy} /> : null}

      <header className="flex items-start gap-4">
        <Initials name={agent} large />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[19px] font-medium">{agent}</h1>
            {row ? <StateBadge state={row.state} /> : null}
          </div>
          {row ? (
            <p className="tnum mt-1 text-muted-foreground">{subtitleOf(row)}</p>
          ) : (
            <Skeleton className="mt-2 h-3 w-44" />
          )}
          {row?.state === "WEDGED" ? <WedgedNote name={agent} className="mt-2.5" /> : null}
        </div>
        <div className="flex w-[210px] shrink-0 flex-col items-end">
          <Button disabled>
            <Play />
            Run
          </Button>
          <p className="mt-2 text-right text-muted-foreground">
            This release shows your install; it does not change it.
          </p>
        </div>
      </header>

      {working.length > 0 ? <InFlight working={working} /> : null}
      {unfinished.length > 0 ? <UnfinishedTurns unfinished={unfinished} /> : null}

      <TabBar agent={agent} current={tab} />

      <div className="pt-5">
        {tab === "rules" ? (
          <RulesTab
            agent={agent}
            file={file}
            home={held.data?.paths["home"] ?? null}
            loading={held.loading}
          />
        ) : null}
        {tab === "skills" ? <SkillsTab agent={agent} /> : null}
        {tab === "tasks" ? <TasksTab /> : null}
      </div>
    </>
  );
}
