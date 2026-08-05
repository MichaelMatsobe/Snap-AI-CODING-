import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, Bot, User, Blocks } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiChat, type ChatMessage } from '../lib/api';
import {
  AI_SCRIPT_SYSTEM,
  heuristicScriptFromPrompt,
  injectScriptIntoSprite,
  parseAiScript,
} from '../engine/scriptBuilder';
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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
    setLastBuild(`Injected ${payload.blocks.length} blocks (root ${root.slice(0, 8)}…)`);
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

    try {
      const history = next.filter((m) => m.role !== 'system').slice(-12);
      const withSystem: ChatMessage[] = [
        { role: 'system', content: AI_SCRIPT_SYSTEM },
        ...history,
      ];
      // api only sends messages — fold system into first user context if needed
      const result = await aiChat(
        history.map((m, i) =>
          i === 0 && m.role === 'user'
            ? { ...m, content: `${AI_SCRIPT_SYSTEM}\n\nUser: ${m.content}` }
            : m
        )
      );
      void withSystem;
      setMessages((prev) => [...prev, { role: 'assistant', content: result.content }]);
      setLastProvider(`${result.provider} · ${result.model}`);
      tryInject(result.content, text);
    } catch (err) {
      // offline / API fail — still try heuristic build
      if (tryInject('', text)) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'API unreachable — built a heuristic script from your prompt and placed it on the sprite.',
          },
        ]);
      } else {
        setError(err instanceof Error ? err.message : 'Request failed');
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

          <div className="px-3 py-2 border-b border-white/5 flex flex-wrap gap-1.5">
            {['Build spin forever', 'Build bounce script', 'Build clone swarm'].map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
              >
                {q}
              </button>
            ))}
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
                placeholder="Build a script that spins and bounces…"
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
