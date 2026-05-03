import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

export class PiToolAccordion extends LitElement {
  static properties = {
    toolName: { type: String },
    status: { type: String },
    request: { type: Object },
    response: { type: String },
    expanded: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      margin: 4px 0;
      font-size: 12px;
    }

    .accordion {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .accordion.running { border-left: 3px solid var(--accent); }
    .accordion.success { border-left: 3px solid var(--green); }
    .accordion.error   { border-left: 3px solid var(--red); }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      background: var(--bg-tertiary);
      user-select: none;
    }
    .header:hover { background: var(--bg-hover); }

    .status-icon {
      font-size: 13px;
      flex-shrink: 0;
      width: 16px;
      text-align: center;
    }

    .tool-name {
      font-weight: 500;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.2px;
    }

    .chevron {
      transition: transform 0.2s;
      color: var(--text-muted);
      font-size: 10px;
      flex-shrink: 0;
    }
    .chevron.open { transform: rotate(90deg); }

    .body {
      display: none;
      padding: 12px;
      background: var(--bg-primary);
      border-top: 1px solid var(--border);
    }
    .body.open { display: block; }

    .section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 5px;
      letter-spacing: 0.8px;
      font-family: var(--font-sans);
    }

    .section-content {
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 400;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text-secondary);
      background: var(--bg-primary);
      border: 1px solid var(--border);
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      margin-bottom: 10px;
      max-height: 300px;
      overflow-y: auto;
    }
    .section-content:last-child { margin-bottom: 0; }

    .placeholder {
      color: var(--text-muted);
      font-style: italic;
      padding: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
    }
  `;

  constructor() {
    super();
    this.toolName = '';
    this.status = 'running';
    this.request = {};
    this.response = '';
    this.expanded = false;
  }

  _toggle() {
    this.expanded = !this.expanded;
  }

  _formatRequest(obj) {
    if (!obj || Object.keys(obj).length === 0) return '{}';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  render() {
    return html`
      <div class="accordion ${this.status}">
        <div class="header" @click=${this._toggle}>
          <span class="status-icon">
            ${this.status === 'running'
              ? html`<span class="spinner"></span>`
              : this.status === 'error' ? '❌' : '✓'}
          </span>
          <span class="tool-name">${this.toolName}</span>
          <span class="chevron ${classMap({ open: this.expanded })}">▶</span>
        </div>
        <div class="body ${classMap({ open: this.expanded })}">
          <div class="section-label">Request</div>
          <div class="section-content">${this._formatRequest(this.request)}</div>
          ${this.status === 'running'
            ? html`<div class="placeholder">Running…</div>`
            : html`
                <div class="section-label">Response</div>
                <div class="section-content">${this.response || '(empty)'}</div>
              `}
        </div>
      </div>
    `;
  }
}

customElements.define('pi-tool-accordion', PiToolAccordion);
