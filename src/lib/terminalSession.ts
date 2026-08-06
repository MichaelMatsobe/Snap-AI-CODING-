/**
 * Shared in-app terminal transcript.
 *
 * The AI assistant and the background xterm console both push into this store
 * and subscribe to it, so every command the AI runs also appears in the console
 * drawer (and vice versa).
 */
import { runTerminalCommand, type TerminalResult } from './api';

export type TerminalEntryKind = 'cmd' | 'out' | 'err' | 'info' | 'clear';

export interface TerminalEntry {
  id: number;
  kind: TerminalEntryKind;
  text: string;
  at: number;
}

type Listener = (entries: TerminalEntry[]) => void;

const listeners = new Set<Listener>();
let entries: TerminalEntry[] = [];
let nextId = 1;
const MAX_ENTRIES = 600;

export function subscribeTerminal(fn: Listener): () => void {
  listeners.add(fn);
  fn(entries);
  return () => {
    listeners.delete(fn);
  };
}

export function pushTerminal(kind: TerminalEntryKind, text: string) {
  entries = [...entries, { id: nextId++, kind, text, at: Date.now() }];
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
  for (const l of listeners) l(entries);
}

export function clearTerminal() {
  pushTerminal('clear', '');
}

/**
 * Run a command through the backend console and stream the transcript.
 * Returns the raw result so callers can render their own summary.
 */
export async function runAndLog(command: string): Promise<TerminalResult> {
  pushTerminal('cmd', command);
  try {
    const result = await runTerminalCommand(command);
    if (result.stdout.trim()) pushTerminal('out', result.stdout.replace(/\n+$/, ''));
    if (result.stderr.trim()) pushTerminal('err', result.stderr.replace(/\n+$/, ''));
    if (result.killed) pushTerminal('info', `process killed after ${Math.round(result.durationMs / 1000)}s (timeout)`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    pushTerminal('err', msg);
    return { command, exitCode: 1, stdout: '', stderr: msg, killed: false, durationMs: 0 };
  }
}
