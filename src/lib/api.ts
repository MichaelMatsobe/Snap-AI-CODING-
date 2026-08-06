/** Client API helpers for Snap! Technical Atelier */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  requiresKey: boolean;
  note?: string;
}

const BASE = '/api';

const DEFAULT_TIMEOUT_MS = 15_000;
const AI_TIMEOUT_MS = 90_000;

/** Fetch wrapper with an AbortController timeout + typed JSON error parsing. */
async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function healthCheck(): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>(`${BASE}/health`);
}

export async function listAiProviders(): Promise<ProviderInfo[]> {
  const data = await fetchJson<{ providers?: ProviderInfo[] }>(`${BASE}/ai/providers`);
  return data.providers || [];
}

export async function aiChat(
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    max_tokens?: number;
    system?: string;
  }
): Promise<ChatResponse> {
  return fetchJson<ChatResponse>(
    `${BASE}/ai/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        system: options?.system,
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
      }),
    },
    AI_TIMEOUT_MS
  );
}

export async function listRemoteProjects(): Promise<
  Array<{ id: string; name: string; updatedAt: string }>
> {
  try {
    const data = await fetchJson<{ projects?: Array<{ id: string; name: string; updatedAt: string }> }>(
      `${BASE}/projects`
    );
    return data.projects || [];
  } catch {
    return [];
  }
}

export async function saveRemoteProject(
  id: string,
  name: string,
  data: unknown
): Promise<void> {
  await fetchJson<unknown>(`${BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  });
}

export async function loadRemoteProject(id: string): Promise<unknown | null> {
  try {
    const row = await fetchJson<{ data?: unknown }>(`${BASE}/projects/${id}`);
    return row.data ?? null;
  } catch {
    return null;
  }
}

// ── In-app terminal (background console) ────────────────────────────────
export interface TerminalResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  killed?: boolean;
  durationMs: number;
}

/** Run one shell command in the project root and return its output. */
export async function runTerminalCommand(command: string): Promise<TerminalResult> {
  return fetchJson<TerminalResult>(
    `${BASE}/terminal/exec`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    },
    110_000 // builds can take a while
  );
}
