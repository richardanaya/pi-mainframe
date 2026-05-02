/**
 * diomedes — HTTP/SSE server wrapping pi coding agent as a library.
 *
 * Serves the web UI from public/ and exposes:
 *   POST   /api/sessions              Create a new agent session
 *   GET    /api/sessions              List all active sessions
 *   GET    /api/sessions/:id          Get session state
 *   DELETE /api/sessions/:id          Dispose a session
 *   POST   /api/sessions/:id/prompt   Send a prompt (SSE streaming response)
 *   POST   /api/sessions/:id/steer    Queue a steering message
 *   POST   /api/sessions/:id/follow-up Queue a follow-up message
 *   POST   /api/sessions/:id/abort    Abort current operation
 *   POST   /api/sessions/:id/compact  Compact session context
 *   PUT    /api/sessions/:id/model    Set model
 *   PUT    /api/sessions/:id/thinking Set thinking level
 *   GET    /api/sessions/:id/messages Get all messages
 *   GET    /api/models                List available models
 *   GET    /api/health                Health check
 *   GET    /api/sandboxes             List pi-daytona sandboxes (threads)
 *   DELETE /api/sandboxes/:id         Delete a sandbox
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ThinkingLevel } from "@mariozechner/pi-agent-core";
import { PiManager, type CreateSessionOptions, type PromptRequest, type PiEvent } from "./pi-manager.js";
import {
  listPiDaytonaSandboxes,
  getSandbox,
  deleteSandbox,
  isDaytonaConfigured,
  getDaytonaStatus,
} from "./daytona-client.js";

// ── Resolve public/ dir (next to src/, or CWD) ─────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, "..", "public");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface ServerConfig {
  port: number;
  host: string;
  /** Path to pi-daytona extension index (loaded when sandbox is configured) */
  daytonaExtensionPath?: string;
  /** Default model provider */
  defaultProvider?: string;
  /** Default model id */
  defaultModelId?: string;
  /** Agent directory (extensions, skills, settings) */
  agentDir?: string;
}

// ---------------------------------------------------------------------------
// Simple router (no Express dependency — lighter, fewer deps)
// ---------------------------------------------------------------------------

type Handler = (req: IncomingMessage, res: ServerResponse, params?: Record<string, string>) => Promise<void> | void;

interface Route {
  method: string;
  pattern: RegExp;
  handler: Handler;
}

class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): void {
    // Convert Express-style :param to named capture groups
    const regexStr = "^" + path.replace(/:([a-zA-Z_]+)/g, "(?<$1>[^/]+)") + "$";
    this.routes.push({ method: method.toUpperCase(), pattern: new RegExp(regexStr), handler });
  }

  get(path: string, handler: Handler) {
    this.add("GET", path, handler);
  }
  post(path: string, handler: Handler) {
    this.add("POST", path, handler);
  }
  put(path: string, handler: Handler) {
    this.add("PUT", path, handler);
  }
  delete(path: string, handler: Handler) {
    this.add("DELETE", path, handler);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      try {
        await route.handler(req, res, match.groups ?? {});
      } catch (err: any) {
        if (!res.headersSent) {
          json(res, 500, { error: err.message ?? "Internal server error" });
        }
      }
      return;
    }

    json(res, 404, { error: "Not found" });
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

function sse(res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
}

function sendSSE(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function parseBody<T = any>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export async function createPiServer(config: ServerConfig = { port: 8888, host: "127.0.0.1" }) {
  const port = config.port ?? 8888;
  const host = config.host ?? "127.0.0.1";

  // Resolve pi-daytona extension path
  const daytonaPath =
    config.daytonaExtensionPath ??
    join(homedir(), ".pi", "extensions", "pi-daytona", "index.ts");

  // PiManager reads default provider/model from ~/.pi/agent/settings.json,
  // overridable via env vars PI_DEFAULT_PROVIDER / PI_DEFAULT_MODEL
  const pi = new PiManager({
    agentDir: config.agentDir,
    defaultProvider: config.defaultProvider,
    defaultModelId: config.defaultModelId,
  });

  const router = new Router();

  // -----------------------------------------------------------------------
  // Health
  // -----------------------------------------------------------------------

  router.get("/api/health", async (_req, res) => {
    json(res, 200, {
      status: "ok",
      sessions: pi.sessionCount,
      uptime: process.uptime(),
    });
  });

  // -----------------------------------------------------------------------
  // Models
  // -----------------------------------------------------------------------

  router.get("/api/models", async (_req, res) => {
    const models = await pi.getAvailableModels();
    json(res, 200, {
      models: models.map((m) => ({
        provider: m.provider,
        id: m.id,
        contextWindow: m.contextWindow,
        reasoning: m.reasoning ?? false,
      })),
    });
  });

  // -----------------------------------------------------------------------
  // Sessions — create
  // -----------------------------------------------------------------------

  router.post("/api/sessions", async (req, res) => {
    const body = await parseBody<any>(req);
    const headers = req.headers;

    // Build extension flag values from request.
    // pi-daytona is already loaded by DefaultResourceLoader from the
    // packages list in ~/.pi/agent/settings.json — we just need to set
    // the --sandbox flag so it activates.
    const extensionFlags = new Map<string, boolean | string>();

    const sandboxHeader = headers["x-sandbox"] ?? body.sandbox;
    const sandboxName = headers["x-sandbox-name"] ?? body.sandboxName;
    const noSandbox = headers["x-no-sandbox"] ?? body.noSandbox;

    if (sandboxHeader !== undefined || sandboxName !== undefined) {
      if (noSandbox === "true" || noSandbox === true) {
        extensionFlags.set("no-sandbox", true);
      } else {
        // --sandbox with optional name
        const name = typeof sandboxName === "string" ? sandboxName : (typeof sandboxHeader === "string" ? sandboxHeader : "");
        extensionFlags.set("sandbox", name || "");
      }
    } else if (sandboxHeader === "true" || sandboxHeader === true) {
      extensionFlags.set("sandbox", "");
    }

    // Settings
    const settings: CreateSessionOptions["settings"] = {};
    if (body.autoCompaction !== undefined) settings.autoCompaction = Boolean(body.autoCompaction);
    if (body.autoRetry !== undefined) settings.autoRetry = Boolean(body.autoRetry);

    const opts: CreateSessionOptions = {
      cwd: body.cwd ?? process.cwd(),
      provider: body.provider,
      modelId: body.modelId,
      thinkingLevel: body.thinkingLevel ?? "off",
      label: body.label,
      tools: body.tools ?? "coding",
      systemPrompt: body.systemPrompt,
      settings: settings,
      extensionFlags,
    };

    try {
      const handle = await pi.createSession(opts);
      json(res, 201, pi.getState(handle.id));
    } catch (err: any) {
      json(res, 400, { error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Sessions — list
  // -----------------------------------------------------------------------

  router.get("/api/sessions", async (_req, res) => {
    json(res, 200, { sessions: pi.listSessions() });
  });

  // -----------------------------------------------------------------------
  // Sessions — get state
  // -----------------------------------------------------------------------

  router.get("/api/sessions/:id", async (_req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    json(res, 200, pi.getState(params!.id));
  });

  // -----------------------------------------------------------------------
  // Sessions — dispose
  // -----------------------------------------------------------------------

  router.delete("/api/sessions/:id", async (_req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    await pi.disposeSession(params!.id);
    json(res, 200, { ok: true });
  });

  // -----------------------------------------------------------------------
  // Sessions — prompt (SSE)
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/prompt", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }

    const body: PromptRequest = await parseBody(req);
    if (!body.message?.trim()) {
      json(res, 400, { error: "message is required" });
      return;
    }

    sse(res);

    let agentEnded = false;

    try {
      await pi.prompt(params!.id, body, (event: PiEvent) => {
        if (agentEnded) return; // Don't send after agent_end

        const eventType = mapEventType(event.data.type);
        sendSSE(res, eventType, {
          seq: event.seq,
          ts: event.ts,
          type: event.data.type,
          ...extractEventPayload(event.data),
        });

        if (event.data.type === "agent_end") {
          agentEnded = true;
          sendSSE(res, "done", {});
        }
      });
    } catch (err: any) {
      if (!res.headersSent) {
        json(res, 500, { error: err.message });
        return;
      }
      sendSSE(res, "error", { error: err.message });
    }

    if (!res.writableEnded) {
      res.end();
    }
  });

  // -----------------------------------------------------------------------
  // Sessions — steer
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/steer", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const { message } = await parseBody(req);
    if (!message) {
      json(res, 400, { error: "message is required" });
      return;
    }
    await pi.steer(params!.id, message);
    json(res, 200, { ok: true });
  });

  // -----------------------------------------------------------------------
  // Sessions — follow-up
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/follow-up", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const { message } = await parseBody(req);
    if (!message) {
      json(res, 400, { error: "message is required" });
      return;
    }
    await pi.followUp(params!.id, message);
    json(res, 200, { ok: true });
  });

  // -----------------------------------------------------------------------
  // Sessions — abort
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/abort", async (_req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    await pi.abort(params!.id);
    json(res, 200, { ok: true });
  });

  // -----------------------------------------------------------------------
  // Sessions — compact
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/compact", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const { customInstructions } = await parseBody(req);
    const result = await pi.compact(params!.id, customInstructions);
    json(res, 200, result);
  });

  // -----------------------------------------------------------------------
  // Sessions — set model
  // -----------------------------------------------------------------------

  router.put("/api/sessions/:id/model", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const { provider, modelId } = await parseBody(req);
    if (!provider || !modelId) {
      json(res, 400, { error: "provider and modelId are required" });
      return;
    }
    try {
      await pi.setModel(params!.id, provider, modelId);
      json(res, 200, pi.getState(params!.id));
    } catch (err: any) {
      json(res, 400, { error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Sessions — set thinking level
  // -----------------------------------------------------------------------

  router.put("/api/sessions/:id/thinking", async (req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const { level } = await parseBody(req);
    const validLevels = ["off", "minimal", "low", "medium", "high", "xhigh"];
    if (!validLevels.includes(level)) {
      json(res, 400, { error: `Invalid thinking level. Use: ${validLevels.join(", ")}` });
      return;
    }
    pi.setThinkingLevel(params!.id, level as ThinkingLevel);
    json(res, 200, pi.getState(params!.id));
  });

  // -----------------------------------------------------------------------
  // Sessions — cycle model
  // -----------------------------------------------------------------------

  router.post("/api/sessions/:id/cycle-model", async (_req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    const result = await pi.cycleModel(params!.id);
    json(res, 200, result ?? null);
  });

  // -----------------------------------------------------------------------
  // Sessions — get messages
  // -----------------------------------------------------------------------

  router.get("/api/sessions/:id/messages", async (_req, res, params) => {
    const handle = pi.getSession(params!.id);
    if (!handle) {
      json(res, 404, { error: "Session not found" });
      return;
    }
    json(res, 200, { messages: pi.getMessages(params!.id) });
  });

  // -----------------------------------------------------------------------
  // API key override
  // -----------------------------------------------------------------------

  router.post("/api/auth", async (req, res) => {
    const { provider, apiKey } = await parseBody(req);
    if (!provider || !apiKey) {
      json(res, 400, { error: "provider and apiKey are required" });
      return;
    }
    pi.setRuntimeApiKey(provider, apiKey);
    json(res, 200, { ok: true, provider });
  });

  // -----------------------------------------------------------------------
  // Sandboxes (Daytona threads)
  // -----------------------------------------------------------------------

  router.get("/api/sandboxes", async (_req, res) => {
    try {
      const configured = await isDaytonaConfigured();
      if (!configured) {
        json(res, 200, { sandboxes: [], daytonaConfigured: false });
        return;
      }
      const sandboxes = await listPiDaytonaSandboxes();
      json(res, 200, {
        sandboxes: sandboxes.map((s) => ({
          id: s.id,
          name: s.name,
          state: s.state,
          createdAt: s.createdAt,
          lastActivityAt: s.lastActivityAt,
          cpu: s.cpu,
          memory: s.memory,
          disk: s.disk,
        })),
        daytonaConfigured: true,
      });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
  });

  router.get("/api/sandboxes/:id", async (_req, res, params) => {
    try {
      const sandbox = await getSandbox(params!.id);
      json(res, 200, sandbox);
    } catch (err: any) {
      json(res, 404, { error: err.message });
    }
  });

  router.delete("/api/sandboxes/:id", async (_req, res, params) => {
    try {
      await deleteSandbox(params!.id);
      json(res, 200, { ok: true });
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
  });

  // Daytona config status
  router.get("/api/daytona-status", async (_req, res) => {
    try {
      const status = await getDaytonaStatus();
      json(res, 200, status);
    } catch (err: any) {
      json(res, 500, { error: err.message });
    }
  });

  // -----------------------------------------------------------------------
  // Static file serving (public/)
  // -----------------------------------------------------------------------

  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };

  async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    let pathname = url.pathname;

    // Only serve GET/HEAD
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    // Map root to index.html
    if (pathname === "/") pathname = "/index.html";

    // Only serve paths without /api/ prefix
    if (pathname.startsWith("/api/")) return false;

    const filePath = join(PUBLIC_DIR, pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) return false;

    if (!existsSync(filePath)) return false;

    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) return false;

      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const contentType = mimeTypes[ext] ?? "application/octet-stream";

      const content = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Cache-Control": "no-cache",
      });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Create and start HTTP server
  // -----------------------------------------------------------------------

  const httpServer = createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sandbox, X-Sandbox-Name",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    // Try static file first
    const served = await serveStatic(req, res);
    if (served) return;

    await router.handle(req, res);
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));

  console.log(`🏖️  diomedes server listening on http://${host}:${port}`);
  console.log(`   daytona extension: ${daytonaPath}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    await pi.disposeAll();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { pi, server: httpServer, shutdown };
}

// ---------------------------------------------------------------------------
// Event mapping helpers
// ---------------------------------------------------------------------------

function mapEventType(type: string): string {
  const mapping: Record<string, string> = {
    agent_start: "agent-start",
    agent_end: "agent-end",
    turn_start: "turn-start",
    turn_end: "turn-end",
    message_start: "message-start",
    message_end: "message-end",
    message_update: "message-update",
    tool_execution_start: "tool-start",
    tool_execution_update: "tool-update",
    tool_execution_end: "tool-end",
    compaction_start: "compaction-start",
    compaction_end: "compaction-end",
    auto_retry_start: "retry-start",
    auto_retry_end: "retry-end",
    queue_update: "queue-update",
    session_update: "session-update",
  };
  return mapping[type] ?? type;
}

function extractEventPayload(event: any): Record<string, unknown> {
  switch (event.type) {
    case "message_update":
      return { assistantMessageEvent: event.assistantMessageEvent };
    case "tool_execution_start":
      return { toolCallId: event.toolCallId, toolName: event.toolName, toolInput: event.toolInput };
    case "tool_execution_update":
      return { toolCallId: event.toolCallId, delta: event.delta };
    case "tool_execution_end":
      return { toolCallId: event.toolCallId, isError: event.isError };
    case "turn_end":
      return { message: event.message, toolResults: event.toolResults };
    case "agent_end":
      return { messages: event.messages };
    case "queue_update":
      return { steering: event.steering, followUp: event.followUp };
    case "compaction_end":
    case "compaction_start":
      return event.compactionResult ? { compactionResult: event.compactionResult } : {};
    case "session_update":
      return { sessionName: event.sessionName, sessionPath: event.sessionPath };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

export async function main() {
  const port = Number(process.env.PORT) || 8888;
  const host = process.env.HOST || "127.0.0.1";

  const { shutdown } = await createPiServer({
    port,
    host,
    daytonaExtensionPath: process.env.DAYTONA_EXTENSION_PATH,
    defaultProvider: process.env.PI_DEFAULT_PROVIDER,
    defaultModelId: process.env.PI_DEFAULT_MODEL,
  });

  return { shutdown };
}

// Auto-start when run directly
main();
