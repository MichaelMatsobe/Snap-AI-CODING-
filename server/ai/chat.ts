import { PROVIDER_CHAIN } from './providers.js';
import type { ChatMessage, ChatRequest, ChatResult, ProviderInfo } from './types.js';

function buildMessages(req: ChatRequest): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (req.system) {
    out.push({ role: 'system', content: req.system });
  }
  for (const m of req.messages) {
    if (m.role === 'system' || m.role === 'user' || m.role === 'assistant') {
      out.push({ role: m.role, content: String(m.content || '') });
    }
  }
  return out;
}

/**
 * Try each configured provider in order until one succeeds.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResult> {
  const messages = buildMessages(req);
  const temperature = req.temperature ?? 0.7;
  const max_tokens = req.max_tokens ?? 1024;

  const errors: string[] = [];

  for (const provider of PROVIDER_CHAIN) {
    if (!provider.isConfigured()) continue;

    try {
      const result = await provider.chat({ messages, temperature, max_tokens });
      if (result.content) return result;
      errors.push(`${provider.name}: empty content`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider.name}: ${msg}`);
      console.warn(`[ai] ${provider.id} failed:`, msg);
    }
  }

  throw new Error(
    `All AI providers failed. Tried: ${errors.join(' | ') || 'none configured'}. ` +
      `Tip: add GROQ_API_KEY or OPENROUTER_API_KEY (or run Ollama) for a reliable provider — Pollinations' free tier is frequently rate-limited.`
  );
}

export async function listProviders(): Promise<ProviderInfo[]> {
  const infos: ProviderInfo[] = [];

  for (const p of PROVIDER_CHAIN) {
    let available = p.isConfigured();

    // Quick reachability check for Ollama
    if (p.id === 'ollama' && available) {
      try {
        const base = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
        const r = await fetch(`${base}/api/tags`, {
          signal: AbortSignal.timeout(1500),
        });
        available = r.ok;
      } catch {
        available = false;
      }
    }

    // Pollinations is always "available" as first free option
    if (p.id === 'pollinations') available = true;

    infos.push({
      id: p.id,
      name: p.name,
      available,
      requiresKey: p.requiresKey,
      note:
        p.id === 'pollinations'
          ? 'No API key · public free tier'
          : p.id === 'ollama'
            ? 'Local · unlimited when running'
            : undefined,
    });
  }

  return infos;
}
