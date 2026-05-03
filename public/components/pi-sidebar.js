import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { stripPrefix, formatDate } from './pi-api.js';

export class PiSidebar extends LitElement {
  static properties = {
    threads: { type: Array },
    tasks: { type: Array },
    selectedThreadId: { type: String },
    daytonaConfigured: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 280px;
      min-width: 280px;
      height: 100vh;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      user-select: none;
    }

    /* ── Header ───────────────────── */
    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .sidebar-header h1 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      letter-spacing: 0.2px;
    }
    .badge {
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 99px;
      background: var(--accent);
      color: #0c1117;
      font-weight: 600;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .badge.hidden { display: none; }

    /* ── Section headers ──────────── */
    .section-header {
      padding: 12px 16px 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      font-family: var(--font-sans);
    }

    /* ── Task section ─────────────── */
    .task-section {
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }

    .btn-icon {
      width: 20px;
      height: 20px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .btn-icon:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .task-list {
      padding: 4px 8px;
    }

    .task-item {
      padding: 8px 10px;
      border-radius: var(--radius);
      cursor: default;
      margin-bottom: 2px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background 0.15s;
      border: 1px solid transparent;
    }
    .task-item:hover {
      background: var(--bg-hover);
    }
    .task-item.active {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    .task-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .task-meta {
      padding-left: 16px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .task-state {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .task-state.enabled { background: var(--green); }
    .task-state.disabled { background: var(--text-muted); }

    .task-name {
      font-size: 12px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .task-running {
      font-size: 10px;
      color: var(--accent);
      animation: pulse 1.5s infinite;
      margin-right: 4px;
    }

    .task-cron {
      font-size: 10px;
      color: var(--text-muted);
      font-family: monospace;
      background: var(--bg-tertiary);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .task-run,
    .task-toggle-btn,
    .task-delete {
      width: 18px;
      height: 18px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 4px;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
    }
    .task-run:hover { color: var(--accent); background: var(--bg-tertiary); }
    .task-run:disabled { opacity: 0.3; cursor: not-allowed; }
    .task-toggle-btn:hover { color: var(--accent); background: var(--bg-tertiary); }
    .task-delete:hover { color: var(--red); background: var(--red-muted); }

    /* ── Thread section ───────────── */
    .thread-section {
      flex: 1;
      overflow-y: auto;
    }
    .thread-list {
      padding: 8px;
    }

    .thread-item {
      padding: 10px 12px;
      border-radius: var(--radius);
      cursor: pointer;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
      border: 1px solid transparent;
      position: relative;
    }
    .thread-item:hover {
      background: var(--bg-hover);
    }
    .thread-item.active {
      background: var(--accent-muted);
      border-color: var(--accent);
    }

    .thread-state {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .thread-state.started { background: var(--green); }
    .thread-state.stopping { background: var(--yellow); }
    .thread-state.stopped { background: var(--text-muted); }
    .thread-state.error { background: var(--red); }
    .thread-state.creating,
    .thread-state.pending-build,
    .thread-state.starting { background: var(--orange); animation: pulse 1.5s infinite; }

    .thread-info {
      flex: 1;
      min-width: 0;
    }
    .thread-name {
      font-size: 12.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
      letter-spacing: 0.1px;
    }
    .thread-date {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .thread-delete {
      width: 20px;
      height: 20px;
      border: none;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 4px;
      font-size: 12px;
      display: none;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
    }
    .thread-item:hover .thread-delete { display: flex; }
    .thread-delete:hover { color: var(--red); background: var(--bg-tertiary); }

    /* ── Footer ───────────────────── */
    .sidebar-footer {
      padding: 12px;
      border-top: 1px solid var(--border);
    }

    .btn-new-thread {
      width: 100%;
      padding: 8px;
      border: 1px dashed var(--border);
      background: transparent;
      color: var(--accent);
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
      font-family: inherit;
    }
    .btn-new-thread:hover {
      border-color: var(--accent);
      background: var(--accent-muted);
    }

    /* ── Empty state ──────────────── */
    .empty {
      padding: 16px;
      color: var(--text-muted);
      font-size: 13px;
      text-align: center;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;

  constructor() {
    super();
    this.threads = [];
    this.tasks = [];
    this.selectedThreadId = null;
    this.daytonaConfigured = false;
  }

  // ── Event dispatchers ─────────────────────────────────────────────────────

  _fire(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  _onNewTask() {
    this._fire('create-task');
  }

  _onNewThread() {
    this._fire('create-thread');
  }

  _onSelectThread(id) {
    this._fire('select-thread', { threadId: id });
  }

  _onDeleteThread(id, e) {
    e.stopPropagation();
    this._fire('delete-thread', { threadId: id });
  }

  _onRunTask(name, e) {
    e.stopPropagation();
    this._fire('run-task', { name });
  }

  _onToggleTask(name, e) {
    e.stopPropagation();
    this._fire('toggle-task', { name });
  }

  _onDeleteTask(name, e) {
    e.stopPropagation();
    this._fire('delete-task', { name });
  }

  _onSelectTask(name) {
    this._fire('select-thread', { threadId: name });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div class="sidebar-header">
        <h1>pi-daytona-ux</h1>
        <span class="badge ${classMap({ hidden: !this.daytonaConfigured })}">● Daytona</span>
      </div>

      <div class="task-section">
        <div class="section-header">
          <span>Tasks</span>
          <button class="btn-icon" @click=${this._onNewTask} title="New task">+</button>
        </div>
        <div class="task-list">
          ${this.tasks.length === 0
            ? html`<div class="empty">No tasks yet.</div>`
            : this.tasks.map(t => this._renderTask(t))
          }
        </div>
      </div>

      <div class="thread-section">
        <div class="section-header"><span>Threads</span></div>
        <div class="thread-list">
          ${this.threads.length === 0
            ? html`<div class="empty">No threads yet.<br>Create one below.</div>`
            : this.threads.map(t => this._renderThread(t))
          }
        </div>
      </div>

      <div class="sidebar-footer">
        <button class="btn-new-thread" @click=${this._onNewThread}>+ New Thread</button>
      </div>
    `;
  }

  _renderTask(task) {
    const isActive = this.selectedThreadId && this._taskSandboxId(task.name) === this.selectedThreadId;
    return html`
      <div class="task-item ${classMap({ active: isActive })}"
           @click=${() => this._onSelectTask(task.name)}>
        <div class="task-row">
          <span class="task-state ${task.enabled ? 'enabled' : 'disabled'}"></span>
          <span class="task-name">${task.name}</span>
          ${task.running ? html`<span class="task-running">● running</span>` : ''}
          <span class="task-cron">${task.cron}</span>
        </div>
        <div class="task-row task-meta">
          <span>Last: ${formatDate(task.lastRun) || 'never'}</span>
          <button class="task-run"
                  ?disabled=${task.running}
                  @click=${(e) => this._onRunTask(task.name, e)}
                  title="Run now">▶</button>
          <button class="task-toggle-btn"
                  @click=${(e) => this._onToggleTask(task.name, e)}
                  title=${task.enabled ? 'Disable' : 'Enable'}>${task.enabled ? '⏸' : '▶'}</button>
          <button class="task-delete"
                  @click=${(e) => this._onDeleteTask(task.name, e)}
                  title="Delete">×</button>
        </div>
      </div>
    `;
  }

  _taskSandboxId(taskName) {
    // Read from the global map; the app component populates this.
    return window._taskSandboxMap?.get(taskName);
  }

  _renderThread(thread) {
    const stateClass = thread.state || 'unknown';
    const name = stripPrefix(thread.name);
    const isActive = thread.id === this.selectedThreadId;

    return html`
      <div class="thread-item ${classMap({ active: isActive })}"
           @click=${() => this._onSelectThread(thread.id)}>
        <span class="thread-state ${stateClass}"></span>
        <div class="thread-info">
          <div class="thread-name">${name}</div>
          <div class="thread-date">${formatDate(thread.lastActivityAt || thread.createdAt)}</div>
        </div>
        <button class="thread-delete"
                @click=${(e) => this._onDeleteThread(thread.id, e)}
                title="Delete thread">&times;</button>
      </div>
    `;
  }
}

customElements.define('pi-sidebar', PiSidebar);
