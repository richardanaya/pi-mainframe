/**
 * PiManager — wraps pi coding agent sessions for HTTP server use.
 *
 * Key features:
 *   - Loads extensions (pi-daytona included)
 *   - Configures extension flags programmatically (e.g., --sandbox)
 *   - Session lifecycle (create, prompt, dispose)
 *   - SSE-compatible event streaming
 */

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ThinkingLevel, AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Model } from "@mariozechner/pi-ai";
import {
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  DefaultResourceLoader,
  getAgentDir,
  createAgentSession,
  type AgentSession,
  type AgentSessionEvent,
  type CompactionResult,
} from "@mariozechner/pi-coding-agent";
import { Theme } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PiSessionHandle {
  id: string;
  session: AgentSession;
  createdAt: Date;
  label?: string;
}

export interface SessionState {
  id: string;
  sessionId: string;
  sessionFile?: string;
  label?: string;
  model?: { provider: string; id: string };
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  messageCount: number;
  createdAt: string;
}

export interface CreateSessionOptions {
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Model provider (default: "anthropic") */
  provider?: string;
  /** Model ID (default: "claude-sonnet-4-20250514") */
  modelId?: string;
  /** Thinking level (default: "off") */
  thinkingLevel?: ThinkingLevel;
  /** Session label */
  label?: string;
  /** Tools to enable (default: "coding") */
  tools?: "coding" | "readonly" | "all" | string[];
  /** System prompt override */
  systemPrompt?: string;
  /** Continue most recent session? */
  continueRecent?: boolean;
  /** Settings overrides */
  settings?: {
    autoCompaction?: boolean;
    autoRetry?: boolean;
  };
  // ── Extension / sandbox ──
  /** Additional extension paths to load (e.g., ["~/.pi/extensions/pi-daytona/index.ts"]) */
  extraExtensionPaths?: string[];
  /** Inline extension factories */
  extensionFactories?: Array<(pi: any) => Promise<void> | void>;
  /** Extension flag values (e.g., new Map([["sandbox", "my-sandbox"]])) */
  extensionFlags?: Map<string, boolean | string>;
}

export interface PromptRequest {
  message: string;
  images?: ImageContent[];
}

export interface PiEvent {
  /** Event sequence number within the prompt run */
  seq: number;
  /** Unix timestamp ms */
  ts: number;
  /** The raw AgentSessionEvent */
  data: AgentSessionEvent;
}

// ---------------------------------------------------------------------------
// PiManager
// ---------------------------------------------------------------------------

export class PiManager {
  private sessions = new Map<string, PiSessionHandle>();
  private authStorage: AuthStorage;
  private modelRegistry: ModelRegistry;
  private defaultProvider: string;
  private defaultModelId: string;
  private agentDir: string;

  constructor(opts: {
    agentDir?: string;
    defaultProvider?: string;
    defaultModelId?: string;
  } = {}) {
    this.agentDir = opts.agentDir ?? getAgentDir();

    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);

    // Read pi's own settings.json for the user's configured defaults
    const settings = SettingsManager.create(process.cwd(), this.agentDir);
    this.defaultProvider = opts.defaultProvider ?? settings.getDefaultProvider() ?? "anthropic";
    this.defaultModelId = opts.defaultModelId ?? settings.getDefaultModel() ?? "claude-sonnet-4-20250514";
  }

  // -----------------------------------------------------------------------
  // Auth / API keys
  // -----------------------------------------------------------------------

  /** Set runtime API key (not persisted to disk). */
  setRuntimeApiKey(provider: string, key: string): void {
    this.authStorage.setRuntimeApiKey(provider, key);
  }

  // -----------------------------------------------------------------------
  // Models
  // -----------------------------------------------------------------------

  /** List available models (those with valid API keys). */
  async getAvailableModels(): Promise<Model<any>[]> {
    return this.modelRegistry.getAvailable();
  }

  // -----------------------------------------------------------------------
  // Session lifecycle
  // -----------------------------------------------------------------------

  /**
   * Create a new pi agent session.
   *
   * Extension flags (e.g., `new Map([["sandbox", "my-project"]])`)
   * configure extensions like pi-daytona programmatically.
   */
  async createSession(options: CreateSessionOptions = {}): Promise<PiSessionHandle> {
    const cwd = options.cwd ?? process.cwd();

    // --- Settings ---
    const settings = SettingsManager.create(cwd, this.agentDir);
    if (options.settings?.autoCompaction !== undefined) {
      settings.setCompactionEnabled(options.settings.autoCompaction);
    }
    if (options.settings?.autoRetry !== undefined) {
      settings.setRetryEnabled(options.settings.autoRetry);
    }

    // --- Resource loader with extensions ---
    const loaderOpts: any = {
      cwd,
      agentDir: this.agentDir,
      settingsManager: settings,
    };

    if (options.extraExtensionPaths?.length) {
      loaderOpts.additionalExtensionPaths = options.extraExtensionPaths;
    }
    if (options.extensionFactories?.length) {
      loaderOpts.extensionFactories = options.extensionFactories;
    }
    if (options.systemPrompt) {
      loaderOpts.systemPromptOverride = () => options.systemPrompt;
    }

    const loader = new DefaultResourceLoader(loaderOpts);
    await loader.reload();

    // --- Apply extension flags BEFORE creating the session ---
    // This is how pi-daytona's --sandbox flag gets set programmatically.
    if (options.extensionFlags?.size) {
      const { runtime } = loader.getExtensions();
      for (const [name, value] of options.extensionFlags) {
        runtime.flagValues.set(name, value);
      }
    }

    // --- Session manager ---
    let sessionManager: SessionManager;
    const sandboxFlag = options.extensionFlags?.get("sandbox");
    const sandboxName = typeof sandboxFlag === "string" && sandboxFlag.length > 0 ? sandboxFlag : undefined;
    // Use the human-readable label for the session filename (matches sandbox name),
    // falling back to the sandbox ID if no label is set.
    const sessionName = (options.label && options.label.length > 0) ? options.label : sandboxName;

    if (sessionName) {
      // Persist sandbox sessions to sessions/<name>.jsonl
      const sessionsDir = join(cwd, "sessions");
      const sessionFile = join(sessionsDir, `${sessionName}.jsonl`);
      sessionManager = SessionManager.open(sessionFile, sessionsDir, cwd);
    } else if (options.continueRecent) {
      sessionManager = SessionManager.continueRecent(cwd);
    } else {
      sessionManager = SessionManager.inMemory(cwd);
    }

    // --- Model ---
    const model = this.modelRegistry.find(
      options.provider ?? this.defaultProvider,
      options.modelId ?? this.defaultModelId,
    );
    if (!model) {
      throw new Error(
        `Model not found: ${options.provider ?? this.defaultProvider}/${options.modelId ?? this.defaultModelId}`,
      );
    }

    // --- Resolve tools ---
    const tools = this.resolveTools(options.tools ?? "coding");

    // --- Create session ---
    const { session } = await createAgentSession({
      cwd,
      agentDir: this.agentDir,
      model,
      thinkingLevel: options.thinkingLevel ?? "off",
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      tools,
      resourceLoader: loader,
      sessionManager,
      settingsManager: settings,
    });

    // --- Bind extensions (fires session_start, which activates sandbox) ---
    // Provide a minimal theme so extensions that call ctx.ui.theme.fg() don't crash.
    const ansiTheme = new Theme(
      {
        accent: "#58a6ff", border: "#30363d", borderAccent: "#58a6ff", borderMuted: "#21262d",
        success: "#3fb950", error: "#f85149", warning: "#d29922", muted: "#8b949e", dim: "#484f58",
        text: "#e6edf3", thinkingText: "#8b949e", userMessageText: "#e6edf3",
        customMessageText: "#e6edf3", customMessageLabel: "#8b949e",
        toolTitle: "#79c0ff", toolOutput: "#e6edf3", mdHeading: "#e6edf3", mdLink: "#58a6ff",
        mdLinkUrl: "#8b949e", mdCode: "#a5d6ff", mdCodeBlock: "#a5d6ff",
        mdCodeBlockBorder: "#30363d", mdQuote: "#8b949e", mdQuoteBorder: "#30363d",
        mdHr: "#30363d", mdListBullet: "#58a6ff",
        toolDiffAdded: "#3fb950", toolDiffRemoved: "#f85149", toolDiffContext: "#484f58",
        syntaxComment: "#8b949e", syntaxKeyword: "#ff7b72", syntaxFunction: "#d2a8ff",
        syntaxVariable: "#e6edf3", syntaxString: "#a5d6ff", syntaxNumber: "#a5d6ff",
        syntaxType: "#ffa657", syntaxOperator: "#ff7b72", syntaxPunctuation: "#8b949e",
        thinkingOff: "#8b949e", thinkingMinimal: "#8b949e", thinkingLow: "#8b949e",
        thinkingMedium: "#8b949e", thinkingHigh: "#8b949e", thinkingXhigh: "#8b949e",
        bashMode: "#3fb950",
      } as Record<string, string>,
      {
        selectedBg: "#1f6feb", userMessageBg: "#1f6feb", customMessageBg: "#1f6feb",
        toolPendingBg: "#d29922", toolSuccessBg: "#3fb950", toolErrorBg: "#f85149",
      } as Record<string, string>,
      "truecolor",
    );

    await session.bindExtensions({
      uiContext: {
        select: async () => undefined,
        confirm: async () => false,
        input: async () => undefined,
        notify: (msg, type) => console.log(`[ext] ${type ?? "info"}: ${msg}`),
        onTerminalInput: () => () => {},
        setStatus: () => {},
        setWorkingMessage: () => {},
        setWorkingVisible: () => {},
        setWorkingIndicator: () => {},
        setHiddenThinkingLabel: () => {},
        setWidget: () => {},
        setFooter: () => {},
        setHeader: () => {},
        setTitle: () => {},
        custom: async () => undefined as never,
        pasteToEditor: () => {},
        setEditorText: () => {},
        getEditorText: () => "",
        editor: async () => undefined,
        addAutocompleteProvider: () => {},
        setEditorComponent: () => {},
        getEditorComponent: () => undefined,
        get theme() { return ansiTheme; },
        getAllThemes: () => [],
        getTheme: () => undefined,
        setTheme: () => ({ success: false, error: "no TUI" }),
        getToolsExpanded: () => false,
        setToolsExpanded: () => {},
      },
      onError: (err) => console.error(`[ext-error] ${err.extensionPath}: ${err.error}`),
    });

    const handle: PiSessionHandle = {
      id: randomUUID(),
      session,
      createdAt: new Date(),
      label: options.label,
    };

    this.sessions.set(handle.id, handle);
    return handle;
  }

  /** Dispose a single session. */
  async disposeSession(id: string): Promise<void> {
    const handle = this.sessions.get(id);
    if (!handle) return;
    await handle.session.dispose();
    this.sessions.delete(id);
  }

  /** Dispose all sessions. */
  async disposeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((id) => this.disposeSession(id)));
  }

  /** Get a session by id. */
  getSession(id: string): PiSessionHandle | undefined {
    return this.sessions.get(id);
  }

  /** List all active sessions. */
  listSessions(): SessionState[] {
    return [...this.sessions.values()].map((h) => this.toState(h));
  }

  /** Count of active sessions. */
  get sessionCount(): number {
    return this.sessions.size;
  }

  // -----------------------------------------------------------------------
  // Prompting
  // -----------------------------------------------------------------------

  /**
   * Send a prompt to a session.
   *
   * The `onEvent` callback receives every AgentSessionEvent as it happens.
   * The returned Promise resolves when the agent finishes processing.
   */
  async prompt(
    id: string,
    request: PromptRequest,
    onEvent: (event: PiEvent) => void,
  ): Promise<void> {
    const handle = this.requireSession(id);
    let seq = 0;

    const unsubscribe = handle.session.subscribe((event) => {
      onEvent({ seq: ++seq, ts: Date.now(), data: event });
    });

    try {
      await handle.session.prompt(request.message, {
        images: request.images,
      });
    } finally {
      // Keep subscription alive for follow-ups; callers can re-subscribe
      // after agent_end if they want to stop listening.
    }
  }

  /** Queue a steering message. */
  async steer(id: string, message: string): Promise<void> {
    await this.requireSession(id).session.steer(message);
  }

  /** Queue a follow-up message. */
  async followUp(id: string, message: string): Promise<void> {
    await this.requireSession(id).session.followUp(message);
  }

  /** Abort current operation. */
  async abort(id: string): Promise<void> {
    await this.requireSession(id).session.abort();
  }

  // -----------------------------------------------------------------------
  // Session operations
  // -----------------------------------------------------------------------

  async compact(id: string, customInstructions?: string): Promise<CompactionResult> {
    return this.requireSession(id).session.compact(customInstructions);
  }

  getState(id: string): SessionState {
    return this.toState(this.requireSession(id));
  }

  async setModel(id: string, provider: string, modelId: string): Promise<void> {
    const model = this.modelRegistry.find(provider, modelId);
    if (!model) throw new Error(`Model not found: ${provider}/${modelId}`);
    await this.requireSession(id).session.setModel(model);
  }

  setThinkingLevel(id: string, level: ThinkingLevel): void {
    this.requireSession(id).session.setThinkingLevel(level);
  }

  async cycleModel(id: string) {
    return this.requireSession(id).session.cycleModel();
  }

  getMessages(id: string): AgentMessage[] {
    return this.requireSession(id).session.messages;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private requireSession(id: string): PiSessionHandle {
    const handle = this.sessions.get(id);
    if (!handle) throw new Error(`Session not found: ${id}`);
    return handle;
  }

  private toState(handle: PiSessionHandle): SessionState {
    const s = handle.session;
    return {
      id: handle.id,
      sessionId: s.sessionId,
      sessionFile: s.sessionFile,
      label: handle.label,
      model: s.model ? { provider: s.model.provider, id: s.model.id } : undefined,
      thinkingLevel: s.thinkingLevel,
      isStreaming: s.isStreaming,
      messageCount: s.messages.length,
      createdAt: handle.createdAt.toISOString(),
    };
  }

  private resolveTools(tools: "coding" | "readonly" | "all" | string[]): string[] {
    const all = ["read", "bash", "edit", "write", "grep", "find", "ls"];
    if (tools === "coding") return ["read", "bash", "edit", "write"];
    if (tools === "readonly") return ["read", "grep", "find", "ls"];
    if (tools === "all") return all;
    // Validate specific tool names
    for (const t of tools) {
      if (!all.includes(t)) throw new Error(`Unknown tool: "${t}". Available: ${all.join(", ")}`);
    }
    return tools;
  }
}
