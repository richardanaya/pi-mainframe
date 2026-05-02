/**
 * Thin Daytona API client using direct REST calls.
 * Avoids the heavy @daytonaio/sdk dependency (OpenTelemetry, etc.)
 * while still providing sandbox listing/management.
 */

import { readFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DaytonaSandbox {
  id: string;
  name?: string;
  state?: string;
  labels?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  target?: string;
  public?: boolean;
  errorReason?: string;
  autoStopInterval?: number;
  autoDeleteInterval?: number;
  snapshot?: string;
  user?: string;
  organizationId?: string;
  volumes?: Array<{
    volumeId: string;
    mountPath: string;
  }>;
  buildInfo?: {
    dockerfileContent?: string;
  };
  toolboxProxyUrl?: string;
}

export interface PaginatedSandboxes {
  items: DaytonaSandbox[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SandboxConfig {
  daytonaApiKey?: string;
  daytonaApiUrl?: string;
  daytonaTarget?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const PI_DAYTONA_LABEL = { "created-by": "pi-daytona" };
const PI_DAYTONA_PREFIX = "pi-daytona-";

// ── State ───────────────────────────────────────────────────────────────────

let config: SandboxConfig | null = null;

// ── Config loading ──────────────────────────────────────────────────────────

async function loadConfig(): Promise<SandboxConfig> {
  if (config) return config;
  const configPath = join(homedir(), ".pi", "daytona.json");
  try {
    await access(configPath);
    const content = await readFile(configPath, "utf-8");
    config = JSON.parse(content) as SandboxConfig;
    return config;
  } catch {
    return {};
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function apiUrl(path: string): string {
  const base = (config?.daytonaApiUrl ?? "https://app.daytona.io/api");
  return base + path;
}

function authHeaders(): Record<string, string> {
  const apiKey = config?.daytonaApiKey;
  if (!apiKey) throw new Error("Daytona API key not configured");
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Daytona-Source": "diomedes",
  };
}

async function apiGet<T>(path: string): Promise<T> {
  await loadConfig();
  const res = await fetch(apiUrl(path), { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daytona API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  await loadConfig();
  const res = await fetch(apiUrl(path), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daytona API error ${res.status}: ${text}`);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** List all pi-daytona sandboxes. */
export async function listPiDaytonaSandboxes(): Promise<DaytonaSandbox[]> {
  const labels = JSON.stringify(PI_DAYTONA_LABEL);
  const sandboxes = await apiGet<DaytonaSandbox[]>(
    `/sandbox?labels=${encodeURIComponent(labels)}`,
  );
  return sandboxes;
}

/** Get a single sandbox by ID or name. */
export async function getSandbox(idOrName: string): Promise<DaytonaSandbox> {
  return apiGet<DaytonaSandbox>(`/sandbox/${encodeURIComponent(idOrName)}`);
}

/** Delete a sandbox by ID or name. */
export async function deleteSandbox(idOrName: string): Promise<void> {
  await apiDelete(`/sandbox/${encodeURIComponent(idOrName)}`);
}

/** Check if Daytona is configured. */
export async function isDaytonaConfigured(): Promise<boolean> {
  try {
    const cfg = await loadConfig();
    return !!cfg.daytonaApiKey;
  } catch {
    return false;
  }
}

/** Get the current Daytona API key (masked). */
export async function getDaytonaStatus(): Promise<{ configured: boolean; apiKeyPreview: string }> {
  const cfg = await loadConfig();
  const key = cfg.daytonaApiKey ?? "";
  return {
    configured: !!key,
    apiKeyPreview: key ? `${key.slice(0, 8)}...${key.slice(-4)}` : "",
  };
}
