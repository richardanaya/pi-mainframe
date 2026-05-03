/**
 * TaskManager — scheduled CRON tasks that automatically create sandbox
 * threads and kick off a prompt as if a human initiated them.
 *
 * Tasks are stored as JSON files in tasks/<name>.json.
 */

import { readFile, writeFile, mkdir, readdir, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import type { PiManager } from "./pi-manager.js";
import {
  listPiDaytonaSandboxes,
  startSandbox,
} from "./daytona-client.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Task {
  name: string;
  cron: string;
  prompt: string;
  createdAt: string;
  lastRun: string | null;
  enabled: boolean;
}

export interface TaskState {
  name: string;
  cron: string;
  prompt: string;
  createdAt: string;
  lastRun: string | null;
  enabled: boolean;
  nextRun: string | null;
  running: boolean;
}

export type TaskListener = (tasks: TaskState[]) => void;

// ── Constants ───────────────────────────────────────────────────────────────

const TASKS_DIR = "tasks";
const SANDBOX_POLL_INTERVAL_MS = 2000;
const SANDBOX_POLL_MAX_RETRIES = 60; // 2 minutes max

// ── TaskManager ─────────────────────────────────────────────────────────────

export class TaskManager {
  private tasksDir: string;
  private projectCwd: string;
  private jobs: Map<string, { task: Task; job: any /* cronjob */ }> = new Map();
  private listeners: Set<TaskListener> = new Set();
  private runningTasks: Set<string> = new Set();
  private pi: PiManager;

  constructor(pi: PiManager, cwd: string) {
    this.pi = pi;
    this.projectCwd = cwd;
    this.tasksDir = join(cwd, TASKS_DIR);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Load all tasks from disk and schedule them. */
  async start(): Promise<void> {
    // Ensure tasks directory exists
    try { await mkdir(this.tasksDir, { recursive: true }); } catch { /* exists */ }

    const files = await readdir(this.tasksDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const name = file.slice(0, -5); // strip .json
      try {
        const task = await this.loadTask(name);
        if (task && task.enabled) {
          this.scheduleTask(task);
        }
      } catch (err) {
        console.error(`[task-manager] Error loading task "${name}":`, err);
      }
    }
    console.log(`[task-manager] Loaded ${this.jobs.size} scheduled task(s)`);
  }

  /** Stop all scheduled jobs. */
  stop(): void {
    for (const [name, entry] of this.jobs) {
      entry.job.stop();
    }
    this.jobs.clear();
    console.log("[task-manager] All tasks stopped");
  }

  // ── Eventing ───────────────────────────────────────────────────────────

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    // Send initial state immediately
    this.listTasks().then((tasks) => listener(tasks)).catch(() => {});
    return () => { this.listeners.delete(listener); };
  }

  private async notify(): Promise<void> {
    const tasks = await this.listTasks();
    for (const listener of this.listeners) {
      try { listener(tasks); } catch { /* ignore */ }
    }
  }

  // ── CRUD ───────────────────────────────────────────────────────────────

  /** List all tasks with their next run times. */
  async listTasks(): Promise<TaskState[]> {
    const tasks: TaskState[] = [];
    try {
      const files = await readdir(this.tasksDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const name = file.slice(0, -5);
        const task = await this.loadTask(name);
        if (!task) continue;

        const scheduled = this.jobs.get(name);
        tasks.push({
          ...task,
          nextRun: scheduled ? this.getNextRun(scheduled.job) : null,
          running: this.runningTasks.has(task.name),
        });
      }
    } catch {
      // Directory may not exist yet
    }
    return tasks;
  }

  /** Get a single task. */
  async getTask(name: string): Promise<TaskState | null> {
    const task = await this.loadTask(name);
    if (!task) return null;
    const scheduled = this.jobs.get(name);
    return {
      ...task,
      nextRun: scheduled ? this.getNextRun(scheduled.job) : null,
      running: this.runningTasks.has(task.name),
    };
  }

  /** Create a new task and schedule it. */
  async createTask(name: string, cron: string, prompt: string): Promise<Task> {
    // Validate cron expression
    const cronModule = await import("node-cron");
    if (!cronModule.default.validate(cron)) {
      throw new Error(`Invalid cron expression: "${cron}"`);
    }

    const taskPath = join(this.tasksDir, `${name}.json`);
    try {
      await access(taskPath);
      throw new Error(`Task "${name}" already exists`);
    } catch (err: any) {
      if (err.message?.includes("already exists")) throw err;
      // File doesn't exist — good, proceed
    }

    const task: Task = {
      name,
      cron,
      prompt,
      createdAt: new Date().toISOString(),
      lastRun: null,
      enabled: true,
    };

    await writeFile(taskPath, JSON.stringify(task, null, 2), "utf-8");
    this.scheduleTask(task);
    await this.notify();
    return task;
  }

  /** Delete a task and unschedule it. */
  async deleteTask(name: string): Promise<void> {
    const taskPath = join(this.tasksDir, `${name}.json`);
    await unlink(taskPath);

    const entry = this.jobs.get(name);
    if (entry) {
      entry.job.stop();
      this.jobs.delete(name);
    }
    await this.notify();
  }

  /** Enable or disable a task. */
  async setTaskEnabled(name: string, enabled: boolean): Promise<TaskState | null> {
    const task = await this.loadTask(name);
    if (!task) return null;

    task.enabled = enabled;

    const taskPath = join(this.tasksDir, `${name}.json`);
    await writeFile(taskPath, JSON.stringify(task, null, 2), "utf-8");

    // Schedule or unschedule
    this.unscheduleTask(name);
    if (enabled) {
      this.scheduleTask(task);
    }

    await this.notify();
    return this.getTask(name);
  }

  // ── Scheduling ─────────────────────────────────────────────────────────

  private async scheduleTask(task: Task): Promise<void> {
    const cronModule = await import("node-cron");
    const job = cronModule.default.schedule(task.cron, () => {
      this.executeTask(task.name).catch((err) => {
        console.error(`[task-manager] Task "${task.name}" failed:`, err);
      });
    });
    this.jobs.set(task.name, { task, job });
    console.log(`[task-manager] Scheduled "${task.name}" (${task.cron})`);
  }

  private unscheduleTask(name: string): void {
    const entry = this.jobs.get(name);
    if (entry) {
      entry.job.stop();
      this.jobs.delete(name);
    }
  }

  private getNextRun(job: any): string | null {
    // node-cron doesn't expose next invocation easily; approximate
    // The job object has an internal cronTime but it's not public API.
    // For now, return null and let the frontend handle display.
    return null;
  }

  // ── Execution ──────────────────────────────────────────────────────────

  /** Execute a task immediately (same as cron trigger). */
  async executeTask(name: string): Promise<void> {
    const task = await this.loadTask(name);
    if (!task) throw new Error(`Task "${name}" not found`);

    this.runningTasks.add(name);
    await this.notify(); // notify: task is starting

    // Fixed name per task: one sandbox, one session file, forever
    const runName = name;
    const fullSandboxName = `pi-daytona-${runName}`;

    console.log(`[task-manager] Executing task "${name}"...`);

    try {
      // 1. Ensure the sandbox exists and is started
      await this.ensureSandbox(runName, fullSandboxName);

      // 2. Open the persistent session (loads existing history from
      //    sessions/task-<name>.jsonl so context accumulates across runs)
      const handle = await this.pi.createSession({
        cwd: this.projectCwd,
        label: runName,
        thinkingLevel: "off",
        settings: { autoCompaction: true, autoRetry: true },
        extensionFlags: new Map([["sandbox", runName]]),
      });

      // 3. Send the prompt and wait for the full agent run to complete
      await new Promise<void>((resolve, reject) => {
        const unsubscribe = handle.session.subscribe((event) => {
          if (event.type === "agent_end") {
            unsubscribe();
            this.pi.disposeSession(handle.id).catch(() => {});
            resolve();
          }
        });

        handle.session.prompt(task.prompt).catch((err) => {
          unsubscribe();
          this.pi.disposeSession(handle.id).catch(() => {});
          reject(err);
        });
      });

      await this.updateLastRun(name);
      console.log(`[task-manager] Task "${name}" completed`);
    } catch (err: any) {
      console.error(`[task-manager] Task "${name}" failed:`, err.message);
      throw err;
    } finally {
      this.runningTasks.delete(name);
      await this.notify(); // notify: task finished (success or failure)
    }
  }

  /** Ensure a sandbox exists and is started. Creates it if missing. */
  private async ensureSandbox(runName: string, fullSandboxName: string): Promise<void> {
    const sandboxes = await listPiDaytonaSandboxes();
    const sandbox = sandboxes.find((s) => s.name === fullSandboxName);

    if (!sandbox) {
      // No sandbox yet — create a session to trigger provisioning
      const handle = await this.pi.createSession({
        cwd: this.projectCwd,
        label: runName,
        thinkingLevel: "off",
        settings: { autoCompaction: true, autoRetry: true },
        extensionFlags: new Map([["sandbox", runName]]),
      });

      // Poll until the sandbox appears and is started
      for (let i = 0; i < SANDBOX_POLL_MAX_RETRIES; i++) {
        await new Promise((r) => setTimeout(r, SANDBOX_POLL_INTERVAL_MS));
        const list = await listPiDaytonaSandboxes();
        const found = list.find((s) => s.name === fullSandboxName);
        if (found && found.state === "started") {
          await this.pi.disposeSession(handle.id).catch(() => {});
          return;
        }
      }

      await this.pi.disposeSession(handle.id).catch(() => {});
      throw new Error(`Sandbox "${fullSandboxName}" did not start in time`);
    }

    if (sandbox.state === "started") {
      return;
    }

    if (sandbox.state === "stopped") {
      await startSandbox(sandbox.id);
    }

    // Poll until started
    for (let i = 0; i < SANDBOX_POLL_MAX_RETRIES; i++) {
      await new Promise((r) => setTimeout(r, SANDBOX_POLL_INTERVAL_MS));
      const list = await listPiDaytonaSandboxes();
      const sb = list.find((s) => s.id === sandbox.id);
      if (sb && sb.state === "started") return;
    }

    throw new Error(`Sandbox "${fullSandboxName}" did not reach "started" state`);
  }

  // ── File I/O ───────────────────────────────────────────────────────────

  private async loadTask(name: string): Promise<Task | null> {
    const taskPath = join(this.tasksDir, `${name}.json`);
    try {
      const content = await readFile(taskPath, "utf-8");
      return JSON.parse(content) as Task;
    } catch {
      return null;
    }
  }

  private async updateLastRun(name: string): Promise<void> {
    try {
      const task = await this.loadTask(name);
      if (!task) return;
      task.lastRun = new Date().toISOString();
      const taskPath = join(this.tasksDir, `${name}.json`);
      await writeFile(taskPath, JSON.stringify(task, null, 2), "utf-8");
    } catch {
      // Best effort
    }
  }
}