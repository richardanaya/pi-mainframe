// ── API helper ───────────────────────────────────────────────────────────────

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Sandboxes ───────────────────────────────────────────────────────────────

export function fetchSandboxes() {
  return api('/api/sandboxes');
}

export function getSandbox(id) {
  return api(`/api/sandboxes/${id}`);
}

export function startSandbox(id) {
  return api(`/api/sandboxes/${id}/start`, { method: 'POST' });
}

export function deleteSandbox(id) {
  return api(`/api/sandboxes/${id}`, { method: 'DELETE' });
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function createSession(opts) {
  return api('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export function disposeSession(id) {
  return api(`/api/sessions/${id}`, { method: 'DELETE' });
}

export function fetchMessages(sessionId) {
  return api(`/api/sessions/${sessionId}/messages`);
}

/** Returns a fetch Response for SSE streaming consumption. */
export function promptStream(sessionId, message) {
  return fetch(`/api/sessions/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export function fetchTasks() {
  return api('/api/tasks');
}

export function createTask(name, cron, prompt) {
  return api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ name, cron, prompt }),
  });
}

export function runTask(name) {
  return api(`/api/tasks/${encodeURIComponent(name)}/run`, { method: 'POST' });
}

export function enableTask(name) {
  return api(`/api/tasks/${encodeURIComponent(name)}/enable`, { method: 'POST' });
}

export function disableTask(name) {
  return api(`/api/tasks/${encodeURIComponent(name)}/disable`, { method: 'POST' });
}

export function deleteTask(name) {
  return api(`/api/tasks/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ── Utilities ───────────────────────────────────────────────────────────────

export function stripPrefix(name) {
  if (!name) return 'Untitled';
  return name.replace(/^pi-daytona-/, '');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function extractMessageText(msg) {
  if (!msg.content) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((c) => c.text || '').join('');
  }
  return '';
}

export function getThreadFromURL() {
  return new URLSearchParams(window.location.search).get('thread') || null;
}

export function updateURL(threadId) {
  const url = new URL(window.location);
  if (threadId) {
    url.searchParams.set('thread', threadId);
  } else {
    url.searchParams.delete('thread');
  }
  history.replaceState(null, '', url);
}
