import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { clearTerminal, runAndLog, subscribeTerminal } from '../lib/terminalSession';

const PROMPT = '\x1b[36msnap:~$\x1b[0m ';

/**
 * Background console drawer.
 *
 * This is a real terminal (xterm.js). The AI assistant drives it as a tool —
 * every command it runs lands here — and you can also type commands directly:
 * each line is executed in the project root through the /api/terminal/exec
 * endpoint and the output is streamed back.
 */
export function TerminalDrawer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef('');
  const lastIdRef = useRef(0);

  useEffect(() => {
    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
      theme: {
        background: '#0b0c0c',
        foreground: '#d6d3d1',
        cursor: '#7cd2f1',
        selectionBackground: '#33525e',
        black: '#0b0c0c',
        brightBlack: '#78716c',
      },
      convertEol: true,
      cursorBlink: true,
      scrollback: 2000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current!);
    fit.fit();

    term.writeln('\x1b[90mSnap! Atelier console — commands run in the project root.\x1b[0m');
    term.writeln('\x1b[90mAsk Snap! AI, or type a command. "clear" wipes the screen.\x1b[0m');
    term.write(PROMPT);

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        /* hidden */
      }
    };
    window.addEventListener('resize', onResize);

    // Stream the shared session (AI-driven commands) into this terminal.
    const unsub = subscribeTerminal((list) => {
      for (const e of list) {
        if (e.id <= lastIdRef.current) continue;
        lastIdRef.current = e.id;
        if (e.kind === 'clear') {
          term.clear();
          term.write(PROMPT);
        } else if (e.kind === 'cmd') {
          term.writeln(`\r\x1b[K${PROMPT}\x1b[97m${e.text}\x1b[0m`);
        } else if (e.kind === 'out') {
          term.writeln(e.text);
        } else if (e.kind === 'err') {
          term.writeln(`\x1b[91m${e.text}\x1b[0m`);
        } else {
          term.writeln(`\x1b[33m${e.text}\x1b[0m`);
        }
      }
      term.write(PROMPT);
    });

    // Typed input: buffer keystrokes, execute the line on Enter.
    const onData = term.onData((data) => {
      if (data === '\r' || data === '\n') {
        const line = bufRef.current.trim();
        bufRef.current = '';
        term.write('\r\x1b[K');
        if (!line) {
          term.write(PROMPT);
          return;
        }
        if (line === 'clear') {
          clearTerminal();
          return;
        }
        void runAndLog(line);
        return;
      }
      if (data === '\x03') {
        // Ctrl+C — cancel the current line.
        bufRef.current = '';
        term.write('\r\x1b[K');
        term.write(PROMPT);
        return;
      }
      if (data === '\x7f') {
        bufRef.current = bufRef.current.slice(0, -1);
        return;
      }
      if (data >= ' ' || data === '\t') {
        bufRef.current += data;
      }
    });

    return () => {
      unsub();
      onData.dispose();
      window.removeEventListener('resize', onResize);
      term.dispose();
    };
  }, []);

  return <div ref={hostRef} className="w-full h-full bg-[#0b0c0c]" />;
}
