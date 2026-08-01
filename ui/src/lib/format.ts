/**
 * Turning what the console holds into what a view prints. Pure and total, so a name nobody
 * anticipated produces text rather than an exception inside a render.
 */

/** The two letters that stand for an agent in an avatar. */
export function initialsOf(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const first = words[0];
  if (!first) return "?";
  const second = words[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first.slice(0, 1)}${second.slice(0, 1)}`.toUpperCase();
}

/**
 * The line under an agent's name — built only from what the agents listing actually prints.
 * A value the command had nothing for is left out rather than shown as `-`, because a
 * subtitle reading "STOPPED · - · -" says less than "STOPPED" does.
 */
export function subtitleOf(shown: { state: string; uptime: string; version: string }): string {
  const parts = [
    shown.state,
    shown.uptime === "-" ? null : `up ${shown.uptime}`,
    shown.version === "-" ? null : shown.version,
  ];
  return parts.filter((part): part is string => part !== null).join(" · ");
}
