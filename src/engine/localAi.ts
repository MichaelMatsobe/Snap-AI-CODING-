/**
 * Snap! Atelier — 100% free, tokenless, in-browser AI.
 *
 * Runs a small open-source LLM (Qwen2.5-0.5B / SmolLM2-360M, ONNX) directly on
 * the user's device via Transformers.js — like Ollama, but inside the browser:
 * no API key, no tokens, no quotas, and it works offline once the model has
 * been downloaded and cached by the browser.
 *
 * The @huggingface/transformers package (a few MB) is dynamically imported so
 * the app shell stays fast — only this module ever pulls it into the bundle.
 */

export type LocalAiStatus =
  | { state: 'idle' }
  | { state: 'loading'; progress: number; file?: string; text: string }
  | { state: 'ready'; model: string; device: 'webgpu' | 'wasm' }
  | { state: 'generating'; model: string }
  | { state: 'error'; message: string };

type Listener = (s: LocalAiStatus) => void;

const listeners = new Set<Listener>();
let status: LocalAiStatus = { state: 'idle' };
const setStatus = (s: LocalAiStatus) => {
  status = s;
  for (const l of listeners) l(s);
};

/** Subscribe to local-AI status changes (returns an unsubscribe fn). */
export function subscribeLocalAi(fn: Listener): () => void {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

export function getLocalAiStatus(): LocalAiStatus {
  return status;
}

// ── Model catalogue & preferences ─────────────────────────────────────────

export interface LocalAiModelOption {
  id: string;
  label: string;
  note: string;
  sizeHint: string;
}

export const LOCAL_AI_MODELS: LocalAiModelOption[] = [
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    label: 'Qwen2.5 · 0.5B',
    note: 'Best quality for its size — recommended',
    sizeHint: '~400 MB',
  },
  {
    id: 'HuggingFaceTB/SmolLM2-360M-Instruct',
    label: 'SmolLM2 · 360M',
    note: 'Smallest & fastest on phones',
    sizeHint: '~250 MB',
  },
];

export type LocalAiMode = 'auto' | 'on' | 'off';

const MODEL_KEY = 'snap.localAi.model';
const MODE_KEY = 'snap.localAi.mode';

export function getLocalAiModel(): string {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (v && LOCAL_AI_MODELS.some((m) => m.id === v)) return v;
  } catch {
    /* storage blocked */
  }
  return LOCAL_AI_MODELS[0].id;
}

export function setLocalAiModel(id: string): void {
  try {
    localStorage.setItem(MODEL_KEY, id);
  } catch {
    /* storage blocked */
  }
}

export function getLocalAiMode(): LocalAiMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch {
    /* storage blocked */
  }
  return 'auto';
}

export function setLocalAiMode(m: LocalAiMode): void {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* storage blocked */
  }
}

// ── Runtime ───────────────────────────────────────────────────────────────

/** WebGPU is much faster; without it we fall back to WASM (works everywhere). */
export function hasWebGpu(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!((navigator as Navigator & { gpu?: unknown }).gpu)
  );
}

/** Ask the browser to keep the model cache (don't evict under storage pressure). */
function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    /* not supported */
  }
}
requestPersistentStorage();

interface GeneratedChunk {
  generated_text?: string;
}

type GeneratorFn = (
  input: { role: string; content: string }[],
  opts?: {
    max_new_tokens?: number;
    temperature?: number;
    do_sample?: boolean;
    top_p?: number;
    return_full_text?: boolean;
  }
) => Promise<GeneratedChunk[]>;

let pipe: GeneratorFn | null = null;
let loadedModelId = '';
// True once the runtime + model have loaded successfully in this session.
let sessionReady = false;

/**
 * Cheap check used by Auto mode: only auto-fallback to local AI if the model
 * is already on this device (loaded this session or present in the browser
 * Cache API). First-time downloads are large (~100–400 MB), so they should
 * happen deliberately (Settings → Download model now), not silently mid-chat.
 */
export async function isLocalAiCached(modelId: string = getLocalAiModel()): Promise<boolean> {
  if (sessionReady || status.state === 'ready' || status.state === 'generating') return true;
  try {
    if (typeof caches === 'undefined') return false;
    const names = await caches.keys();
    for (const name of names) {
      if (!/transformers|hf[-_]|onnx/i.test(name)) continue;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const k of keys) {
        const url = k.url;
        if (url.includes('onnx') || url.includes(encodeURIComponent(modelId))) return true;
      }
    }
  } catch {
    /* Cache API unavailable — treat as not cached */
  }
  return false;
}

async function loadPipeline(modelId: string): Promise<GeneratorFn> {
  setStatus({ state: 'loading', progress: 0, text: 'Starting local AI…' });
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Always fetch model weights from the HuggingFace CDN (never local files),
    // and let the browser Cache API hold them so repeat visits are instant.
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const devices = hasWebGpu()
      ? ([
          { device: 'webgpu', dtype: 'q4' },
          { device: 'wasm', dtype: 'q8' },
        ] as const)
      : ([{ device: 'wasm', dtype: 'q8' }] as const);

    const onProgress = (p: { status?: string; file?: string; progress?: number }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const pct = Math.min(99.9, Math.max(0, p.progress * 100));
        setStatus({
          state: 'loading',
          progress: pct,
          file: p.file,
          text: `Downloading ${p.file ?? 'model'}… ${pct.toFixed(0)}%`,
        });
      }
    };

    let lastErr: unknown = null;
    for (const { device, dtype } of devices) {
      try {
        const p = await pipeline('text-generation', modelId, {
          device,
          dtype,
          progress_callback: onProgress,
        });
        return p as unknown as GeneratorFn;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load the local model';
    setStatus({ state: 'error', message });
    throw err;
  }
}

/**
 * Generate a reply entirely on the device. Downloads the model on first use
 * (progress is surfaced through subscribeLocalAi), then answers instantly.
 */
export async function generateLocalAi(
  messages: { role: string; content: string }[],
  opts?: {
    modelId?: string;
    maxNewTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const modelId = opts?.modelId || getLocalAiModel();
  if (!pipe || loadedModelId !== modelId) {
    pipe = await loadPipeline(modelId);
    loadedModelId = modelId;
    sessionReady = true;
  }
  setStatus({ state: 'generating', model: modelId });
  try {
    const out = await pipe(messages, {
      max_new_tokens: opts?.maxNewTokens ?? 240,
      temperature: opts?.temperature ?? 0.7,
      do_sample: true,
      top_p: 0.9,
      return_full_text: false,
    });
    const text = out?.[0]?.generated_text?.trim() ?? '';
    if (!text) throw new Error('Local model returned an empty response');
    return text;
  } finally {
    setStatus({ state: 'ready', model: modelId, device: hasWebGpu() ? 'webgpu' : 'wasm' });
  }
}

/** Download + warm the model now (no chat involved). Returns a status message. */
export async function preloadLocalAi(): Promise<{ ok: boolean; message: string }> {
  try {
    await generateLocalAi([{ role: 'user', content: 'hi' }], { maxNewTokens: 4 });
    return {
      ok: true,
      message: `Local AI is ready — the model is cached on this device.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Local AI failed to load.',
    };
  }
}
