import { Command } from "@/components/Command";
import { TroubleStrip, TroubleView } from "@/components/Trouble";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useResource } from "@/hooks/useResource";
import { readSkills } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Every skill this install holds, and whether this agent has been granted it.
 *
 * **A disabled switch must not dim what it is saying.** The switch cannot be moved here, so
 * the cursor and the thumb say so — but a granted skill faded until it reads as ungranted
 * would be this console printing something untrue about the install it is showing.
 */
const SWITCH =
  "disabled:opacity-100 data-[state=checked]:bg-rd-accent [&>[data-slot=switch-thumb]]:opacity-75";

export function SkillsTab({ agent }: { agent: string }) {
  const { data, trouble, loading, refreshing, reload } = useResource(readSkills);

  if (trouble?.kind === "session_ended") {
    return <TroubleView trouble={trouble} onRetry={reload} busy={refreshing} />;
  }
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((at) => (
          <Skeleton key={at} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (!data) {
    return trouble ? <TroubleView trouble={trouble} onRetry={reload} busy={refreshing} /> : null;
  }

  const granted = data.filter((skill) => skill.agents.includes(agent));

  return (
    <>
      {trouble ? <TroubleStrip trouble={trouble} onRetry={reload} busy={refreshing} /> : null}

      <p className="tnum mb-3 text-muted-foreground">
        {data.length} available · {granted.length} enabled
      </p>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-14 text-center text-muted-foreground">
          This install holds no skills.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border bg-card">
          {data.map((skill) => (
            <li
              key={skill.skill}
              className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
            >
              <span className="truncate font-mono text-[12.5px]">{skill.skill}</span>
              <Badge variant="outline" className="shrink-0 text-[10.5px] font-normal">
                {skill.from}
              </Badge>
              <Switch
                className={cn("ml-auto", SWITCH)}
                checked={skill.agents.includes(agent)}
                disabled
                aria-label={`${skill.skill} is ${skill.agents.includes(agent) ? "granted to" : "not granted to"} ${agent}`}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
        Grants are changed with
        <Command text={`rundesk skills ${agent} grant <skill>`} />
      </p>
    </>
  );
}
