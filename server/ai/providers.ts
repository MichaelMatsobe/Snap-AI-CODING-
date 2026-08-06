/**
 * Free / unlimited-friendly AI providers with automatic failover.
 * Priority:
 *  1. Pollinations (no API key — public text endpoint)
 *  2. Ollama local (truly unlimited)
 *  3. Groq free tier (optional key)
 *  4. OpenRouter free models (optional key)
 *  5. Custom OpenAI-compatible endpoint
 */

import type { ChatMessage, ChatResult } from './types.js';

export interface Provider {
  id: string;
  name: string;
  requiresKey: boolean;
  isConfigured: () => boolean;
  chat: (opts: {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
  }) => Promise<ChatResult>;
}

async function openaiCompatibleChat(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  max_tokens: number,
  providerId: string,
  providerName: string
): Promise<ChatResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: false,
    }),
    // Give up after 60s so the failover chain keeps moving.
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${providerName} ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: ChatResult['usage'];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${providerName}: empty response`);

  return {
    content: content.trim(),
    provider: providerId,
    model: data.model || model,
    usage: data.usage,
  };
}

/** Pollinations — no key required (anonymous tier works for text) */
/**
 * The Pollinations anonymous tier hard-rejects any request that includes a
 * `system` role message (or persona-style phrasing) with HTTP 402
 * "Payment Required / API key budget too low" — only plain conversational
 * user text is served. Since our app always attaches AI_SCRIPT_SYSTEM, we
 * drop system messages before sending so the free tier actually responds.
 * Keyed providers (Groq/OpenRouter) still receive the full system prompt
 * and are the reliable path for script building.
 */
export const pollinations: Provider = {
  id: 'pollinations',
  name: 'Pollinations',
  requiresKey: false,
  isConfigured: () => true,
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    // Primary: OpenAI-compatible endpoint. The documented base is
    // https://text.pollinations.ai/openai (the SDK appends /chat/completions) —
    // POSTing to text.pollinations.ai/chat/completions does NOT exist (404).
    const safe = messages.filter((m) => m.role !== 'system');
    const attempt = () =>
      openaiCompatibleChat(
        'https://text.pollinations.ai/openai',
        undefined,
        'openai',
        safe,
        temperature,
        max_tokens,
        'pollinations',
        'Pollinations'
      );
    try {
      return await attempt();
    } catch {
      // The anonymous tier is flaky (rate limits / payment-required on some
      // requests) — retry once after a short pause before falling back.
      try {
        await new Promise((r) => setTimeout(r, 800));
        return await attempt();
      } catch {
        // Last resort: legacy GET text endpoint (short prompts only — long ones
        // get rejected with 402 by the anonymous tier).
        const lastUser = [...safe].reverse().find((m) => m.role === 'user');
        const prompt = (lastUser?.content || 'Hello').slice(0, 500);
        const res = await fetch(
          `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
          { method: 'GET', signal: AbortSignal.timeout(60_000) }
        );
        if (!res.ok) throw new Error(`Pollinations GET ${res.status}`);
        const content = (await res.text()).trim();
        if (!content) throw new Error('Pollinations: empty GET response');
        return {
          content,
          provider: 'pollinations',
          model: 'openai',
        };
      }
    }
  },
};

/** Ollama — local, unlimited */
export const ollama: Provider = {
  id: 'ollama',
  name: 'Ollama (local)',
  requiresKey: false,
  isConfigured: () => true,
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2';
    return openaiCompatibleChat(
      `${base}/v1`,
      'ollama',
      model,
      messages,
      temperature,
      max_tokens,
      'ollama',
      'Ollama'
    );
  },
};

/** Groq free tier */
export const groq: Provider = {
  id: 'groq',
  name: 'Groq',
  requiresKey: true,
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    const key = process.env.GROQ_API_KEY!;
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    return openaiCompatibleChat(
      'https://api.groq.com/openai/v1',
      key,
      model,
      messages,
      temperature,
      max_tokens,
      'groq',
      'Groq'
    );
  },
};

/** OpenRouter free models */
export const openrouter: Provider = {
  id: 'openrouter',
  name: 'OpenRouter',
  requiresKey: true,
  isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY),
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    const key = process.env.OPENROUTER_API_KEY!;
    const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
    return openaiCompatibleChat(
      'https://openrouter.ai/api/v1',
      key,
      model,
      messages,
      temperature,
      max_tokens,
      'openrouter',
      'OpenRouter'
    );
  },
};

/** Custom OpenAI-compatible endpoint */
export const custom: Provider = {
  id: 'custom',
  name: 'Custom endpoint',
  requiresKey: false,
  isConfigured: () => Boolean(process.env.CUSTOM_AI_BASE_URL),
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    const base = process.env.CUSTOM_AI_BASE_URL!;
    const key = process.env.CUSTOM_AI_API_KEY;
    const model = process.env.CUSTOM_AI_MODEL || 'default';
    return openaiCompatibleChat(
      base,
      key,
      model,
      messages,
      temperature,
      max_tokens,
      'custom',
      'Custom'
    );
  },
};

/** Ordered failover chain */
export const PROVIDER_CHAIN: Provider[] = [
  pollinations,
  ollama,
  groq,
  openrouter,
  custom,
];
