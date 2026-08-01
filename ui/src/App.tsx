import { useRoute } from "@/hooks/useRoute";
import { AGENTS_HREF } from "@/lib/route";
import { AgentDetail } from "@/views/AgentDetail";
import { AgentList } from "@/views/AgentList";

/** An address this console shows nothing at. Said, rather than quietly redirected: a link
 *  that lands somewhere else without a word is indistinguishable from one that worked. */
function Nowhere() {
  return (
    <div className="rounded-lg border border-dashed px-6 py-16 text-center">
      <p className="font-medium">This console shows nothing at that address</p>
      <a
        href={AGENTS_HREF}
        className="mt-3 inline-block text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to agents
      </a>
    </div>
  );
}

/** The console. One shell, and the address decides what is inside it. */
export function App() {
  const route = useRoute();
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-2.5 px-6">
          <a href={AGENTS_HREF} className="font-medium">
            Rundesk
          </a>
          <span className="text-muted-foreground">the local console</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {route.at === "agents" ? <AgentList /> : null}
        {route.at === "agent" ? (
          <AgentDetail agent={route.agent} tab={route.tab} file={route.file} />
        ) : null}
        {route.at === "nowhere" ? <Nowhere /> : null}
      </main>
    </div>
  );
}
