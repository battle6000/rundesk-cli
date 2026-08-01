import { useCallback, useEffect, useRef, useState } from "react";

import { troubleOf, type Trouble } from "@/lib/api";

/**
 * One read, held for as long as a view needs it, and refreshed without the view flickering.
 *
 * Four failures are prevented here rather than in each view, because each of them shows up
 * as "the console looked broken for a moment" and none of them shows up as an error anybody
 * could report. Each is named at the line that prevents it.
 */

type Read<T> = (signal: AbortSignal) => Promise<T>;

type Held<T> = {
  data: T | null;
  trouble: Trouble | null;
  /** The first read has not settled, so there is nothing to show yet. */
  loading: boolean;
  /** A later read is running behind data that is already on screen. */
  refreshing: boolean;
};

export type Resource<T> = Held<T> & { reload: () => void };

/**
 * `read` is a dependency: a view that builds it inline must wrap it in `useCallback`, or
 * every render starts the read again. `everyMs` left out means one read and no polling.
 */
export function useResource<T>(read: Read<T>, everyMs?: number): Resource<T> {
  const [held, setHeld] = useState<Held<T>>({
    data: null,
    trouble: null,
    loading: true,
    refreshing: false,
  });
  const inFlight = useRef<AbortController | null>(null);
  const again = useRef<() => void>(() => {});
  const reload = useCallback(() => {
    again.current();
  }, []);

  useEffect(() => {
    let live = true;
    // A different read is a different subject: what is on screen belongs to the last one and
    // showing it under the new one's heading would be a lie for as long as the load takes.
    setHeld({ data: null, trouble: null, loading: true, refreshing: false });

    const load = async () => {
      // Overlapping polls: a tick that finds one still running skips its beat. A command
      // slower than the interval would otherwise queue reads behind each other for as long
      // as the tab is open, and every one of them would land out of order.
      if (inFlight.current) return;
      const controller = new AbortController();
      inFlight.current = controller;
      // Flashing on refetch: a refresh never clears what is already on screen. It says it is
      // refreshing, and the view keeps its rows until there is something to replace them.
      setHeld((was) => (was.loading ? was : { ...was, refreshing: true }));
      try {
        const shown = await read(controller.signal);
        if (!live) return;
        setHeld({ data: shown, trouble: null, loading: false, refreshing: false });
      } catch (thrown) {
        // Racing responses: the load this effect's cleanup aborted has nothing to say, and
        // its abort is not a failure the owner should ever be shown.
        if (controller.signal.aborted || !live) return;
        setHeld((was) => ({
          data: was.data,
          trouble: troubleOf(thrown),
          loading: false,
          refreshing: false,
        }));
      } finally {
        // Only the load that claimed the slot may release it; a load aborted by cleanup must
        // not clear the slot a newer one has already taken.
        if (inFlight.current === controller) inFlight.current = null;
      }
    };

    again.current = load;
    void load();

    const done = () => {
      live = false;
      inFlight.current?.abort();
      inFlight.current = null;
    };
    if (everyMs === undefined) return done;

    // Polling a hidden tab: a window nobody is looking at asks for nothing, and asks once
    // the moment it is looked at again — so what it shows on return is current, and a
    // console left open overnight has not run a command every three seconds all night.
    const whenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const beat = window.setInterval(whenVisible, everyMs);
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      done();
      window.clearInterval(beat);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [read, everyMs]);

  return { ...held, reload };
}
