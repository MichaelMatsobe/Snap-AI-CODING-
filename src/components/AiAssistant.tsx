import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiChat, type ChatMessage } from '../lib/api';

interface AiAssistantProps {
  open: boolean;
  onClose: () => void;
}

export function AiAssistant({ open, onClose }: AiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm Snap! AI — your free coding assistant. Ask me to explain blocks, design scripts, debug logic, or generate ideas for your visual programs.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Only send recent context (last 12 turns) to keep free providers happy
      const history = next.filter((m) => m.role !== 'system').slice(-12);
      const result = await aiChat(history);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.content },
      ]);
      setLastProvider(`${result.provider} · ${result.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-surface/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold text-on-surface">Snap! AI</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Free multi-provider · no hard quota
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Close assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    m.role === 'user'
                      ? 'bg-secondary/20 text-secondary'
                      : 'bg-primary/20 text-primary'
                  }`}
                >
                  {m.role === 'user' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
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
                <div className="bg-surface-container-highest/80 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-400">
                  Thinking…
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/5 bg-surface-container-lowest">
            {lastProvider && (
              <div className="text-[9px] text-zinc-600 mb-1.5 px-1 font-mono">
                via {lastProvider}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Ask about blocks, scripts, or project ideas…"
                className="flex-1 resize-none bg-black/40 border border-outline-variant/30 rounded-xl px-3 py-2.5 text-sm text-on-surface placeholder:text-zinc-600 focus:outline-none focus:border-primary/50"
                disabled={loading}
              />
              <button
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="h-10 w-10 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all"
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
