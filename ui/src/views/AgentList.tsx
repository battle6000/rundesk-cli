import { Command } from "@/components/Command";
import { Initials } from "@/components/Initials";
import { Metric } from "@/components/Metric";
import { StateBadge } from "@/components/StateBadge";
import { TroubleStrip, TroubleView } from "@/components/Trouble";
import { WedgedNote } from "@/components/WedgedNote";
import { Skeleton } from "@/components/ui/skeleton";
import { useResource } from "@/hooks/useResource";
import { AGENTS_EVERY_MS, readAgents, type Agent } from "@/lib/api";
import { agentHref } from "@/lib/route";
import { cn } from "@/lib/utils";

/** Name on the left, every polled value in its own column, so rows read down as well as across. */
const ROW = "grid grid-cols-[1fr_repeat(7,minmax(0,84px))] items-center gap-3";

function AgentRow({ agent }: { agent: Agent }) {
  return (
    <a
      href={agentHref(agent.name)}
      className={cn(
        ROW,
        "rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-accent/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Initials name={agent.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{agent.name}</span>
            <StateBadge state={agent.state} />
          </div>
          {agent.state === "WEDGED" ? <WedgedNote name={agent.name} className="mt-1.5" /> : null}
        </div>
      </div>
      <Metric label="PID" value={agent.pid} dim={agent.pid === "-"} />
      <Metric label="Uptime" value={agent.uptime} dim={agent.uptime === "-"} />
      {/* Dimming says "nothing here", which is why only `-` earns it: NOT LOADED is a
          state this install is in, and fading it would read as the console not knowing. */}
      <Metric label="Launchd job" value={agent.launchdJob} dim={agent.launchdJob === "-"} />
      <Metric label="Version" value={agent.version} dim={agent.version === "-"} />
      <Metric label="Proc" value={String(agent.processes)} dim={agent.processes === 0} />
      <Metric label="Turns" value={String(agent.turns)} dim={agent.turns === 0} />
      <Metric label="Unfin" value={String(agent.unfinished)} dim={agent.unfinished === 0} />
    </a>
  );
}

/** No agents is an answer this install gave, not a fault. It is said the way the command
 *  says it, and offers nothing to press — this release writes nothing. */
function NoAgents() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">No agents yet</p>
      <p className="mt-2 text-muted-foreground">Add one, and it will be here.</p>
      <div className="mt-4 flex justify-center">
        <Command text="rundesk add <agent> --provider codex" copy />
      </div>
    </div>
  );
}

function Waiting() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((at) => (
        <div key={at} className={cn(ROW, "rounded-lg border bg-card px-4 py-3")}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map((column) => (
            <Skeleton key={column} className="h-3.5 w-12" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AgentList() {
  const { data, trouble, loading, refreshing, reload } = useResource(readAgents, AGENTS_EVERY_MS);

  if (trouble?.kind === "session_ended") {
    return <TroubleView trouble={trouble} onRetry={reload} busy={refreshing} />;
  }
  if (loading) return <Waiting />;
  if (!data) {
    return trouble ? <TroubleView trouble={trouble} onRetry={reload} busy={refreshing} /> : null;
  }

  return (
    <>
      {trouble ? <TroubleStrip trouble={trouble} onRetry={reload} busy={refreshing} /> : null}
      {data.agents.length === 0 ? (
        <NoAgents />
      ) : (
        <div className="flex flex-col gap-2">
          {data.agents.map((agent) => (
            <AgentRow key={agent.name} agent={agent} />
          ))}
        </div>
      )}
    </>
  );
}
