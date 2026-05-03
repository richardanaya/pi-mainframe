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
      background: var(--neutral-100, #fafafa);
    }

    /* ── Header ───────────────────── */
    .chat-header {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--size-4, 16px);
      border-bottom: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      background: var(--neutral-100, #fafafa);
    }
    .thread-meta {
      display: flex;
      align-items: center;
      gap: var(--size-2, 8px);
    }
    .thread-name {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-0, 13px);
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-3, 1.5px);
      color: var(--neutral-800, #333);
    }

    /* ── Messages ─────────────────── */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: var(--size-4, 16px);
      display: flex;
      flex-direction: column;
      gap: var(--size-3, 12px);
    }

    .message {
      max-width: 85%;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .message.user {
      align-self: flex-end;
    }
    .message.assistant {
      align-self: flex-start;
    }

    .message-role {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 9px);
      font-weight: var(--font-weight-6, 600);
      color: var(--neutral-600, #666);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4, 2px);
    }

    .message-content {
      padding: var(--size-2, 8px) var(--size-3, 12px);
      line-height: var(--font-lineheight-4, 1.6);
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--font-body, sans-serif);
      font-size: var(--font-size-1, 14px);
      color: var(--neutral-800, #333);
    }

    .message.user .message-content {
      background: rgba(166,200,225,0.15);
      border: var(--border-size-1, 1px) solid var(--atmos-primary, #a6c8e1);
    }

    .message.assistant .message-content {
      background: var(--neutral-100, #fafafa);
      border: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      box-shadow: var(--inner-shadow-0);
    }

    /* ── Composer ─────────────────── */
    .composer {
      padding: var(--size-3, 12px) var(--size-4, 16px);
      border-top: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      background: var(--neutral-100, #fafafa);
      display: flex;
      gap: var(--size-2, 8px);
      align-items: flex-end;
    }

    .composer thx-textarea {
      flex: 1;
    }

    /* ── Empty state ──────────────── */
    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: var(--neutral-600, #666);
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-0, 12px);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4, 2px);
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
    this._textareaRef = createRef();
  }

  updated(changed) {
    if (changed.has('messages') || changed.has('isStreaming')) {
      this._scrollToBottom();
    }
    if (changed.has('visible') && this.visible) {
      setTimeout(() => {
        const ta = this._textareaRef.value;
        if (ta) ta.focus();
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
    const textarea = this.renderRoot.querySelector('thx-textarea');
    if (!textarea) return;
    const text = (textarea.value || '').trim();
    if (!text) return;
    textarea.value = '';
    this.dispatchEvent(new CustomEvent('send-prompt', {
      detail: { message: text },
      bubbles: true,
      composed: true,
    }));
  }

  _onDeleteThread() {
    this.dispatchEvent(new CustomEvent('delete-current-thread', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="chat-header">
        <div class="thread-meta">
          <span class="thread-name">${this.threadName}</span>
          ${this.isStreaming
            ? html`<thx-spinner size="sm" variant="crt" spinner-style="dots"></thx-spinner>`
            : ''}
        </div>
        <div class="chat-actions">
          <thx-button size="sm" variant="ghost" @click=${this._onDeleteThread}>
            DELETE
          </thx-button>
        </div>
      </div>

      <div class="messages" ${ref(this._messagesRef)}>
        ${this.messages.map(msg => this._renderMessage(msg))}
        ${this.isStreaming && !this.messages.some(m => m.role === 'assistant')
          ? html`<thx-spinner size="md" variant="crt" spinner-style="dots"></thx-spinner>`
          : ''}
      </div>

      <div class="composer">
        <thx-textarea
          placeholder="SEND A MESSAGE..."
          rows="2"
          resize="none"
          ?disabled=${this.inputDisabled || this.isStreaming}
          @keydown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._onSend(); } }}
        ></thx-textarea>
        <thx-button
          variant="primary"
          ?disabled=${this.inputDisabled || this.isStreaming}
          @click=${this._onSend}>
          SEND
        </thx-button>
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
        <div class="message-role" style="align-self:center;color:var(--neutral-600,#666)">
          ${msg.content}
        </div>`;
    }

    const roleLabel = msg.role === 'user' ? 'YOU' : 'PI';

    return html`
      <div class="message ${msg.role}">
        <span class="message-role">${roleLabel}</span>
        <div class="message-content">${msg.content}</div>
      </div>`;
  }
}

customElements.define('pi-chat-view', PiChatView);
