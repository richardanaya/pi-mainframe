import { LitElement, html, css } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { ref, createRef } from 'lit/directives/ref.js';

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
      font-size: 14px;
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
      background: #f8514933 !important;
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
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .message-content {
      padding: 10px 14px;
      border-radius: var(--radius);
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 13px;
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
      background: #d2992233;
      padding: 4px 10px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin: 2px 0;
    }
    .message-tool.error {
      color: var(--red);
      background: #f8514933;
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
      font-family: inherit;
      font-size: 13px;
      line-height: 1.5;
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
      color: #fff;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
    }
    .btn-send:hover { opacity: 0.85; }
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
    if (msg.role === 'system' || msg.role === 'tool') {
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
