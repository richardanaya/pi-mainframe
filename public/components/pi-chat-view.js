import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ref, createRef } from 'lit/directives/ref.js';
import './pi-tool-accordion.js';

export class PiChatView extends LitElement {
  static properties = {
    threadName: { type: String },
    threadStatus: { type: String },
    messages: { type: Array },
    isStreaming: { type: Boolean },
    inputDisabled: { type: Boolean },
    visible: { type: Boolean },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* ── Header ───────────────────── */
    .chat-header {
      height: 48px;
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-primary);
    }
    .thread-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .thread-name {
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.1px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }
    .status-dot.started { background: var(--green); }
    .status-dot.streaming { background: var(--accent); animation: pulse 1s infinite; }

    .chat-actions {
      display: flex;
      gap: 8px;
    }
    .chat-actions button {
      padding: 4px 12px;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }
    .chat-actions button:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .btn-danger:hover {
      background: var(--red-muted) !important;
      color: var(--red) !important;
    }

    /* ── Messages ─────────────────── */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      max-width: 85%;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .message.user {
      align-self: flex-end;
    }
    .message.assistant {
      align-self: flex-start;
    }

    .message-role {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .message-content {
      padding: 10px 14px;
      border-radius: var(--radius);
      line-height: 1.65;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
      font-family: var(--font-sans);
    }

    .message.user .message-content {
      background: var(--accent-muted);
      border: 1px solid var(--accent);
      color: var(--text-primary);
      border-bottom-right-radius: 2px;
    }

    .message.assistant .message-content {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-bottom-left-radius: 2px;
    }

    .message-tool {
      font-size: 11px;
      color: var(--yellow);
      background: var(--yellow-muted);
      padding: 4px 10px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 2px 0;
    }
    .message-tool.error {
      color: var(--red);
      background: var(--red-muted);
    }

    .streaming-indicator {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
      padding: 4px 0;
    }

    .spinner {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 13px;
      padding: 8px;
    }
    .spinner::before {
      content: '';
      width: 12px;
      height: 12px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--text-muted);
      font-size: 13px;
    }

    /* ── Composer ─────────────────── */
    .composer {
      height: 80px;
      min-height: 80px;
      border-top: 1px solid var(--border);
      padding: 12px 16px;
      display: flex;
      gap: 8px;
      background: var(--bg-primary);
    }

    .prompt-input {
      flex: 1;
      resize: none;
      border: 1px solid var(--border);
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-radius: var(--radius);
      padding: 8px 12px;
      font-family: var(--font-sans);
      font-size: 13px;
      font-weight: 400;
      line-height: 1.5;
      transition: border-color 0.15s;
    }
    .prompt-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .prompt-input:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .prompt-input::placeholder {
      color: var(--text-muted);
    }

    .btn-send {
      width: 60px;
      border: none;
      background: var(--accent);
      color: #0c1117;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      font-family: var(--font-sans);
      transition: background 0.15s;
    }
    .btn-send:hover { background: var(--accent-hover); }
    .btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  constructor() {
    super();
    this.threadName = '';
    this.threadStatus = '';
    this.messages = [];
    this.isStreaming = false;
    this.inputDisabled = false;
    this.visible = false;

    this._messagesRef = createRef();
    this._inputRef = createRef();
  }

  updated(changed) {
    if (changed.has('messages') || changed.has('isStreaming')) {
      this._scrollToBottom();
    }
    if (changed.has('visible') && this.visible) {
      // Focus input when chat becomes visible
      setTimeout(() => {
        const input = this._inputRef.value;
        if (input) input.focus();
      }, 0);
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const el = this._messagesRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  _onSend() {
    const input = this._inputRef.value;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.dispatchEvent(new CustomEvent('send-prompt', {
      detail: { message: text },
      bubbles: true,
      composed: true,
    }));
  }

  _onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._onSend();
    }
  }

  _onDeleteThread() {
    this.dispatchEvent(new CustomEvent('delete-current-thread', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const statusClasses = {
      'status-dot': true,
      started: this.threadStatus === 'started',
      streaming: this.isStreaming,
    };

    return html`
      <div class="chat-header">
        <div class="thread-meta">
          <span class="thread-name">${this.threadName}</span>
          <span class=${classMap(statusClasses)}></span>
        </div>
        <div class="chat-actions">
          <button class="btn-danger" @click=${this._onDeleteThread} title="Delete thread">Delete</button>
        </div>
      </div>

      <div class="messages" ${ref(this._messagesRef)}>
        ${this.messages.map(msg => this._renderMessage(msg))}
        ${this.isStreaming
          ? html`<div class="spinner">pi is thinking…</div>`
          : ''}
      </div>

      <div class="composer">
        <textarea class="prompt-input"
                  placeholder="Send a message..."
                  rows="2"
                  ?disabled=${this.inputDisabled || this.isStreaming}
                  ${ref(this._inputRef)}
                  @keydown=${this._onKeydown}></textarea>
        <button class="btn-send"
                ?disabled=${this.inputDisabled || this.isStreaming}
                @click=${this._onSend}>Send</button>
      </div>
    `;
  }

  _renderMessage(msg) {
    if (msg.role === 'tool') {
      return html`
        <pi-tool-accordion
          .toolName=${msg.toolName || 'unknown'}
          .status=${msg.status || 'success'}
          .request=${msg.request || {}}
          .response=${msg.response || ''}
        ></pi-tool-accordion>`;
    }

    if (msg.role === 'system') {
      return html`
        <div class="message-tool ${classMap({ error: !!msg.isError })}">
          ${msg.content}
        </div>`;
    }

    const roleLabel = msg.role === 'user' ? 'You' : 'pi';

    return html`
      <div class="message ${msg.role}">
        <span class="message-role">${roleLabel}</span>
        <div class="message-content">${msg.content}</div>
      </div>`;
  }
}

customElements.define('pi-chat-view', PiChatView);
