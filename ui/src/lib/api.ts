/**
 * The console's reads, and the one place a payload becomes something a view can use.
 *
 * The command prints strings and only strings: a count it does not have is `-`, and the
 * agents listing prints `-` for two of the three counts it prints `0` for. Every view would
 * otherwise carry that vocabulary around, so it is spent here — once, at the edge — and
 * nothing past this file ever compares a cell to `"-"`.
 *
 * **The window's key is read here and nowhere else.** It travels in a header, so it never
 * reaches an address bar, an access log or a `Referer`.
 */

import { getToken } from "./token";

const TOKEN_HEADER = "X-Rundesk-Token";

/** How often the agents listing is worth asking for again. State and uptime move; nothing
 *  else the console shows does. */
export const AGENTS_EVERY_MS = 3000;

/** Everything that can stop a read, in the three shapes the views actually branch on. */
export type Trouble =
  | { kind: "session_ended"; said: string; fix: string | null }
  | { kind: "not_serving" }
  | { kind: "refused"; said: string; fix: string | null; exitCode: number | null; stderr: string | null };

export class ReadFailed extends Error {
  readonly trouble: Trouble;

  constructor(trouble: Trouble) {
    super(trouble.kind === "not_serving" ? "the console is not serving this page" : trouble.said);
    this.name = "ReadFailed";
    this.trouble = trouble;
  }
}

/**
 * Whatever was thrown, as the one shape the views branch on.
 *
 * Total on purpose: a fault in this file has to reach the owner as words, because a caller
 * that cannot name a failure ends up showing a blank page and saying nothing at all.
 */
export function troubleOf(thrown: unknown): Trouble {
  if (thrown instanceof ReadFailed) return thrown.trouble;
  return {
    kind: "refused",
    said: thrown instanceof Error ? thrown.message : String(thrown),
    fix: null,
    exitCode: null,
    stderr: null,
  };
}

// ------------------------------------------------------------------ what arrives on the wire

type Cells = Record<string, string>;

type Shown = {
  kind?: string;
  called?: string;
  about?: string;
  columns?: string[];
  rows?: Cells[];
};

type Envelope = { rundesk?: string; command?: string; shown?: Shown[] };

type Problem = { error?: string; said?: string; fix?: string | null; exit_code?: number; stderr?: string };

/** One cell, exactly as the terminal printed it. A column the command did not print reads
 *  as the same "not applicable" the command itself would have printed. */
function cell(cells: Cells, column: string): string {
  const printed = cells[column];
  return typeof printed === "string" && printed !== "" ? printed : "-";
}

/** A count the command printed as words. `-` and `0` are the same nothing — the agents
 *  listing prints both for the same idea — and anything unreadable is not invented into a
 *  number that would then be added up. */
function count(printed: string): number {
  if (printed === "-") return 0;
  const held = Number.parseInt(printed, 10);
  return Number.isFinite(held) ? held : 0;
}

/** A comma-joined list, or nothing at all. */
function listed(printed: string): string[] {
  if (printed === "-") return [];
  return printed.split(",").map((one) => one.trim()).filter(Boolean);
}

function tablesOf(envelope: Envelope, called: string): Shown[] {
  return (envelope.shown ?? []).filter((one) => one.called === called);
}

function rowsOf(shown: Shown | undefined): Cells[] {
  return shown?.rows ?? [];
}

// ------------------------------------------------------------------------------ the reads

async function troubleFromRefusal(answered: Response): Promise<Trouble> {
  const body: Problem | null = await answered.json().catch(() => null);
  const said = body?.said?.trim() || `the console refused this read (HTTP ${answered.status})`;
  const fix = body?.fix?.trim() || null;
  if (answered.status === 401) return { kind: "session_ended", said, fix };
  return {
    kind: "refused",
    said,
    fix,
    exitCode: typeof body?.exit_code === "number" ? body.exit_code : null,
    stderr: body?.stderr?.trim() || null,
  };
}

async function asked(path: string, signal: AbortSignal): Promise<Envelope> {
  let answered: Response;
  try {
    answered = await fetch(path, {
      signal,
      cache: "no-store",
      headers: { [TOKEN_HEADER]: getToken() ?? "" },
    });
  } catch (thrown) {
    // An aborted load belongs to a view that has already moved on; it is not a failure and
    // must not be dressed up as one.
    if (signal.aborted) throw thrown;
    // Nothing refused this — nothing answered at all, which means the command that was
    // serving this page is gone. That is a different thing to say than a server error.
    throw new ReadFailed({ kind: "not_serving" });
  }
  if (!answered.ok) throw new ReadFailed(await troubleFromRefusal(answered));
  const envelope: Envelope | null = await answered.json().catch(() => null);
  if (envelope === null) {
    throw new ReadFailed({
      kind: "refused",
      said: `${path} ended well and said nothing this page can read`,
      fix: null,
      exitCode: null,
      stderr: null,
    });
  }
  return envelope;
}

export type Agent = {
  name: string;
  state: string;
  pid: string;
  uptime: string;
  launchdJob: string;
  version: string;
  processes: number;
  turns: number;
  unfinished: number;
};

/** What one agent has in flight right now. */
export type Working = {
  agent: string;
  kind: string;
  source: string;
  conversation: string;
  pid: string;
  elapsed: string;
};

export type AgentsShown = { agents: Agent[]; working: Working[] };

/** Every agent this install has. An empty list is an answer, not a failure. */
export async function readAgents(signal: AbortSignal): Promise<AgentsShown> {
  const envelope = await asked("/api/agents", signal);
  const agents = rowsOf(tablesOf(envelope, "agents")[0]).map((row) => ({
    name: cell(row, "agent"),
    state: cell(row, "state"),
    pid: cell(row, "pid"),
    uptime: cell(row, "uptime"),
    launchdJob: cell(row, "launchd_job"),
    version: cell(row, "version"),
    processes: count(cell(row, "processes")),
    turns: count(cell(row, "turns")),
    unfinished: count(cell(row, "unfinished")),
  }));
  const working = tablesOf(envelope, "working").flatMap((shown) =>
    rowsOf(shown).map((row) => ({
      agent: shown.about ?? "",
      kind: cell(row, "kind"),
      source: cell(row, "source"),
      conversation: cell(row, "conversation"),
      pid: cell(row, "pid"),
      elapsed: cell(row, "elapsed"),
    })),
  );
  return { agents, working };
}

/** A turn that ended without finishing, and what the command knows about why. */
export type Unfinished = { unfinished: string; at: string; ended: string; why: string };

export type AgentShown = { paths: Record<string, string>; unfinished: Unfinished[] };

/**
 * One agent's homes on disk and its unfinished turns.
 *
 * This route says nothing about state, pid or version — those come from the agents listing
 * and are read from there, not guessed at from here.
 */
export async function readAgent(name: string, signal: AbortSignal): Promise<AgentShown> {
  const envelope = await asked(`/api/agents/${encodeURIComponent(name)}`, signal);
  const paths: Record<string, string> = {};
  for (const row of rowsOf(tablesOf(envelope, "paths")[0])) {
    paths[cell(row, "what")] = cell(row, "where");
  }
  const unfinished = rowsOf(tablesOf(envelope, "unfinished")[0]).map((row) => ({
    unfinished: cell(row, "unfinished"),
    at: cell(row, "at"),
    ended: cell(row, "ended"),
    why: cell(row, "why"),
  }));
  return { paths, unfinished };
}

/** A skill this install holds, and which agents have been granted it. */
export type Skill = { skill: string; from: string; agents: string[] };

export async function readSkills(signal: AbortSignal): Promise<Skill[]> {
  const envelope = await asked("/api/skills", signal);
  return rowsOf(tablesOf(envelope, "skills")[0]).map((row) => ({
    skill: cell(row, "skill"),
    from: cell(row, "from"),
    agents: listed(cell(row, "agents")),
  }));
}

/** A skill catalog installed on this machine, and where it came from. */
export type Catalog = { catalog: string; version: string; source: string };

/**
 * Where each installed catalog came from, by name.
 *
 * The skills listing says which catalog put a skill there and nothing more, so this is the
 * only thing that can turn that name into somewhere to go and look.
 */
export async function readCatalogs(signal: AbortSignal): Promise<Record<string, Catalog>> {
  const envelope = await asked("/api/skills/catalogs", signal);
  const byName: Record<string, Catalog> = {};
  for (const row of rowsOf(tablesOf(envelope, "catalogs")[0])) {
    const named = cell(row, "catalog");
    byName[named] = {
      catalog: named,
      version: cell(row, "version"),
      source: cell(row, "source"),
    };
  }
  return byName;
}

/** Where a skill came from, and whether that is somewhere a person can go and look. */
export type Provenance =
  | { kind: "rundesk" }
  | { kind: "catalog"; name: string; href: string | null }
  | { kind: "custom" };

/**
 * What a skill's `from` means, resolved against the catalogs this machine has.
 *
 * A catalog's source is whatever it was installed from, which is a web address only
 * sometimes — a directory or an archive is equally allowed. Anything that is not plainly
 * an `https` address gets no link rather than a broken one.
 */
export function provenanceOf(from: string, catalogs: Record<string, Catalog> | null): Provenance {
  if (from === "rundesk") return { kind: "rundesk" };
  if (from === "custom" || from === "-") return { kind: "custom" };
  const source = catalogs?.[from]?.source ?? "";
  const linkable = source.startsWith("https://");
  return { kind: "catalog", name: from, href: linkable ? source : null };
}
