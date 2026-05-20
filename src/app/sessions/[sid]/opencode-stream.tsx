"use client";

import { useEffect, useState } from "react";

import {
  applyEvent,
  initState,
  type AgentMessage,
  type OpencodeEvent,
} from "@/lib/agent-state";
import { browserOpencodeClient } from "@/lib/opencode-client";

/**
 * Passive subscription to a session's opencode `/event` bus via the SDK.
 *
 * Folds frames through the shared reducer so an open UI renders turns it did
 * NOT start — a Slack / Linear @mention drives the same pod, and its events
 * fan out to every subscriber. Returns only assistant messages observed since
 * the stream opened (not seeded from history), so the caller can append them
 * as "live turns" without duplicating the canonical thread.
 *
 * Same opencode SDK + reducer the active send path uses — one event schema,
 * one fold, every surface identical.
 */
export function useOpencodeStream(
  sessionId: string,
  harnessSessionId: string | null | undefined,
  enabled: boolean,
): { messages: AgentMessage[] } {
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  useEffect(() => {
    if (!enabled || !sessionId || !harnessSessionId) return;
    let cancelled = false;
    const ctl = new AbortController();
    const oc = browserOpencodeClient(sessionId);

    void (async () => {
      let events;
      try {
        events = await oc.event.subscribe({ signal: ctl.signal });
      } catch {
        return;
      }
      if (cancelled) return;
      // Reset for this subscription. Done after the await so it isn't a
      // synchronous setState inside the effect body.
      setMessages([]);
      let state = initState();
      try {
        for await (const ev of events.stream) {
          if (cancelled) break;
          const e = ev as unknown as OpencodeEvent;
          const sid = e.properties?.sessionID;
          if (typeof sid === "string" && sid !== harnessSessionId) continue;
          state = applyEvent(state, e);
          setMessages(state.messages.filter((m) => m.role === "assistant"));
        }
      } catch {
        // Aborted on unmount / nav, or the pod closed the stream. The cleanup
        // below tears down; nothing to surface here.
      }
    })();

    return () => {
      cancelled = true;
      ctl.abort();
    };
  }, [sessionId, harnessSessionId, enabled]);

  return { messages };
}
