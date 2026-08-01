/**
 * Where the console is pointed, read from the address and nothing else.
 *
 * Every function here is total: a hand-typed address is a place the console shows nothing,
 * never a thrown error that takes the page down with it. The console lives entirely in the
 * fragment, so the server never sees a route and never has to know one exists.
 */

export type Tab = "rules" | "skills" | "tasks";

export type Route =
  | { at: "agents" }
  | { at: "agent"; agent: string; tab: Tab; file: string | null }
  | { at: "nowhere" };

/** One address part as it was written. A half-typed escape is a name, not a crash. */
function decoded(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function tabOf(part: string): Tab | null {
  return part === "rules" || part === "skills" || part === "tasks" ? part : null;
}

export function routeOf(hash: string): Route {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean).map(decoded);
  const [first, agent, asked, file] = parts;
  if (first === undefined) return { at: "agents" };
  if (first !== "a" || !agent) return { at: "nowhere" };
  if (asked === undefined) return { at: "agent", agent, tab: "rules", file: null };
  const tab = tabOf(asked);
  if (tab === null) return { at: "nowhere" };
  if (file !== undefined && (tab !== "rules" || parts.length > 4)) return { at: "nowhere" };
  return { at: "agent", agent, tab, file: file ?? null };
}

export const AGENTS_HREF = "#/";

export function agentHref(agent: string, tab: Tab = "rules"): string {
  return `#/a/${encodeURIComponent(agent)}/${tab}`;
}

export function ruleHref(agent: string, file: string): string {
  return `${agentHref(agent, "rules")}/${encodeURIComponent(file)}`;
}
