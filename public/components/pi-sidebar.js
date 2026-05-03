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
      background: var(--neutral-100, #fafafa);
      border-right: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      user-select: none;
    }

    /* ── Header ───────────────────── */
    .sidebar-header {
      padding: var(--size-3, 12px) var(--size-4, 16px);
      border-bottom: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--size-2, 8px);
    }
    .logo {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }
    .sidebar-header h1 {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-0, 13px);
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4, 2px);
      color: var(--neutral-800, #333);
      margin: 0;
    }

    /* ── Section headers ──────────── */
    .section-label {
      padding: var(--size-3, 12px) var(--size-4, 16px);
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 10px);
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-5, 3px);
      color: var(--neutral-600, #666);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* ── Task section ─────────────── */
    .task-section {
      border-bottom: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      padding-bottom: var(--size-2, 8px);
    }

    .task-list {
      padding: 0 var(--size-2, 8px);
    }

    .task-item {
      padding: var(--size-2, 8px) var(--size-3, 12px);
      margin-bottom: 2px;
      cursor: pointer;
      transition: background var(--duration-quick-2, 0.15s);
      border-left: var(--border-size-2, 2px) solid transparent;
    }
    .task-item:hover {
      background: rgba(0,0,0,0.02);
    }
    .task-item.active {
      background: rgba(166,200,225,0.1);
      border-left-color: var(--atmos-primary, #a6c8e1);
    }

    .task-row {
      display: flex;
      align-items: center;
      gap: var(--size-2, 8px);
    }
    .task-meta {
      padding-left: 18px;
      font-size: var(--font-size-00, 10px);
      color: var(--neutral-600, #666);
      font-family: var(--font-mono, monospace);
    }

    .task-name {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: var(--font-weight-5, 500);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2, 1px);
      color: var(--neutral-800, #333);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .task-cron {
      font-size: var(--font-size-00, 9px);
      color: var(--atmos-secondary, #707e91);
      font-family: var(--font-mono, monospace);
      background: rgba(0,0,0,0.03);
      padding: 1px 6px;
    }

    /* ── Thread section ───────────── */
    .thread-section {
      flex: 1;
      overflow-y: auto;
    }
    .thread-list {
      padding: 0 var(--size-2, 8px);
    }

    .thread-item {
      padding: var(--size-2, 8px) var(--size-3, 12px);
      margin-bottom: 2px;
      cursor: pointer;
      transition: background var(--duration-quick-2, 0.15s);
      display: flex;
      align-items: center;
      gap: var(--size-2, 8px);
      border-left: var(--border-size-2, 2px) solid transparent;
    }
    .thread-item:hover {
      background: rgba(0,0,0,0.02);
    }
    .thread-item.active {
      background: rgba(166,200,225,0.1);
      border-left-color: var(--atmos-primary, #a6c8e1);
    }

    .thread-info {
      flex: 1;
      min-width: 0;
    }
    .thread-name {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: var(--font-weight-5, 500);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-1, 0.5px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--neutral-800, #333);
    }
    .thread-date {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 9px);
      color: var(--neutral-600, #666);
      margin-top: 2px;
    }

    .thread-delete {
      width: 20px;
      height: 20px;
      border: none;
      background: none;
      color: var(--neutral-600, #666);
      cursor: pointer;
      font-size: 12px;
      display: none;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .thread-item:hover .thread-delete { display: flex; }
    .thread-delete:hover { color: var(--accent-error, #d44000); }

    /* ── Footer ───────────────────── */
    .sidebar-footer {
      padding: var(--size-3, 12px);
      border-top: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
    }

    .empty {
      padding: var(--size-4, 16px);
      color: var(--neutral-600, #666);
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 10px);
      text-align: center;
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2, 1px);
    }
  `;

  constructor() {
    super();
    this.threads = [];
    this.tasks = [];
    this.selectedThreadId = null;
    this.daytonaConfigured = false;
  }

  _fire(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true,
    }));
  }

  _onNewTask() { this._fire('create-task'); }
  _onNewThread() { this._fire('create-thread'); }
  _onSelectThread(id) { this._fire('select-thread', { threadId: id }); }
  _onDeleteThread(id, e) { e.stopPropagation(); this._fire('delete-thread', { threadId: id }); }
  _onRunTask(name, e) { e.stopPropagation(); this._fire('run-task', { name }); }
  _onToggleTask(name, e) { e.stopPropagation(); this._fire('toggle-task', { name }); }
  _onDeleteTask(name, e) { e.stopPropagation(); this._fire('delete-task', { name }); }
  _onSelectTask(name) { this._fire('select-thread', { threadId: name }); }

  render() {
    return html`
      <div class="sidebar-header">
        <img class="logo" src="/future_pi.png" alt="pi" />
        <h1>pi-mainframe</h1>
        ${this.daytonaConfigured
          ? html`<thx-badge variant="pulse">DAYTONA</thx-badge>`
          : ''}
      </div>

      <div class="task-section">
        <div class="section-label">
          <span>TASKS</span>
          <thx-button size="sm" variant="ghost" @click=${this._onNewTask}>+</thx-button>
        </div>
        <div class="task-list">
          ${this.tasks.length === 0
            ? html`<div class="empty">No tasks yet</div>`
            : this.tasks.map(t => this._renderTask(t))
          }
        </div>
      </div>

      <div class="thread-section">
        <div class="section-label">THREADS</div>
        <div class="thread-list">
          ${this.threads.length === 0
            ? html`<div class="empty">No threads yet<br>Create one below</div>`
            : this.threads.map(t => this._renderThread(t))
          }
        </div>
      </div>

      <div class="sidebar-footer">
        <thx-button block variant="outline-primary" @click=${this._onNewThread}>
          + NEW THREAD
        </thx-button>
      </div>
    `;
  }

  _renderTask(task) {
    const isActive = this.selectedThreadId && this._taskSandboxId(task.name) === this.selectedThreadId;
    const statusVariant = task.running ? 'pulse' : (task.enabled ? 'success' : 'inactive');

    return html`
      <div class="task-item ${classMap({ active: isActive })}"
           @click=${() => this._onSelectTask(task.name)}>
        <div class="task-row">
          <thx-badge variant=${statusVariant} pill icon-only></thx-badge>
          <span class="task-name">${task.name}</span>
          <span class="task-cron">${task.cron}</span>
        </div>
        <div class="task-row task-meta">
          <span>LAST: ${formatDate(task.lastRun) || 'NEVER'}</span>
          <thx-button size="sm" variant="ghost" ?disabled=${task.running}
            @click=${(e) => this._onRunTask(task.name, e)}>▶</thx-button>
          <thx-button size="sm" variant="ghost"
            @click=${(e) => this._onToggleTask(task.name, e)}>${task.enabled ? '⏸' : '▶'}</thx-button>
          <thx-button size="sm" variant="ghost"
            @click=${(e) => this._onDeleteTask(task.name, e)}>×</thx-button>
        </div>
      </div>
    `;
  }

  _taskSandboxId(taskName) {
    return window._taskSandboxMap?.get(taskName);
  }

  _renderThread(thread) {
    const name = stripPrefix(thread.name);
    const isActive = thread.id === this.selectedThreadId;

    return html`
      <div class="thread-item ${classMap({ active: isActive })}"
           @click=${() => this._onSelectThread(thread.id)}>
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
