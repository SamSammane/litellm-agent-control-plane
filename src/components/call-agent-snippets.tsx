"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { getProxyBase } from "@/lib/api";

type Lang = "curl" | "python" | "typescript";

const LANG_LABEL: Record<Lang, string> = {
  curl: "cURL",
  python: "Python",
  typescript: "TypeScript",
};

interface CallAgentSnippetsProps {
  agentId: string;
}

interface Step {
  title: string;
  hint: string;
  code: string;
}

function curlSteps(base: string, agentId: string): Step[] {
  return [
    {
      title: "1 — Spawn a session",
      hint: "Provisions a fresh Fargate task; ~50–90s the first time. Returns a session id you'll use for every subsequent call.",
      code: `curl -X POST ${base}/v1/managed_agents/agents/${agentId}/session \\
  -H "Authorization: Bearer $LITELLM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "smoke test"}'`,
    },
    {
      title: "2 — Send a message, get the response",
      hint: "Blocking call. The proxy forwards to the harness and waits for the assistant's full reply, then returns it.",
      code: `curl -X POST ${base}/v1/managed_agents/sessions/$SESSION_ID/message \\
  -H "Authorization: Bearer $LITELLM_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "In one sentence, what is this repo?"}'`,
    },
    {
      title: "3 — Stream events as the agent works",
      hint: "Server-Sent Events. Subscribe in parallel with /message to see tool calls + partial output land in real time.",
      code: `curl -N ${base}/v1/managed_agents/sessions/$SESSION_ID/events \\
  -H "Authorization: Bearer $LITELLM_API_KEY"`,
    },
  ];
}

function pythonSteps(base: string, agentId: string): Step[] {
  return [
    {
      title: "1 — Spawn a session",
      hint: "Provisions a fresh Fargate task; ~50–90s the first time. Returns a session id you'll use for every subsequent call.",
      code: `import os, httpx

BASE = "${base}"
KEY = os.environ["LITELLM_API_KEY"]
AGENT_ID = "${agentId}"

with httpx.Client(timeout=420, headers={"Authorization": f"Bearer {KEY}"}) as c:
    session = c.post(
        f"{BASE}/v1/managed_agents/agents/{AGENT_ID}/session",
        json={"title": "smoke test"},
    ).json()

session_id = session["id"]`,
    },
    {
      title: "2 — Send a message, get the response",
      hint: "Blocking call. Each POST returns the assistant's full reply once it's done.",
      code: `with httpx.Client(timeout=300, headers={"Authorization": f"Bearer {KEY}"}) as c:
    reply = c.post(
        f"{BASE}/v1/managed_agents/sessions/{session_id}/message",
        json={"text": "In one sentence, what is this repo?"},
    ).json()

print(reply)`,
    },
    {
      title: "3 — Stream events as the agent works",
      hint: "Open the SSE stream in a separate task / thread before you POST the message — partial chunks, tool calls, and final text all arrive here.",
      code: `import httpx

with httpx.stream(
    "GET",
    f"{BASE}/v1/managed_agents/sessions/{session_id}/events",
    headers={"Authorization": f"Bearer {KEY}"},
    timeout=None,
) as r:
    for line in r.iter_lines():
        if line:
            print(line)`,
    },
  ];
}

function typescriptSteps(base: string, agentId: string): Step[] {
  return [
    {
      title: "1 — Spawn a session",
      hint: "Provisions a fresh Fargate task; ~50–90s the first time. Returns a session id you'll use for every subsequent call.",
      code: `const BASE = "${base}";
const KEY = process.env.LITELLM_API_KEY!;
const AGENT_ID = "${agentId}";

const session = await fetch(
  \`\${BASE}/v1/managed_agents/agents/\${AGENT_ID}/session\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "smoke test" }),
  },
).then((r) => r.json());

const sessionId = session.id;`,
    },
    {
      title: "2 — Send a message, get the response",
      hint: "Blocking call. Each POST returns the assistant's full reply once it's done.",
      code: `const reply = await fetch(
  \`\${BASE}/v1/managed_agents/sessions/\${sessionId}/message\`,
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: "In one sentence, what is this repo?" }),
  },
).then((r) => r.json());

console.log(reply);`,
    },
    {
      title: "3 — Stream events as the agent works",
      hint: "Subscribe in parallel with the message POST. The SSE stream emits partial deltas, tool calls, and the final text frame.",
      code: `const stream = await fetch(
  \`\${BASE}/v1/managed_agents/sessions/\${sessionId}/events\`,
  { headers: { Authorization: \`Bearer \${KEY}\` } },
);

const reader = stream.body!.getReader();
const dec = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  process.stdout.write(dec.decode(value));
}`,
    },
  ];
}

interface SnippetBlockProps {
  step: Step;
}

function SnippetBlock({ step }: SnippetBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(step.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-zinc-100">
            {step.title}
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-400">
            {step.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label="Copy snippet"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300"
        >
          {copied ? (
            <>
              <Check className="size-3" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12px] leading-relaxed">
        <code className="font-mono">{step.code}</code>
      </pre>
    </div>
  );
}

export function CallAgentSnippets({ agentId }: CallAgentSnippetsProps) {
  const [lang, setLang] = useState<Lang>("curl");
  const [base, setBase] = useState<string>("http://localhost:4000");

  useEffect(() => {
    setBase(getProxyBase());
  }, []);

  const steps = useMemo(() => {
    switch (lang) {
      case "curl":
        return curlSteps(base, agentId);
      case "python":
        return pythonSteps(base, agentId);
      case "typescript":
        return typescriptSteps(base, agentId);
    }
  }, [lang, base, agentId]);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Call this agent
        </h2>
        <div role="tablist" aria-label="Language" className="flex gap-1">
          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => {
            const active = l === lang;
            return (
              <button
                key={l}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setLang(l)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {LANG_LABEL[l]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((s) => (
          <SnippetBlock key={s.title} step={s} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Set <span className="font-mono">LITELLM_API_KEY</span> and{" "}
        <span className="font-mono">SESSION_ID</span> in your environment.
        The whole flow is: <span className="font-mono">spawn</span> →{" "}
        <span className="font-mono">message</span> (or stream{" "}
        <span className="font-mono">events</span>) → repeat.
      </p>
    </section>
  );
}
