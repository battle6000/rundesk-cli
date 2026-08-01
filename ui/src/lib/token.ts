/**
 * This window's key to the console.
 *
 * It arrives in the **fragment** of the address `rundesk ui` printed. A fragment is never
 * sent to any server, so it cannot reach an access log and cannot leak through `Referer` —
 * and it costs nothing, because the key travels in a header from then on.
 */

const KEY = "rundesk.ui.token";
const SHAPE = /^[A-Za-z0-9_-]{22,128}$/;

/**
 * Take the key out of the address, once, before anything renders.
 *
 * `sessionStorage` and not `localStorage`: a key belongs to one run of the console, and a
 * stale one kept in an old tab would produce refusals that read like a fault.
 */
export function bootstrapToken(): void {
  const fragment = /^#t=([A-Za-z0-9_-]{22,128})$/.exec(window.location.hash);
  const query = new URLSearchParams(window.location.search).get("t");
  const minted = fragment?.[1] ?? (query && SHAPE.test(query) ? query : null);
  if (!minted) return;
  sessionStorage.setItem(KEY, minted);
  // Out of the address bar, and without a history entry somebody could go "back" into.
  window.history.replaceState(null, "", `${window.location.pathname}#/`);
}

export function getToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(KEY);
}
