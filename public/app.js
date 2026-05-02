/**
 * pi-computer web UI
 *
 * Features:
 *   - Left sidebar showing threads (Daytona sandboxes prefixed pi-daytona-)
 *   - Click a thread to open a chat session
 *   - Create new threads (provisions Daytona sandboxes)
 *   - SSE streaming for real-time agent output
 */

// ── State ───────────────────────────────────────────────────────────────────

/** All threads (Daytona sandboxes) */
let threads = [];

/** Active pi session ID → { threadId, ... } */
let activeSession = null;

/** Currently selected thread ID */
let selectedThreadId = null;

/** Is the agent currently streaming? */
let isStreaming = false;

// ── URL helpers ────────────────────────────────────────────────────────────

function getThreadFromURL() {
  return new URLSearchParams(window.location.search).get("thread") || null;
}

function updateURL(threadId) {
  const url = new URL(window.location);
  if (threadId) {
    url.searchParams.set("thread", threadId);
  } else {
    url.searchParams.delete("thread");
  }
  history.replaceState(null, "", url);
}

// ── DOM refs ────────────────────────────────────────────────────────────────

const $sidebar = document.getElementById("sidebar");
const $threadList = document.getElementById("thread-list");
const $chatView = document.getElementById("chat-view");
const $threadName = document.getElementById("thread-name");
const $threadStatus = document.getElementById("thread-status");
const $messages = document.getElementById("messages");
const $promptInput = document.getElementById("prompt-input");
const $btnSend = document.getElementById("btn-send");
const $btnNewThread = document.getElementById("btn-new-thread");
const $btnCompact = document.getElementById("btn-compact");
const $btnDeleteThread = document.getElementById("btn-delete-thread");
const $daytonaBadge = document.getElementById("daytona-badge");

// ── Utility ─────────────────────────────────────────────────────────────────

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString();
}

function stripPrefix(name) {
  if (!name) return "Untitled";
  return name.replace(/^pi-daytona-/, "");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function extractMessageText(msg) {
  if (!msg.content) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((c) => c.text || "").join("");
  }
  return "";
}

// ── Threads ─────────────────────────────────────────────────────────────────

async function loadThreads() {
  try {
    const data = await api("/api/sandboxes");
    threads = data.sandboxes || [];

    // Show/hide Daytona badge
    if (data.daytonaConfigured) {
      $daytonaBadge.classList.remove("hidden");
    } else {
      $daytonaBadge.classList.add("hidden");
    }

    renderThreads();

    // If selected thread disappeared, reset
    if (selectedThreadId && !threads.find((t) => t.id === selectedThreadId)) {
      selectThread(null);
    }
  } catch (err) {
    console.error("Failed to load sandboxes:", err);
  }
}

function renderThreads() {
  $threadList.innerHTML = "";

  if (threads.length === 0) {
    $threadList.innerHTML =
      '<div style="padding:16px;color:var(--text-muted);font-size:13px;text-align:center;">No threads yet.<br>Create one below.</div>';
    return;
  }

  for (const t of threads) {
    const el = document.createElement("div");
    el.className = "thread-item" + (t.id === selectedThreadId ? " active" : "");
    el.dataset.threadId = t.id;

    const stateClass = t.state || "unknown";
    const name = stripPrefix(t.name);

    el.innerHTML = `
      <span class="thread-state ${stateClass}"></span>
      <div class="thread-info">
        <div class="thread-name">${escapeHtml(name)}</div>
        <div class="thread-date">${formatDate(t.lastActivityAt || t.createdAt)}</div>
      </div>
      <button class="thread-delete" data-thread-id="${t.id}" title="Delete thread">&times;</button>
    `;

    el.addEventListener("click", (e) => {
      // Don't trigger if delete button clicked
      if (e.target.closest(".thread-delete")) return;
      selectThread(t.id);
    });

    $threadList.appendChild(el);
  }

  // Delete button handlers
  $$(".thread-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const tid = btn.dataset.threadId;
      await deleteThread(tid);
    });
  });
}

async function createThread(name) {
  try {
    const displayName = name || "thread-" + Math.random().toString(36).slice(2, 8);

    // Create a pi session with sandbox mode.
    // pi-daytona's session_start hook provisions the Daytona sandbox
    // (creates it if not found, or connects if it exists).
    const session = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        sandbox: true,
        sandboxName: displayName,
        tools: "coding",
        thinkingLevel: "off",
        label: displayName,
      }),
    });

    // Poll until the sandbox appears in the listing
    let sandboxId = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      await loadThreads();
      const match = threads.find((t) =>
        t.name?.toLowerCase().includes(displayName.toLowerCase())
      );
      if (match && match.state === "started") {
        sandboxId = match.id;
        break;
      }
    }

    if (sandboxId) {
      // Dispose the provisioning session, then open a clean one for the sandbox
      await api(`/api/sessions/${session.id}`, { method: "DELETE" }).catch(() => {});
      selectThread(sandboxId);
    }
  } catch (err) {
    alert("Failed to create thread: " + err.message);
  }
}

async function deleteThread(tid) {
  if (!confirm(`Delete thread "${stripPrefix(threads.find((t) => t.id === tid)?.name)}"?`)) return;

  // Optimistically remove from sidebar immediately
  threads = threads.filter((t) => t.id !== tid);
  renderThreads();

  if (selectedThreadId === tid) selectThread(null);

  try {
    // Dispose pi session if active for this thread
    if (activeSession && activeSession.threadId === tid) {
      await api(`/api/sessions/${activeSession.sessionId}`, { method: "DELETE" }).catch(() => {});
      activeSession = null;
    }

    await api(`/api/sandboxes/${tid}`, { method: "DELETE" });
    await loadThreads();
  } catch (err) {
    alert("Failed to delete: " + err.message);
    // Re-sync in case the optimistic removal was wrong
    await loadThreads();
  }
}

// ── Sessions ────────────────────────────────────────────────────────────────

async function selectThread(threadId) {
  selectedThreadId = threadId;
  updateURL(threadId);

  if (!threadId) {
    $chatView.classList.add("hidden");
    renderThreads();
    return;
  }

  $chatView.classList.remove("hidden");
  renderThreads();

  let thread = threads.find((t) => t.id === threadId);
  if (thread) {
    $threadName.textContent = stripPrefix(thread.name);
    $threadStatus.className = "status-dot " + (thread.state || "");
  } else {
    $threadName.textContent = threadId;
  }

  // Clear messages
  $messages.innerHTML = "";

  // Dispose previous session if any
  if (activeSession) {
    await api(`/api/sessions/${activeSession.sessionId}`, { method: "DELETE" }).catch(() => {});
    activeSession = null;
  }

  // ── Auto-start if sandbox is stopped ──
  if (thread && thread.state === "stopped") {
    addSystemMessage("Sandbox is stopped — starting it…");
    try {
      await api(`/api/sandboxes/${threadId}/start`, { method: "POST" });

      // Poll until started (max ~60s)
      let started = false;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await loadThreads();
        thread = threads.find((t) => t.id === threadId);
        if (thread && thread.state === "started") {
          started = true;
          $threadStatus.className = "status-dot started";
          break;
        }
      }

      if (!started) {
        addSystemMessage("Sandbox failed to start in time", true);
        return;
      }
      addSystemMessage("Sandbox started");
    } catch (err) {
      addSystemMessage(`Failed to start sandbox: ${err.message}`, true);
      return;
    }
  }

  // Create a pi session connected to this sandbox.
  // pi-daytona's session_start hook finds the existing sandbox by ID/name
  // and connects the session's tools (bash, read, write, etc.) to it.
  try {
    const session = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        sandbox: true,
        sandboxName: threadId,
        tools: "coding",
        thinkingLevel: "off",
        label: stripPrefix(thread?.name || threadId),
      }),
    });
    activeSession = { sessionId: session.id, threadId };

    // Load existing messages
    const msgData = await api(`/api/sessions/${session.id}/messages`);
    $messages.innerHTML = "";
    for (const msg of msgData.messages || []) {
      const text = extractMessageText(msg);
      if (msg.role === "user") {
        appendMessage("user", text || JSON.stringify(msg.content));
      } else if (msg.role === "assistant") {
        appendMessage("assistant", text);
      }
    }

    addSystemMessage(`Connected to sandbox — ${thread?.name || threadId}`);
  } catch (err) {
    addSystemMessage(`Session error: ${err.message}`, true);
  }
}

// ── Messaging ───────────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const el = document.createElement("div");
  el.className = "message " + role;
  el.innerHTML = `
    <span class="message-role">${role === "user" ? "You" : "pi"}</span>
    <div class="message-content">${escapeHtml(text)}</div>
  `;
  $messages.appendChild(el);
  scrollToBottom();
}

function addSystemMessage(text, isError = false) {
  const el = document.createElement("div");
  el.className = isError ? "message-tool error" : "message-tool";
  el.textContent = text;
  $messages.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  $messages.scrollTop = $messages.scrollHeight;
}

function setStreamingIndicator(visible) {
  let el = $messages.querySelector(".streaming-indicator");
  if (visible && !el) {
    el = document.createElement("div");
    el.className = "streaming-indicator";
    el.innerHTML = '<span class="spinner">pi is thinking…</span>';
    $messages.appendChild(el);
    scrollToBottom();
  } else if (!visible && el) {
    el.remove();
  }
}

// ── SSE Prompting ───────────────────────────────────────────────────────────

async function sendPrompt(message) {
  if (!activeSession) {
    addSystemMessage("No active session", true);
    return;
  }

  if (isStreaming) {
    addSystemMessage("Already streaming", true);
    return;
  }

  isStreaming = true;
  $btnSend.disabled = true;
  $threadStatus.classList.add("streaming");

  appendMessage("user", message);
  setStreamingIndicator(true);

  // Create a streaming assistant bubble
  let assistantEl = null;
  let assistantText = "";

  try {
    const res = await fetch(`/api/sessions/${activeSession.sessionId}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));

          if (eventType === "message-update") {
            const delta = data.assistantMessageEvent?.delta || "";
            if (delta) {
              setStreamingIndicator(false);
              if (!assistantEl) {
                assistantEl = appendAssistantBubble();
              }
              assistantText += delta;
              assistantEl.querySelector(".message-content").textContent = assistantText;
              scrollToBottom();
            }
          } else if (eventType === "tool-start") {
            addSystemMessage(`🔧 ${data.toolName}`);
          } else if (eventType === "tool-end") {
            if (data.isError) {
              addSystemMessage(`❌ ${data.toolName} error`, true);
            }
          } else if (eventType === "error") {
            addSystemMessage(data.error, true);
          }
        }
        if (line === "") eventType = "";
      }
    }

    setStreamingIndicator(false);
  } catch (err) {
    addSystemMessage(`Error: ${err.message}`, true);
    setStreamingIndicator(false);
  } finally {
    isStreaming = false;
    $btnSend.disabled = false;
    $threadStatus.classList.remove("streaming");
    $promptInput.focus();
  }
}

function appendAssistantBubble() {
  const el = document.createElement("div");
  el.className = "message assistant";
  el.innerHTML = `
    <span class="message-role">pi</span>
    <div class="message-content"></div>
  `;
  $messages.appendChild(el);
  scrollToBottom();
  return el;
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function doCompact() {
  if (!activeSession) return;
  try {
    addSystemMessage("Compacting context…");
    await api(`/api/sessions/${activeSession.sessionId}/compact`, { method: "POST" });
    addSystemMessage("Context compacted");
  } catch (err) {
    addSystemMessage(`Compact failed: ${err.message}`, true);
  }
}

// ── Event bindings ──────────────────────────────────────────────────────────

$btnNewThread.addEventListener("click", () => {
  const name = prompt("Thread name (or leave empty for auto-name):");
  if (name !== null) createThread(name || undefined);
});

$btnDeleteThread.addEventListener("click", () => {
  if (selectedThreadId) deleteThread(selectedThreadId);
});

$btnSend.addEventListener("click", () => {
  const text = $promptInput.value.trim();
  if (!text) return;
  $promptInput.value = "";
  sendPrompt(text);
});

$btnCompact.addEventListener("click", doCompact);

$promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $btnSend.click();
  }
});

// ── Init ────────────────────────────────────────────────────────────────────

(async () => {
  await loadThreads();

  // Auto-select thread from URL on initial load
  const threadFromURL = getThreadFromURL();
  if (threadFromURL && threads.find((t) => t.id === threadFromURL)) {
    selectThread(threadFromURL);
  }

  // Handle browser back/forward
  window.addEventListener("popstate", () => {
    const id = getThreadFromURL();
    if (id && id !== selectedThreadId) {
      selectThread(id);
    } else if (!id && selectedThreadId) {
      selectThread(null);
    }
  });
})();
