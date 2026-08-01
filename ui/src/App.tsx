import { getToken } from "./lib/token";

/** The console. Views land here; this is the shell that proves the seam works. */
export function App() {
  const held = getToken();
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-[17px] font-medium">Rundesk</h1>
      <p className="mt-1 text-muted-foreground">
        The local console. This release shows your install; it does not change it.
      </p>
      <p className="mt-6 font-mono text-[12.5px] text-muted-foreground">
        {held ? "this window has a key" : "this window has no key — run rundesk ui again"}
      </p>
    </main>
  );
}
