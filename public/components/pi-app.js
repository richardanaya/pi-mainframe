import { LitElement, html, css } from 'lit';
import './pi-sidebar.js';
import './pi-chat-view.js';
import * as API from './pi-api.js';

export class PiApp extends LitElement {
  static properties = {
    _threads: { state: true },
    _tasks: { state: true },
    _selectedThreadId: { state: true },
    _activeSession: { state: true },
    _isStreaming: { state: true },
    _daytonaConfigured: { state: true },
    _messages: { state: true },
    _threadStatus: { state: true },
    _threadName: { state: true },
    _inputDisabled: { state: true },
    _dialogOpen: { state: true },
    _dialogType: { state: true },
    _dialogData: { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      height: 100vh;
    }

    main {
      flex: 1;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--neutral-100, #fafafa);
    }

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
    this._threads = [];
    this._tasks = [];
    this._selectedThreadId = null;
    this._activeSession = null;
    this._isStreaming = false;
    this._daytonaConfigured = false;
    this._messages = [];
    this._threadStatus = '';
    this._threadName = '';
    this._inputDisabled = false;
    this._dialogOpen = false;
    this._dialogType = '';
    this._dialogData = null;

    // Non-reactive internal state
    this._taskEventSource = null;
    this._previousRunningTask = null;
    this._taskSandboxMap = new Map();
  }

  connectedCallback() {
    super.connectedCallback();
    window._taskSandboxMap = this._taskSandboxMap;
    this._init();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanup();
    window._taskSandboxMap = undefined;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════════════════════

  async _init() {
    await this._loadTasks();
    this._connectTaskStream();
    await this._loadThreads();
    this._checkURL();
    window.addEventListener('popstate', () => this._checkURL());
  }

  _cleanup() {
    if (this._taskEventSource) {
      this._taskEventSource.close();
      this._taskEventSource = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // URL routing
  // ═══════════════════════════════════════════════════════════════════════════

  _getThreadFromURL() {
    return API.getThreadFromURL();
  }

  _updateURL(threadId) {
    API.updateURL(threadId);
  }

  _checkURL() {
    const id = this._getThreadFromURL();
    if (id) {
      const isThread = this._threads.find((t) => t.id === id);
      const isTask = this._tasks.find((t) => t.name === id);
      if (isThread || isTask) {
        this._selectThread(id);
      }
    } else {
      this._selectedThreadId = null;
      this._threadName = '';
      this._messages = [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Thread management
  // ═══════════════════════════════════════════════════════════════════════════

  async _loadThreads() {
    try {
      const data = await API.fetchSandboxes();
      const allSandboxes = data.sandboxes || [];

      // Build task-name → sandbox-ID map
      const taskNames = new Set(this._tasks.map((t) => t.name));
      this._taskSandboxMap.clear();
      for (const s of allSandboxes) {
        const stripped = API.stripPrefix(s.name);
        if (taskNames.has(stripped)) {
          this._taskSandboxMap.set(stripped, s.id);
        }
      }

      // Filter threads (exclude task sandboxes & destroyed ones)
      this._threads = allSandboxes.filter(
        (s) =>
          !taskNames.has(API.stripPrefix(s.name)) &&
          s.state !== 'destroying' &&
          s.state !== 'destroyed',
      );

      this._daytonaConfigured = !!data.daytonaConfigured;

      // If selected thread vanished, reset
      if (
        this._selectedThreadId &&
        !this._threads.find((t) => t.id === this._selectedThreadId) &&
        ![...this._taskSandboxMap.values()].includes(this._selectedThreadId)
      ) {
        this._clearSelection();
      }
    } catch (err) {
      console.error('Failed to load sandboxes:', err);
    }
  }

  async _createThread(name) {
    try {
      const displayName = name || 'thread-' + Math.random().toString(36).slice(2, 8);

      const session = await API.createSession({
        sandbox: true,
        sandboxName: displayName,
        tools: 'coding',
        thinkingLevel: 'off',
        label: displayName,
      });

      // Poll until sandbox appears
      let sandboxId = null;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await this._loadThreads();
        const match = this._threads.find((t) =>
          t.name?.toLowerCase().includes(displayName.toLowerCase()),
        );
        if (match && match.state === 'started') {
          sandboxId = match.id;
          break;
        }
      }

      if (sandboxId) {
        await API.disposeSession(session.id).catch(() => {});
        this._selectThread(sandboxId);
      }
    } catch (err) {
      alert('Failed to create thread: ' + err.message);
    }
  }

  async _deleteThread(tid) {
    const thread = this._threads.find((t) => t.id === tid);
    this._dialogType = 'confirmDeleteThread';
    this._dialogData = { threadId: tid, threadName: API.stripPrefix(thread?.name) };
    this._dialogOpen = true;
  }

  async _confirmDeleteThread() {
    const tid = this._dialogData?.threadId;
    this._closeDialog();
    if (!tid) return;

    // Optimistic removal
    this._threads = this._threads.filter((t) => t.id !== tid);

    if (this._selectedThreadId === tid) this._clearSelection();

    try {
      if (this._activeSession && this._activeSession.threadId === tid) {
        await API.disposeSession(this._activeSession.sessionId).catch(() => {});
        this._activeSession = null;
      }
      await API.deleteSandbox(tid);
      await this._loadThreads();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
      await this._loadThreads();
    }
  }

  _clearSelection() {
    this._selectedThreadId = null;
    this._threadName = '';
    this._threadStatus = '';
    this._messages = [];
    this._activeSession = null;
    this._updateURL(null);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Session selection
  // ═══════════════════════════════════════════════════════════════════════════

  async _selectThread(identifier) {
    let sandboxId = identifier;
    let displayName = identifier;
    let thread = this._threads.find((t) => t.id === identifier);

    // Check if identifier is a task name
    const taskSandboxId = this._taskSandboxMap.get(identifier);
    if (taskSandboxId) {
      sandboxId = taskSandboxId;
      displayName = identifier;
      thread = null;
    } else if (thread) {
      displayName = API.stripPrefix(thread.name);
    }

    this._selectedThreadId = sandboxId;
    this._updateURL(identifier);

    if (!identifier) return;

    this._threadName = displayName;
    this._threadStatus = thread ? (thread.state || '') : 'started';
    this._messages = [];

    // Dispose previous session
    if (this._activeSession) {
      await API.disposeSession(this._activeSession.sessionId).catch(() => {});
      this._activeSession = null;
    }

    // Auto-start stopped sandbox
    const isStopped =
      thread?.state === 'stopped' ||
      (taskSandboxId && (await API.getSandbox(sandboxId).then((s) => s.state).catch(() => null)) === 'stopped');

    if (isStopped) {
      this._addSystemMsg('Sandbox is stopped — starting it…');
      try {
        await API.startSandbox(sandboxId);
        let started = false;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          await this._loadThreads();
          const refreshed = this._threads.find((t) => t.id === sandboxId);
          if (refreshed && refreshed.state === 'started') {
            started = true;
            this._threadStatus = 'started';
            break;
          }
        }
        if (!started) {
          this._addSystemMsg('Sandbox failed to start in time', true);
          return;
        }
        this._addSystemMsg('Sandbox started');
      } catch (err) {
        this._addSystemMsg(`Failed to start sandbox: ${err.message}`, true);
        return;
      }
    }

    // Create pi session
    try {
      const session = await API.createSession({
        sandbox: true,
        sandboxName: sandboxId,
        tools: 'coding',
        thinkingLevel: 'off',
        label: displayName,
      });
      this._activeSession = { sessionId: session.id, threadId: sandboxId };

      // Load existing messages
      const msgData = await API.fetchMessages(session.id);
      this._messages = this._processHistoryMessages(msgData.messages);
      this._addSystemMsg(`Connected to sandbox — ${displayName}`);
    } catch (err) {
      this._addSystemMsg(`Session error: ${err.message}`, true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Messaging
  // ═══════════════════════════════════════════════════════════════════════════

  _addSystemMsg(text, isError = false) {
    this._messages = [...this._messages, { role: 'system', content: text, isError }];
  }

  /** Convert raw API messages to UI message objects, handling all roles.
   *  Tool calls and their results are paired into single accordion messages. */
  _processHistoryMessages(rawMessages) {
    const msgs = [];
    const pendingToolCalls = []; // toolCall blocks awaiting their toolResult

    for (const msg of rawMessages || []) {
      if (msg.role === 'user') {
        const text = API.extractMessageText(msg);
        msgs.push({ role: 'user', content: text || JSON.stringify(msg.content) });
      } else if (msg.role === 'assistant') {
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'toolCall') {
              pendingToolCalls.push(block);
            } else if (block.type === 'text') {
              const text = (block.text || '').trim();
              if (text) msgs.push({ role: 'assistant', content: text });
            }
            // Skip thinking blocks — they're internal reasoning
          }
        } else {
          const text = API.extractMessageText(msg);
          if (text) msgs.push({ role: 'assistant', content: text });
        }
      } else if (msg.role === 'toolResult') {
        // Pair with the matching pending tool call
        const tcIdx = pendingToolCalls.findIndex((tc) => tc.id === msg.toolCallId);
        const tc = tcIdx >= 0 ? pendingToolCalls[tcIdx] : null;
        if (tcIdx >= 0) pendingToolCalls.splice(tcIdx, 1);

        msgs.push({
          role: 'tool',
          toolName: msg.toolName || tc?.name || 'unknown',
          status: msg.isError ? 'error' : 'success',
          request: tc?.arguments || {},
          response: API.extractMessageText(msg),
        });
      }
    }

    // Any unmatched tool calls (shouldn't normally happen)
    for (const tc of pendingToolCalls) {
      msgs.push({
        role: 'tool',
        toolName: tc.name || 'unknown',
        status: 'running',
        request: tc.arguments || {},
        response: '',
      });
    }

    return msgs;
  }

  async _reloadMessages() {
    if (!this._activeSession) return;
    try {
      const msgData = await API.fetchMessages(this._activeSession.sessionId);
      this._messages = this._processHistoryMessages(msgData.messages);
    } catch (err) {
      console.error('Failed to reload messages:', err);
    }
  }

  async _sendPrompt(message) {
    if (!this._activeSession) {
      this._addSystemMsg('No active session', true);
      return;
    }
    if (this._isStreaming) {
      this._addSystemMsg('Already streaming', true);
      return;
    }

    this._isStreaming = true;
    this._inputDisabled = true;

    // Add user message immediately
    this._messages = [...this._messages, { role: 'user', content: message }];

    // Track live-streamed turn messages so we can replace them with canonical
    // data from the turn_end event (which matches the session-file format).
    let turnStartIndex = this._messages.length;
    let assistantMsgIndex = -1;
    let assistantText = '';
    let pendingToolMsgIndex = -1;  // live tool accordion to update on tool-end

    try {
      const res = await API.promptStream(this._activeSession.sessionId, message);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (eventType === 'message-update') {
              const ev = data.assistantMessageEvent || {};
              const subtype = ev.type || '';

              if (subtype === 'text_start' || subtype === 'text_delta') {
                // Live-stream text into a temporary assistant bubble
                const delta = ev.delta || '';
                if (assistantMsgIndex === -1) {
                  this._messages = [...this._messages, { role: 'assistant', content: '' }];
                  assistantMsgIndex = this._messages.length - 1;
                }
                assistantText += delta;
                const msgs = [...this._messages];
                msgs[assistantMsgIndex] = { ...msgs[assistantMsgIndex], content: assistantText };
                this._messages = msgs;
              } else if (subtype === 'toolcall_end') {
                // Create live accordion tool message (status: running)
                const tc = ev.toolCall;
                if (tc?.name) {
                  this._messages = [...this._messages, {
                    role: 'tool',
                    toolName: tc.name,
                    status: 'running',
                    request: tc.arguments || {},
                    response: '',
                  }];
                  pendingToolMsgIndex = this._messages.length - 1;
                }
              }
              // toolcall_start / toolcall_delta: ignore, we'll get canonical
              // data from turn_end

            } else if (eventType === 'tool-start') {
              // toolcall_end already shows the indicator; tool-start is redundant
            } else if (eventType === 'tool-end') {
              // Update live accordion with result status
              if (pendingToolMsgIndex >= 0) {
                const msgs = [...this._messages];
                msgs[pendingToolMsgIndex] = {
                  ...msgs[pendingToolMsgIndex],
                  status: data.isError ? 'error' : 'success',
                };
                this._messages = msgs;
              }
            } else if (eventType === 'turn-end') {
              // Canonical data — replace live-streamed turn messages
              const assistantMsg = data.message;
              const toolResults = data.toolResults || [];

              // Build canonical messages for this turn (same format as session file)
              const raw = [assistantMsg, ...toolResults];
              const canonical = this._processHistoryMessages(raw);

              // Replace live-streamed turn messages with canonical data
              this._messages = [
                ...this._messages.slice(0, turnStartIndex),
                ...canonical,
              ];

              // Reset for next turn
              turnStartIndex = this._messages.length;
              assistantMsgIndex = -1;
              assistantText = '';
              pendingToolMsgIndex = -1;

            } else if (eventType === 'error') {
              this._addSystemMsg(data.error, true);
            }
          }
          if (line === '') eventType = '';
        }
      }
    } catch (err) {
      this._addSystemMsg(`Error: ${err.message}`, true);
    } finally {
      this._isStreaming = false;
      this._inputDisabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Task management
  // ═══════════════════════════════════════════════════════════════════════════

  async _loadTasks() {
    try {
      const data = await API.fetchTasks();
      this._tasks = data.tasks || [];
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }

  _connectTaskStream() {
    if (this._taskEventSource) return;

    this._taskEventSource = new EventSource('/api/tasks/listen');

    this._taskEventSource.addEventListener('tasks', (e) => {
      try {
        const data = JSON.parse(e.data);
        this._tasks = data.tasks || [];

        const runningTask = this._tasks.find((t) => t.running);

        if (runningTask) {
          const sandboxId = this._taskSandboxMap.get(runningTask.name);
          if (sandboxId && this._selectedThreadId === sandboxId) {
            this._inputDisabled = true;
            if (this._previousRunningTask !== runningTask.name) {
              this._addSystemMsg(`Task "${runningTask.name}" is running…`);
            }
          }
        }

        if (this._previousRunningTask && !runningTask) {
          const sandboxId = this._taskSandboxMap.get(this._previousRunningTask);
          if (sandboxId && this._selectedThreadId === sandboxId && this._activeSession) {
            this._inputDisabled = false;
            this._addSystemMsg(`Task "${this._previousRunningTask}" completed — reloading history…`);
            this._reloadMessages();
          }
        }

        this._previousRunningTask = runningTask ? runningTask.name : null;
      } catch (err) {
        console.error('Task stream parse error:', err);
      }
    });

    this._taskEventSource.addEventListener('error', () => {
      this._taskEventSource?.close();
      this._taskEventSource = null;
      setTimeout(() => this._connectTaskStream(), 3000);
    });
  }

  async _createTask(name, cron, promptText) {
    try {
      await API.createTask(name, cron, promptText);
      await this._loadTasks();
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    }
  }

  async _runTask(name) {
    this._addSystemMsg(`Running task "${name}"...`);
    try {
      await API.runTask(name);
      this._addSystemMsg(`Task "${name}" completed`);
      await this._loadTasks();
    } catch (err) {
      this._addSystemMsg(`Task "${name}" failed: ${err.message}`, true);
    }
  }

  async _toggleTask(name) {
    const task = this._tasks.find((t) => t.name === name);
    if (!task) return;
    try {
      if (task.enabled) {
        await API.disableTask(name);
      } else {
        await API.enableTask(name);
      }
      await this._loadTasks();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }

  async _deleteTask(name) {
    this._dialogType = 'confirmDeleteTask';
    this._dialogData = { taskName: name };
    this._dialogOpen = true;
  }

  async _confirmDeleteTask() {
    const name = this._dialogData?.taskName;
    this._closeDialog();
    if (!name) return;
    try {
      await API.deleteTask(name);
      await this._loadTasks();
    } catch (err) {
      console.error('Delete task failed:', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Event handlers (from child components)
  // ═══════════════════════════════════════════════════════════════════════════

  _onSelectThread(e) { this._selectThread(e.detail.threadId); }
  _onDeleteThread(e) { this._deleteThread(e.detail.threadId); }

  _onCreateThread() {
    this._dialogType = 'createThread';
    this._dialogData = { name: '' };
    this._dialogOpen = true;
  }

  _submitCreateThread() {
    const name = this._dialogData?.name ?? '';
    this._closeDialog();
    this._createThread(name || undefined);
  }

  _onSendPrompt(e) { this._sendPrompt(e.detail.message); }

  _onCreateTask() {
    this._dialogType = 'createTask';
    this._dialogData = { name: '', cron: '', prompt: '' };
    this._dialogOpen = true;
  }

  _submitCreateTask() {
    const { name, cron, prompt } = this._dialogData || {};
    this._closeDialog();
    if (!name || !cron || !prompt) return;
    this._createTask(name, cron, prompt);
  }

  _closeDialog() {
    this._dialogOpen = false;
    this._dialogType = '';
    this._dialogData = null;
  }

  _onRunTask(e) { this._runTask(e.detail.name); }
  _onToggleTask(e) { this._toggleTask(e.detail.name); }
  _onDeleteTask(e) { this._deleteTask(e.detail.name); }

  // ═══════════════════════════════════════════════════════════════════════════
  // Dialog render helpers
  // ═══════════════════════════════════════════════════════════════════════════

  _renderDialog() {
    if (!this._dialogOpen) return '';

    if (this._dialogType === 'createThread') {
      return html`
        <thx-dialog .open=${true} header-label="NEW THREAD" size="sm" @toggle=${this._closeDialog}>
          <div style="display:flex;flex-direction:column;gap:var(--size-3,12px);">
            <thx-input
              placeholder="THREAD NAME (OR LEAVE EMPTY)"
              .value=${this._dialogData?.name || ''}
              @input=${(e) => { this._dialogData = { ...this._dialogData, name: e.target.value }; }}
              @keydown=${(e) => { if (e.key === 'Enter') this._submitCreateThread(); }}
            ></thx-input>
          </div>
          <div slot="footer">
            <thx-button variant="ghost" @click=${this._closeDialog}>CANCEL</thx-button>
            <thx-button variant="primary" @click=${this._submitCreateThread}>CREATE</thx-button>
          </div>
        </thx-dialog>
      `;
    }

    if (this._dialogType === 'createTask') {
      return html`
        <thx-dialog .open=${true} header-label="NEW TASK" size="md" @toggle=${this._closeDialog}>
          <div style="display:flex;flex-direction:column;gap:var(--size-3,12px);">
            <thx-input
              placeholder="TASK NAME"
              .value=${this._dialogData?.name || ''}
              @input=${(e) => { this._dialogData = { ...this._dialogData, name: e.target.value }; }}
            ></thx-input>
            <thx-input
              placeholder="CRON EXPRESSION (E.G. 0 9 * * *)"
              .value=${this._dialogData?.cron || ''}
              @input=${(e) => { this._dialogData = { ...this._dialogData, cron: e.target.value }; }}
            ></thx-input>
            <thx-textarea
              placeholder="PROMPT TO SEND"
              rows="3"
              resize="none"
              .value=${this._dialogData?.prompt || ''}
              @input=${(e) => { this._dialogData = { ...this._dialogData, prompt: e.target.value }; }}
            ></thx-textarea>
          </div>
          <div slot="footer">
            <thx-button variant="ghost" @click=${this._closeDialog}>CANCEL</thx-button>
            <thx-button variant="primary" @click=${this._submitCreateTask}>CREATE</thx-button>
          </div>
        </thx-dialog>
      `;
    }

    if (this._dialogType === 'confirmDeleteThread') {
      return html`
        <thx-dialog .open=${true} header-label="CONFIRM DELETION" size="sm" @toggle=${this._closeDialog}>
          <p>DELETE THREAD "${this._dialogData?.threadName}"?</p>
          <div slot="footer">
            <thx-button variant="ghost" @click=${this._closeDialog}>CANCEL</thx-button>
            <thx-button variant="error" @click=${this._confirmDeleteThread}>DELETE</thx-button>
          </div>
        </thx-dialog>
      `;
    }

    if (this._dialogType === 'confirmDeleteTask') {
      return html`
        <thx-dialog .open=${true} header-label="CONFIRM DELETION" size="sm" @toggle=${this._closeDialog}>
          <p>DELETE TASK "${this._dialogData?.taskName}"?</p>
          <div slot="footer">
            <thx-button variant="ghost" @click=${this._closeDialog}>CANCEL</thx-button>
            <thx-button variant="error" @click=${this._confirmDeleteTask}>DELETE</thx-button>
          </div>
        </thx-dialog>
      `;
    }

    return '';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  render() {
    return html`
      <pi-sidebar
        .threads=${this._threads}
        .tasks=${this._tasks}
        .selectedThreadId=${this._selectedThreadId}
        .daytonaConfigured=${this._daytonaConfigured}
        @select-thread=${this._onSelectThread}
        @create-thread=${this._onCreateThread}
        @delete-thread=${this._onDeleteThread}
        @create-task=${this._onCreateTask}
        @run-task=${this._onRunTask}
        @toggle-task=${this._onToggleTask}
        @delete-task=${this._onDeleteTask}
      ></pi-sidebar>

      <main>
        ${this._selectedThreadId
          ? html`
              <pi-chat-view
                .threadName=${this._threadName}
                .threadStatus=${this._threadStatus}
                .messages=${this._messages}
                .isStreaming=${this._isStreaming}
                .inputDisabled=${this._inputDisabled}
                .visible=${true}
                @send-prompt=${this._onSendPrompt}
              ></pi-chat-view>
            `
          : html`<div class="empty-state">Select a thread</div>`
        }
      </main>

      ${this._renderDialog()}
    `;
  }
}

customElements.define('pi-app', PiApp);
