#!/usr/bin/env node
/**
 * Standalone stdio MCP server exposing `provision` + `execute` sandbox tools
 * for the opencode harness.
 *
 * Delegates to the LAP platform API — same endpoints as claude-agent-sdk's
 * buildSandboxMcpServer. The platform owns template selection, vault proxy
 * injection, and sandbox lifecycle.
 *
 * Requires: LAP_BASE_URL, SESSION_ID, and LAP_AUTH_TOKEN (falls back to MASTER_KEY).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.LAP_BASE_URL;
const SESSION_ID = process.env.SESSION_ID;
const TOKEN = process.env.LAP_AUTH_TOKEN ?? process.env.MASTER_KEY;

const server = new Server(
  { name: "opencode-sandbox", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "provision",
    description:
      "Provision a new sandbox environment. Returns a confirmation message when the sandbox is ready. Use the chosen name as sandbox_name in subsequent execute() calls.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Label for the sandbox — used in subsequent execute() calls as sandbox_name",
        },
        project_id: {
          type: "string",
          description: "ID of the project template to provision the sandbox from",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "execute",
    description:
      "Execute a shell command inside a provisioned sandbox. Returns the command output.",
    inputSchema: {
      type: "object",
      properties: {
        sandbox_name: {
          type: "string",
          description: "Label of the provisioned sandbox to run the command in",
        },
        cmd: { type: "string", description: "Shell command to execute inside the sandbox" },
      },
      required: ["sandbox_name", "cmd"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

function missingConfig() {
  if (!BASE || !SESSION_ID || !TOKEN) {
    return `sandbox tools unavailable: missing ${[
      !BASE && "LAP_BASE_URL",
      !SESSION_ID && "SESSION_ID",
      !TOKEN && "LAP_AUTH_TOKEN/MASTER_KEY",
    ].filter(Boolean).join(", ")}`;
  }
  return null;
}

async function provision({ name, project_id }) {
  const err = missingConfig();
  if (err) return textResult(`provision failed: ${err}`, true);
  try {
    const res = await fetch(
      `${BASE}/api/v1/managed_agents/sessions/${SESSION_ID}/sandbox/provision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ name, project_id }),
      },
    );
    const json = await res.json();
    if (!res.ok) return textResult(`provision failed: ${json.error ?? `HTTP ${res.status}`}`, true);
    return textResult(json.message ?? "sandbox provisioned");
  } catch (e) {
    return textResult(`provision error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

async function execute({ sandbox_name, cmd }) {
  const err = missingConfig();
  if (err) return textResult(`execute failed: ${err}`, true);
  try {
    const res = await fetch(
      `${BASE}/api/v1/managed_agents/sessions/${SESSION_ID}/sandbox/execute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ sandbox_name, cmd }),
      },
    );
    const json = await res.json();
    if (!res.ok) return textResult(`execute failed: ${json.error ?? `HTTP ${res.status}`}`, true);
    return textResult(json.output ?? "");
  } catch (e) {
    return textResult(`execute error: ${e instanceof Error ? e.message : String(e)}`, true);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "provision") return provision(args ?? {});
  if (name === "execute") return execute(args ?? {});
  return textResult(`unknown tool: ${name}`, true);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `[sandbox-mcp] ready (session=${SESSION_ID ?? "MISSING"}, base=${BASE ?? "MISSING"})`,
);
