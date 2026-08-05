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

export async function healthCheck(): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function listAiProviders(): Promise<ProviderInfo[]> {
  const res = await fetch(`${BASE}/ai/providers`);
  if (!res.ok) throw new Error('Failed to list providers');
  const data = await res.json();
  return data.providers || [];
}

export async function aiChat(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      temperature: options?.temperature,
      max_tokens: options?.max_tokens,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `AI chat failed (${res.status})`);
  }

  return res.json();
}
