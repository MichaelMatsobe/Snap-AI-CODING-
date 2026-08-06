import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Server, KeyRound, CheckCircle2, XCircle, Cpu, ExternalLink, Download } from 'lucide-react';
import { listAiProviders, type ProviderInfo } from '../lib/api';
import {
  getLocalAiMode,
  getLocalAiModel,
  getLocalAiStatus,
  LOCAL_AI_MODELS,
  preloadLocalAi,
  setLocalAiMode,
  setLocalAiModel,
  subscribeLocalAi,
  type LocalAiMode,
  type LocalAiStatus,
} from '../engine/localAi';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_HELP: Record<string, string> = {
  pollinations: 'No API key — public free tier, used first.',
  ollama: 'Local Ollama server. Set OLLAMA_BASE_URL / OLLAMA_MODEL.',
  groq: 'Set GROQ_API_KEY (console.groq.com, free tier).',
  openrouter: 'Set OPENROUTER_API_KEY and prefer :free models.',
  custom: 'Any OpenAI-compatible endpoint via CUSTOM_AI_BASE_URL.',
};

export function SettingsModal({ open, onClose }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Local in-browser AI (tokenless, offline).
  const [localMode, setLocalMode] = useState<LocalAiMode>(getLocalAiMode());
  const [localModel, setLocalModel] = useState<string>(getLocalAiModel());
  const [localStatus, setLocalStatus] = useState<LocalAiStatus>(getLocalAiStatus());
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => subscribeLocalAi(setLocalStatus), []);
  useEffect(() => {
    if (open) {
      setLocalStatus(getLocalAiStatus());
      setLocalMsg(null);
    }
  }, [open]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProviders(await listAiProviders());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach API server');
      setProviders(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-container-low border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-bold flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            AI Settings
          </span>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="text-[10px] text-zinc-500 mb-2">
            Free multi-provider failover chain — Pollinations → Ollama → Groq → OpenRouter → Custom.
            Chat requests try each configured provider in order until one succeeds.
          </div>

          <div className="rounded-xl border border-secondary/25 bg-secondary/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-secondary" />
              <span className="text-xs font-bold text-secondary">100% free &amp; tokenless: run Ollama locally</span>
              <a
                href="https://ollama.com"
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1 text-[9px] font-bold text-secondary/80 hover:text-secondary"
              >
                ollama.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1.5 leading-relaxed">
              Install Ollama on your machine, then <code className="text-zinc-300">ollama run llama3.2</code>. The app
              auto-detects it at <code className="text-zinc-300">http://127.0.0.1:11434</code> — no API key, no tokens,
              no quotas, works offline. Set <code className="text-zinc-300">OLLAMA_BASE_URL</code> /{' '}
              <code className="text-zinc-300">OLLAMA_MODEL</code> to override.
            </p>
          </div>

          {/* In-browser local AI — Ollama without the install */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-primary">Local AI — runs on this device</span>
              <span className="ml-auto text-[9px] font-black uppercase text-secondary">free · no tokens · offline</span>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              A small open-source LLM runs right in your browser (like Ollama, no install). No API key, no quotas —
              it even works with the PWA installed offline. First use downloads the model once; after that it's cached.
            </p>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-16 shrink-0">Use when</span>
              <div className="flex rounded-lg overflow-hidden border border-primary/30">
                {(
                  [
                    ['auto', 'Online fails → local'],
                    ['on', 'Always local'],
                    ['off', 'Never'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => {
                      setLocalAiMode(m);
                      setLocalMode(m);
                    }}
                    className={`text-[9px] font-bold px-2.5 py-1 transition-colors ${
                      localMode === m ? 'bg-primary/25 text-primary' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-16 shrink-0">Model</span>
              <select
                value={localModel}
                onChange={(e) => {
                  setLocalModel(e.target.value);
                  setLocalAiModel(e.target.value);
                }}
                className="flex-1 text-[10px] bg-black/40 border border-outline-variant/30 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary/50"
              >
                {LOCAL_AI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.note} ({m.sizeHint})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDownloading(true);
                  setLocalMsg(null);
                  void preloadLocalAi().then((r) => {
                    setLocalMsg(r.message);
                    setDownloading(false);
                  });
                }}
                disabled={downloading || localStatus.state === 'loading'}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 disabled:opacity-40"
              >
                <Download className="w-3 h-3" />
                {downloading || localStatus.state === 'loading' ? 'Downloading…' : 'Download model now'}
              </button>
              {localStatus.state === 'loading' && (
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${localStatus.progress}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">{localStatus.text}</div>
                </div>
              )}
              {localStatus.state === 'ready' && (
                <span className="flex items-center gap-1 text-[9px] text-secondary font-mono">
                  <CheckCircle2 className="w-3 h-3" /> cached · {localStatus.device}
                </span>
              )}
              {localStatus.state === 'error' && (
                <span className="text-[9px] text-error">{localStatus.message}</span>
              )}
            </div>
            {localMsg && <div className="text-[10px] text-zinc-400">{localMsg}</div>}
          </div>

          {loading && <div className="text-xs text-zinc-400 py-4 text-center">Checking providers…</div>}

          {error && (
            <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {providers?.map((p) => (
            <div
              key={p.id}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-surface-container px-3 py-2.5"
            >
              <div className="mt-0.5">
                {p.available ? (
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                ) : (
                  <XCircle className="w-4 h-4 text-error" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{p.name}</span>
                  {p.requiresKey && (
                    <span className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-amber-400/90">
                      <KeyRound className="w-2.5 h-2.5" /> key
                    </span>
                  )}
                  <span
                    className={`ml-auto text-[9px] font-black uppercase ${
                      p.available ? 'text-secondary' : 'text-zinc-600'
                    }`}
                  >
                    {p.available ? 'ready' : 'off'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {p.note || PROVIDER_HELP[p.id] || 'OpenAI-compatible endpoint.'}
                </p>
              </div>
            </div>
          ))}

          {providers && providers.length === 0 && !error && (
            <div className="text-xs text-zinc-400 py-4 text-center">No providers configured.</div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <span className="text-[10px] text-zinc-600">
            Keys: GROQ_API_KEY · OPENROUTER_API_KEY · CUSTOM_AI_API_KEY
          </span>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/30 disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
