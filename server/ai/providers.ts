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
export const pollinations: Provider = {
  id: 'pollinations',
  name: 'Pollinations',
  requiresKey: false,
  isConfigured: () => true,
  async chat({ messages, temperature = 0.7, max_tokens = 1024 }) {
    // Prefer OpenAI-compatible path on text.pollinations.ai (no key)
    try {
      return await openaiCompatibleChat(
        'https://text.pollinations.ai',
        undefined,
        'openai',
        messages,
        temperature,
        max_tokens,
        'pollinations',
        'Pollinations'
      );
    } catch {
      // Fallback: simple GET text endpoint
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const prompt = lastUser?.content || 'Hello';
      const res = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
        { method: 'GET' }
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
