import { useMemo, useSyncExternalStore } from "react";

import { routeOf, type Route } from "@/lib/route";

function subscribe(changed: () => void): () => void {
  window.addEventListener("hashchange", changed);
  return () => window.removeEventListener("hashchange", changed);
}

function hash(): string {
  return window.location.hash;
}

/**
 * Where the console is pointed, kept in step with the address bar.
 *
 * The address is the state: every link is a real `href`, so back, forward, reload and
 * copying the address out of the bar all work without the console doing anything about it.
 */
export function useRoute(): Route {
  const at = useSyncExternalStore(subscribe, hash);
  return useMemo(() => routeOf(at), [at]);
}
