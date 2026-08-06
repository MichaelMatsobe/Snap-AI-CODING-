import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, Bot, User, Blocks, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiChat, type ChatMessage, type TerminalResult } from '../lib/api';
import { runAndLog } from '../lib/terminalSession';
import {
  AI_SCRIPT_SYSTEM,
  heuristicScriptFromPrompt,
  injectScriptIntoSprite,
  parseAiScript,
} from '../engine/scriptBuilder';
import {
  generateLocalAi,
  getLocalAiMode,
  getLocalAiModel,
  isLocalAiCached,
  setLocalAiMode,
  subscribeLocalAi,
  type LocalAiMode,
  type LocalAiStatus,
} from '../engine/localAi';
import type { SpriteState } from '../engine/types';

interface AiAssistantProps {
  open: boolean;
  onClose: () => void;
  /** When set, AI can inject built scripts into the active sprite */
  activeSprite?: SpriteState | null;
  onInjectSprite?: (sprite: SpriteState) => void;
}

export function AiAssistant({ open, onClose, activeSprite, onInjectSprite }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm Snap! AI. Ask me to explain blocks, or say **build a script that…** and I'll place real blocks on your sprite.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [lastBuild, setLastBuild] = useState<string | null>(null);
  // Output of the last terminal tool run — fed to the AI on the next request.
  const [toolContext, setToolContext] = useState<string | null>(null);
  // 100% free & tokenless in-browser AI (runs on this device, no API key).
  const [localMode, setLocalMode] = useState<LocalAiMode>(getLocalAiMode());
  const [localStatus, setLocalStatus] = useState<LocalAiStatus>({ state: 'idle' });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => subscribeLocalAi(setLocalStatus), []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Terminal tool ───────────────────────────────────────────────────────
  // "/cmd <shell>" runs the command verbatim; recognized natural-language
  // intents auto-run a mapped command. Output streams into the background
  // console and is summarized here in chat.
  //
  // IMPORTANT: terminal intents are intentionally strict. Messages like
  // "build a script that…" or "build a calculator" are SCRIPT-BUILDING
  // requests for the AI — they must never be hijacked into `npm run build`.
  const TOOL_INTENTS: Array<{ test: RegExp; run: string }> = [
    { test: /\bpreview\s+status\b/i, run: 'freebuff-preview status' },
    { test: /\bpreview\s+logs?\b/i, run: 'freebuff-preview logs' },
    { test: /\b(start|launch)\s+(the\s+)?preview\b/i, run: 'freebuff-preview start' },
    { test: /\bgit\s+(status|log|pull|push)\b/i, run: '' }, // mapped below by verb
    { test: /\b(typecheck|lint|run\s+tests?)\b/i, run: 'npm run lint' },
    // "build the project/app/repo" only — a bare "build" must not match.
    { test: /\b(?:run|start|do)\s+(?:the\s+)?build\b/i, run: 'npm run build' },
    { test: /\bbuild\s+(?:the\s+)?(?:project|app|application|repo)\b/i, run: 'npm run build' },
  ];
  // Anything that sounds like building a SNAP script or a program feature is
  // an AI job, not a terminal job — even if it contains "build". Explicit
  // terminal phrases ("run build", "build the project") are excluded so they
  // still map to the build command.
  function isScriptBuildRequest(text: string): boolean {
    const terminalBuild =
      /\b(?:run|start|do)\s+(?:the\s+)?build\b/i.test(text) ||
      /\bbuild\s+(?:the\s+)?(?:project|app|application|repo)\b/i.test(text);
    if (terminalBuild) return false;
    return (
      /\b(script|blocks?|program|game|app|calculator|project)\b/.test(text) &&
      /\b(build|create|make|generate)\b/.test(text)
    );
  }

  function friendlyAiError(err: unknown): string {
    const msg = err instanceof Error ? err.message : 'Request failed';
    if (/all ai providers failed|failed to fetch|networkerror|timed out/i.test(msg)) {
      return (
        'All free online providers are unreachable right now (rate limits / offline — this is common with ' +
        "Pollinations' free tier). The Local AI mode tries next, and heuristic block building works offline. " +
        'For the most reliable free AI, switch Local AI to “Always” (⚙️) — it runs entirely on this device with no tokens or quotas.'
      );
    }
    return msg;
  }

  function formatToolResult(r: TerminalResult): string {
    const body = [r.stdout.trim(), r.stderr.trim()].filter(Boolean).join('\n').slice(0, 4000);
    const status = r.killed
      ? `killed (timeout after ${Math.round(r.durationMs / 1000)}s)`
      : `exit ${r.exitCode} · ${(r.durationMs / 1000).toFixed(1)}s`;
    return `🛠 Ran \`${r.command}\` — ${status}${body ? `\n\n${body}` : ''}`;
  }

  /** Generate a reply fully on-device (offline, no tokens) and inject blocks. */
  async function runLocalAi(text: string, history: ChatMessage[]): Promise<boolean> {
    try {
      const msgs: { role: string; content: string }[] = [
        {
          role: 'system',
          content: `${AI_SCRIPT_SYSTEM}\n\nKeep replies short and direct. When building a script, output the JSON block per the schema.`,
        },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      ];
      const content = await generateLocalAi(msgs);
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
      setLastProvider(`local · ${getLocalAiModel().split('/').pop()} (browser)`);
      tryInject(content, text);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Local AI failed';
      setError(
        /failed to fetch|dynamically imported|loading chunk|importing|networkerror|timed out|abort/i.test(
          msg
        )
          ? 'Local AI couldn’t load — it needs a stable connection to download itself the first time, and your link looks very slow right now. It works offline afterwards. Preload it from ⚙️ AI Settings when your connection is better, or switch Local AI off.'
          : msg
      );
      return false;
    }
  }

  function tryInject(raw: string, userPrompt: string): boolean {
    if (!activeSprite || !onInjectSprite) return false;
    const wantsBuild =
      /\b(build|generate|create|make)\b.*\b(script|blocks?|program)\b/i.test(userPrompt) ||
      /\bbuild\b/i.test(userPrompt);
    if (!wantsBuild && !parseAiScript(raw)) return false;

    let payload = parseAiScript(raw);
    if (!payload) payload = heuristicScriptFromPrompt(userPrompt);
    const copy = structuredClone(activeSprite);
    const root = injectScriptIntoSprite(copy, payload, {
      x: 40 + Math.random() * 80,
      y: 40 + Math.random() * 120,
    });
    onInjectSprite(copy);
    setLastBuild(`Injected ${payload.blocks.length} blocks — press the green flag ▶ to run it`);
    return true;
  }

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    setLastBuild(null);

    // Terminal tool first: /cmd verbatim, otherwise matched intents.
    // Script-building prompts ("build a calculator…") always go to the AI —
    // never to the terminal, even though they contain the word "build".
    const cmdMatch = text.match(/^\/cmd\s+([\s\S]+)$/);
    const intent =
      cmdMatch || isScriptBuildRequest(text)
        ? null
        : TOOL_INTENTS.find((t) => t.test.test(text));
    let command = cmdMatch ? cmdMatch[1] : intent?.run;
    if (!cmdMatch && intent && !command) {
      // git verb mapping: status/log -> git status, pull -> git pull, etc.
      command =
        /\bgit\s+status\b/i.test(text) || /\bgit\s+log\b/i.test(text)
          ? 'git status'
          : /\bgit\s+pull\b/i.test(text)
            ? 'git pull'
            : 'git push';
    }
    command = command?.trim();
    if (command) {
      try {
        const result = await runAndLog(command);
        setMessages((prev) => [...prev, { role: 'assistant', content: formatToolResult(result) }]);
        setLastProvider(`terminal · ${result.durationMs}ms`);
        setToolContext(
          `Last terminal command: ${command}\nExit code: ${result.exitCode}\nOutput:\n${(
            result.stdout + result.stderr
          ).slice(0, 2500)}`
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Command failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    const history = next.filter((m) => m.role !== 'system').slice(-12);
    const system = toolContext
      ? `${AI_SCRIPT_SYSTEM}\n\nYou can run terminal commands when the user asks (build, lint, git, preview status…). For context, your most recent terminal result was:\n${toolContext}`
      : AI_SCRIPT_SYSTEM;
    try {
      if (getLocalAiMode() === 'on') {
        // User forced the 100% free on-device model (offline, no tokens).
        await runLocalAi(text, history);
      } else {
        const result = await aiChat(history, { system });
        setMessages((prev) => [...prev, { role: 'assistant', content: result.content }]);
        setLastProvider(`${result.provider} · ${result.model}`);
        tryInject(result.content, text);
      }
    } catch (err) {
      // Online AI unavailable. Use the free on-device model only when it is
      // already cached here — a first-time ~100–400 MB download on a slow or
      // flaky link should be deliberate (Settings → Download model now), not a
      // silent surprise in the middle of a chat. Otherwise use the offline
      // heuristic builder, which needs no network at all.
      const cached = await isLocalAiCached();
      const localOk = cached ? await runLocalAi(text, history) : false;
      if (!localOk && tryInject('', text)) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `AI is unavailable right now — built a heuristic script from your prompt and placed it on the sprite. Press the green flag ▶ to run it.${cached ? '' : ' For real AI that works even offline, preload the free local model from ⚙️ AI Settings.'}`,
          },
        ]);
      } else if (!localOk) {
        setError(friendlyAiError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="fixed right-0 top-0 bottom-0 w-full max-w-md z-[100] flex flex-col bg-surface-container-low border-l border-white/10 shadow-2xl"
        >
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-surface/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold text-on-surface">Snap! AI</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Builds real blocks</div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-white/5 flex flex-wrap gap-1.5 items-center">
            {['Build spin forever', 'Build bounce script', 'Build clone swarm'].map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              >
                {q}
              </button>
            ))}
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider ml-1">Terminal</span>
            {['Run build', 'Git status', 'Preview status', 'Lint'].map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="text-[10px] px-2 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/20 hover:bg-tertiary/20 font-mono"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="px-3 py-2 border-b border-white/5 flex flex-wrap items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-secondary" />
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Local AI</span>
            <div className="flex rounded-full overflow-hidden border border-secondary/30">
              {(
                [
                  ['auto', 'Auto'],
                  ['on', 'Always'],
                  ['off', 'Off'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    setLocalAiMode(m);
                    setLocalMode(m);
                  }}
                  className={`text-[9px] font-bold px-2 py-0.5 transition-colors ${
                    localMode === m ? 'bg-secondary/25 text-secondary' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {localStatus.state === 'loading' && (
              <span className="text-[9px] text-zinc-400 font-mono">
                downloading {localStatus.progress.toFixed(0)}%
              </span>
            )}
            {localStatus.state === 'ready' && (
              <span className="text-[9px] text-secondary font-mono">
                {localStatus.device === 'webgpu' ? 'GPU' : 'CPU'} ready
              </span>
            )}
            {localStatus.state === 'generating' && (
              <span className="text-[9px] text-zinc-400 font-mono">thinking…</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'
                  }`}
                >
                  {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-secondary/15 text-on-surface rounded-tr-sm'
                      : 'bg-surface-container-highest/80 text-zinc-200 rounded-tl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <div className="bg-surface-container-highest/80 rounded-2xl px-4 py-3 text-sm text-zinc-400">Thinking…</div>
              </div>
            )}
            {lastBuild && (
              <div className="flex items-center gap-2 text-xs text-secondary bg-secondary/10 border border-secondary/20 rounded-lg px-3 py-2">
                <Blocks className="w-3.5 h-3.5" />
                {lastBuild}
              </div>
            )}
            {error && (
              <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-white/5 bg-surface-container-lowest">
            {lastProvider && <div className="text-[9px] text-zinc-600 mb-1.5 px-1 font-mono">via {lastProvider}</div>}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Build a script… · /cmd npm run build runs terminal commands"
                className="flex-1 resize-none bg-black/40 border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                disabled={loading}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="h-10 w-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
