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
      background: var(--neutral-100, #fafafa);
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

    .message thx-card {
      --neutral-100: #fafafa;
    }

    .message.user thx-card {
      --neutral-100: rgba(166,200,225,0.15);
    }

    /* ── Message actions ──────────── */
    .message-actions {
      display: flex;
      gap: var(--size-1, 4px);
      align-items: center;
      opacity: 0;
      transition: opacity var(--duration-quick-2, 0.15s);
      padding-left: 2px;
    }
    .message:hover .message-actions,
    .message-actions:focus-within {
      opacity: 1;
    }

    /* ── Tool messages ────────────── */
    .tool-details {
      --details-open-border: var(--atmos-primary, #a6c8e1);
    }
    .tool-details.success {
      --details-open-border: rgba(166,200,225,0.5);
    }
    .tool-details.error {
      --details-open-border: var(--accent-error, #d44000);
    }

    .tool-summary {
      display: flex;
      align-items: center;
      gap: var(--size-2, 8px);
      width: 100%;
    }
    .tool-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tool-section-label {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 9px);
      font-weight: var(--font-weight-6, 600);
      text-transform: uppercase;
      letter-spacing: var(--font-letterspacing-4, 2px);
      color: var(--neutral-600, #666);
      margin: var(--size-2, 8px) 0 var(--size-1, 4px);
    }
    .tool-section-label:first-child { margin-top: 0; }

    .tool-section-content {
      font-family: var(--font-mono, monospace);
      font-size: var(--font-size-00, 10px);
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--neutral-600, #666);
      background: rgba(0,0,0,0.02);
      border: var(--border-size-1, 1px) solid rgba(0,0,0,0.06);
      padding: var(--size-2, 8px) var(--size-3, 12px);
      max-height: 250px;
      overflow-y: auto;
      line-height: var(--font-lineheight-3, 1.5);
    }

    /* ── Composer ─────────────────── */
    .composer {
      padding: var(--size-3, 12px) var(--size-4, 16px);
      border-top: var(--border-size-1, 1px) solid rgba(0,0,0,0.08);
      background: var(--neutral-100, #fafafa);
      display: flex;
      gap: var(--size-2, 8px);
      align-items: stretch;
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
    this._audio = null;
    this._playingContent = null;
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

  render() {
    return html`
      <div class="messages" ${ref(this._messagesRef)}>
        ${this.messages.map(msg => this._renderMessage(msg))}
        ${this.isStreaming && !this.messages.some(m => m.role === 'assistant')
          ? html`<thx-spinner size="md" variant="crt" spinner-style="dots"></thx-spinner>`
          : ''}
      </div>

      <div class="composer">
        <thx-textarea
          stretch
          placeholder="SEND A MESSAGE..."
          rows="2"
          resize="none"
          ?disabled=${this.inputDisabled || this.isStreaming}
          @keydown=${(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._onSend(); } }}
        ></thx-textarea>
        <thx-button
          stretch
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
      const status = msg.status || 'success';
      const statusVariant = status === 'running' ? 'pulse'
        : status === 'error' ? 'error' : 'success';
      const statusLabel = status === 'running' ? 'EXEC'
        : status === 'error' ? 'FAIL' : 'OK';
      const req = msg.request && Object.keys(msg.request).length > 0
        ? JSON.stringify(msg.request, null, 2)
        : '{}';
      return html`
        <thx-details class="tool-details ${status}">
          <div slot="summary" class="tool-summary">
            <span class="tool-name">${msg.toolName || 'unknown'}</span>
            <thx-badge variant=${statusVariant}>${statusLabel}</thx-badge>
          </div>
          <div class="tool-section-label">REQUEST</div>
          <div class="tool-section-content">${req}</div>
          ${status === 'running'
            ? html`<div class="tool-section-label">RESPONSE</div>
                   <div class="tool-section-content"><thx-spinner size="sm" variant="crt" spinner-style="dots"></thx-spinner> EXECUTING…</div>`
            : html`<div class="tool-section-label">RESPONSE</div>
                   <div class="tool-section-content">${msg.response || '(EMPTY)'}</div>`}
        </thx-details>`;
    }

    if (msg.role === 'system') {
      return html`
        <div class="message-role" style="align-self:center;color:var(--neutral-600,#666)">
          ${msg.content}
        </div>`;
    }

    const roleLabel = msg.role === 'user' ? 'YOU' : 'PI';
    const isPlaying = this._playingContent === msg.content;

    return html`
      <div class="message ${msg.role}">
        <span class="message-role">${roleLabel}</span>
        <thx-card>${msg.content}</thx-card>
        ${msg.role === 'assistant' ? html`
          <div class="message-actions">
            <thx-icon-button
              size="sm"
              variant="ghost"
              label="Copy"
              @click=${() => this._copyText(msg.content)}>
              <thx-icon name="copy" size="sm" color="secondary"></thx-icon>
            </thx-icon-button>
            <thx-icon-button
              size="sm"
              variant="ghost"
              label=${isPlaying ? 'Stop' : 'Listen'}
              ?pulse=${isPlaying}
              @click=${() => this._toggleTTS(msg.content)}>
              <thx-icon name=${isPlaying ? 'close' : 'volumeUp'} size="sm" color=${isPlaying ? 'primary' : 'secondary'}></thx-icon>
            </thx-icon-button>
          </div>
        ` : ''}
      </div>`;
  }

  _copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  async _toggleTTS(text) {
    // Stop if already playing this message
    if (this._playingContent === text && this._audio) {
      this._audio.pause();
      this._audio = null;
      this._playingContent = null;
      this.requestUpdate();
      return;
    }

    // Stop any other playing audio first
    if (this._audio) {
      this._audio.pause();
      this._audio = null;
      this._playingContent = null;
    }

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error('TTS error:', err.error || response.statusText);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (this._audio === audio) {
          this._audio = null;
          this._playingContent = null;
          this.requestUpdate();
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (this._audio === audio) {
          this._audio = null;
          this._playingContent = null;
          this.requestUpdate();
        }
      };

      this._audio = audio;
      this._playingContent = text;
      this.requestUpdate();
      await audio.play();
    } catch (err) {
      console.error('TTS playback failed:', err);
      this._audio = null;
      this._playingContent = null;
      this.requestUpdate();
    }
  }
}

customElements.define('pi-chat-view', PiChatView);
