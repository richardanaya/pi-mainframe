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
      margin: 2px 0;
    }

    .accordion {
      border-left: var(--border-size-2, 2px) solid transparent;
      background: rgba(0,0,0,0.01);
      transition: border-color var(--duration-moderate-1, 0.2s),
                  background var(--duration-moderate-1, 0.2s);
    }
    .accordion.running { border-left-color: var(--atmos-primary, #a6c8e1); }
    .accordion.success { border-left-color: rgba(166,200,225,0.5); }
    .accordion.error   { border-left-color: var(--accent-error, #d44000); }

    .header {
      display: flex;
      align-items: center;
      gap: var(--size-2, 8px);
      padding: var(--size-1, 4px) var(--size-3, 12px);
      cursor: pointer;
      user-select: none;
      transition: background var(--duration-quick-2, 0.15s);
    }
    .header:hover { background: rgba(0,0,0,0.03); }

    .chevron {
      font-family: var(--font-mono, monospace);
      font-size: 10px;
      color: var(--atmos-secondary, #707e91);
      transition: transform var(--duration-moderate-1, 0.2s);
      flex-shrink: 0;
    }
    .chevron.open { transform: rotate(90deg); }

    .tool-name {
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2, 1px);
      color: var(--atmos-primary, #a6c8e1);
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-badge {
      flex-shrink: 0;
      margin-left: auto;
    }

    .body {
      display: none;
      padding: var(--size-3, 12px);
      border-top: var(--border-size-1, 1px) solid rgba(0,0,0,0.06);
    }
    .body.open { display: block; }

    .section-label {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 9px);
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4, 2px);
      color: var(--neutral-600, #666);
      margin-bottom: var(--size-1, 4px);
    }

    .section-content {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 10px);
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--neutral-600, #666);
      background: rgba(0,0,0,0.02);
      border: var(--border-size-1, 1px) solid rgba(0,0,0,0.06);
      padding: var(--size-2, 8px) var(--size-3, 12px);
      margin-bottom: var(--size-2, 8px);
      max-height: 250px;
      overflow-y: auto;
      line-height: var(--font-lineheight-3, 1.5);
    }
    .section-content:last-child { margin-bottom: 0; }

    .placeholder {
      color: var(--neutral-600, #666);
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 10px);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-2, 1px);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .spinner {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 2px solid rgba(166,200,225,0.3);
      border-top-color: var(--atmos-primary, #a6c8e1);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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

  _toggle() { this.expanded = !this.expanded; }

  _formatRequest(obj) {
    if (!obj || Object.keys(obj).length === 0) return '{}';
    try { return JSON.stringify(obj, null, 2); }
    catch { return String(obj); }
  }

  render() {
    const statusVariant = this.status === 'running' ? 'pulse'
      : this.status === 'error' ? 'error' : 'success';

    return html`
      <div class="accordion ${this.status}">
        <div class="header" @click=${this._toggle}>
          <span class="chevron ${classMap({ open: this.expanded })}">▸</span>
          <span class="tool-name">${this.toolName}</span>
          <span class="status-badge">
            <thx-badge variant=${statusVariant}>
              ${this.status === 'running' ? 'EXEC' : this.status === 'error' ? 'FAIL' : 'OK'}
            </thx-badge>
          </span>
        </div>
        <div class="body ${classMap({ open: this.expanded })}">
          <div class="section-label">REQUEST</div>
          <div class="section-content">${this._formatRequest(this.request)}</div>
          ${this.status === 'running'
            ? html`<div class="placeholder"><span class="spinner"></span> EXECUTING…</div>`
            : html`
                <div class="section-label">RESPONSE</div>
                <div class="section-content">${this.response || '(EMPTY)'}</div>
              `}
        </div>
      </div>
    `;
  }
}

customElements.define('pi-tool-accordion', PiToolAccordion);
