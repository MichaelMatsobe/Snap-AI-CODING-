/**
 * Snap! Atelier — Python mode.
 *
 * The user describes what they want in plain English; the AI replies with a
 * small, Python-flavoured script (a fixed DSL). The app PARSES that DSL and
 * converts it into the same validated blocks the VM already runs.
 *
 * IMPORTANT: nothing here ever executes Python. There is no interpreter, no
 * shell, no evaluation of the generated text — so there is zero code-execution
 * risk, no dependency on the sandbox having Python installed, and it works in
 * production hosting and fully offline. "Exactly what the user asked" is
 * guaranteed by the block engine's known semantics, exactly like JSON builds.
 */

import type { AiScriptBlock, AiScriptPayload, BlockInstance, SpriteState } from './types';

// ── DSL vocabulary: fixed, tiny, maps 1:1 to block opcodes ────────────────

type ArgMap = (args: string[]) => Record<string, string | number>;

interface DslEntry {
  opcode: string;
  isHat?: boolean;
  isControl?: boolean;
  fields?: ArgMap;
}

/** Strip surrounding quotes. */
const q = (s: string) => s.trim().replace(/^['"`]+|['"`]+$/g, '');
/** Parse a number (tolerates thousands separators); fallback otherwise. */
const n = (s: string, fallback: number) => {
  const v = Number(s.replace(/,/g, ''));
  return Number.isFinite(v) ? v : fallback;
};

export const PYTHON_DSL_VOCAB: Record<string, DslEntry> = {
  // Hats
  when_flag: { opcode: 'event_whenflagclicked', isHat: true },
  when_key_pressed: {
    opcode: 'event_whenkeypressed',
    isHat: true,
    fields: ([k]) => ({ KEY: q(k) || 'space' }),
  },
  when_sprite_clicked: { opcode: 'event_whenthisspriteclicked', isHat: true },
  when_clone_start: { opcode: 'control_start_as_clone', isHat: true },
  // Motion
  move: { opcode: 'motion_movesteps', fields: ([v]) => ({ STEPS: n(v, 10) }) },
  turn_right: { opcode: 'motion_turnright', fields: ([v]) => ({ DEGREES: n(v, 15) }) },
  turn_left: { opcode: 'motion_turnleft', fields: ([v]) => ({ DEGREES: n(v, 15) }) },
  go_to: { opcode: 'motion_gotoxy', fields: ([x, y]) => ({ X: n(x, 0), Y: n(y, 0) }) },
  glide_to: {
    opcode: 'motion_glidesecstoxy',
    fields: ([s, x, y]) => ({ SECS: n(s, 1), X: n(x, 0), Y: n(y, 0) }),
  },
  if_on_edge_bounce: { opcode: 'motion_ifonedgebounce' },
  // Looks
  say: { opcode: 'looks_say', fields: ([m]) => ({ MESSAGE: q(m) || 'Hello!' }) },
  say_for: {
    opcode: 'looks_sayforsecs',
    fields: ([m, s]) => ({ MESSAGE: q(m) || 'Hello!', SECS: n(s, 2) }),
  },
  think: { opcode: 'looks_think', fields: ([m]) => ({ MESSAGE: q(m) || 'Hmm...' }) },
  show: { opcode: 'looks_show' },
  hide: { opcode: 'looks_hide' },
  set_size: { opcode: 'looks_setsizeto', fields: ([v]) => ({ SIZE: n(v, 100) }) },
  // Control
  wait: { opcode: 'control_wait', fields: ([v]) => ({ DURATION: n(v, 1) }) },
  repeat: { opcode: 'control_repeat', isControl: true, fields: ([v]) => ({ TIMES: n(v, 10) }) },
  forever: { opcode: 'control_forever', isControl: true },
  if: {
    opcode: 'control_if',
    isControl: true,
    fields: ([c]) => ({ CONDITION: q(c) || 'touching edge' }),
  },
  if_else: {
    opcode: 'control_if_else',
    isControl: true,
    fields: ([c]) => ({ CONDITION: q(c) || 'touching edge' }),
  },
  create_clone: {
    opcode: 'control_create_clone_of',
    fields: () => ({ CLONE_OPTION: '_myself_' }),
  },
  delete_clone: { opcode: 'control_delete_this_clone' },
  // Variables
  set_var: {
    opcode: 'data_setvariableto',
    fields: ([name, v]) => ({ VARIABLE: q(name) || 'score', VALUE: n(v, 0) }),
  },
  change_var: {
    opcode: 'data_changevariableby',
    fields: ([name, v]) => ({ VARIABLE: q(name) || 'score', VALUE: n(v, 1) }),
  },
  // Sound / Pen / AI
  play_sound: { opcode: 'sound_play', fields: ([s]) => ({ SOUND: q(s) || 'pop' }) },
  pen_down: { opcode: 'pen_pendown' },
  pen_up: { opcode: 'pen_penup' },
  ask_ai: {
    opcode: 'ai_ask',
    fields: ([p, v]) => ({ PROMPT: q(p) || 'Tell me a joke', VARIABLE: q(v) || 'answer' }),
  },
};

// ── Parser ────────────────────────────────────────────────────────────────

interface DslLine {
  indent: number;
  content: string;
}

/** Split function-call args on top-level commas, respecting quotes/brackets. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  let quote: string | null = null;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Parse a Python-flavoured DSL script into the same payload shape the AI JSON
 * uses, so it flows through injectScriptIntoSprite unchanged. Returns null if
 * nothing recognizable is found (callers fall back to heuristics).
 */
export function parsePythonDsl(source: string): AiScriptPayload | null {
  let text = source.trim();
  const fence = text.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const lines: DslLine[] = [];
  for (const raw of text.split('\n')) {
    const m = raw.match(/^(\s*)(.*)$/);
    const content = ((m?.[2] ?? '') as string).replace(/#.*$/, '').trim();
    if (!content) continue;
    lines.push({ indent: ((m?.[1] ?? '') as string).replace(/\t/g, '  ').length, content });
  }
  if (!lines.length) return null;

  const blocks: AiScriptBlock[] = [];
  let recognized = 0;

  const link = (from: number, to: number) => {
    blocks[from]!.next = to;
  };

  /** Build one sequential chain of statements at >= `indent`. Returns next line index. */
  const buildChain = (i: number, indent: number, chain: number[]): number => {
    while (i < lines.length) {
      const ln = lines[i]!;
      if (ln.indent < indent) return i;
      if (ln.indent > indent) {
        i++;
        continue;
      }
      const call = ln.content.match(/^([a-z_][a-z0-9_]*)\s*\((.*)\)\s*:?\s*$/);
      if (!call) {
        i++;
        continue;
      }
      const name = call[1]!;
      const entry = PYTHON_DSL_VOCAB[name];
      if (!entry) {
        i++;
        continue;
      }
      // A hat mid-chain starts a new script — stop so the caller can begin it.
      if (entry.isHat && chain.length) return i;
      const args = splitArgs(call[2] ?? '');
      const idx = blocks.length;
      blocks.push({ opcode: entry.opcode, fields: entry.fields ? entry.fields(args) : {} });
      recognized++;
      if (chain.length) link(chain[chain.length - 1]!, idx);
      chain.push(idx);
      i++;
      // Hats wrap an indented body (linked as their `next` chain).
      if (entry.isHat && i < lines.length && lines[i]!.indent > indent) {
        i = buildChain(i, lines[i]!.indent, chain);
      }
      if (entry.isHat) continue;
      if (entry.isControl) {
        const bodyIndent = i < lines.length ? lines[i]!.indent : indent + 2;
        if (name === 'if_else') {
          const thenChain: number[] = [];
          i = buildChain(i, bodyIndent, thenChain);
          if (thenChain.length) blocks[idx]!.branch = thenChain[0]!;
          if (
            i < lines.length &&
            lines[i]!.indent === indent &&
            /^else\s*:?\s*$/.test(lines[i]!.content)
          ) {
            i++;
            const elseChain: number[] = [];
            const elseIndent = i < lines.length ? lines[i]!.indent : indent + 2;
            i = buildChain(i, elseIndent, elseChain);
            if (elseChain.length) blocks[idx]!.branch2 = elseChain[0]!;
          }
        } else {
          const bodyChain: number[] = [];
          i = buildChain(i, bodyIndent, bodyChain);
          if (bodyChain.length) blocks[idx]!.branch = bodyChain[0]!;
        }
      }
    }
    return i;
  };

  const topIndent = lines[0]!.indent;
  const chain: number[] = [];
  buildChain(0, topIndent, chain);
  if (!chain.length || recognized === 0) return null;
  return { blocks, rootIndex: 0 };
}

// ── Reverse: blocks → Python (read-only view / learning tool) ─────────────

const BLOCK_TO_DSL: Record<string, string> = {
  event_whenflagclicked: 'when_flag',
  event_whenkeypressed: 'when_key_pressed',
  event_whenthisspriteclicked: 'when_sprite_clicked',
  control_start_as_clone: 'when_clone_start',
  motion_movesteps: 'move',
  motion_turnright: 'turn_right',
  motion_turnleft: 'turn_left',
  motion_gotoxy: 'go_to',
  motion_glidesecstoxy: 'glide_to',
  motion_ifonedgebounce: 'if_on_edge_bounce',
  looks_say: 'say',
  looks_sayforsecs: 'say_for',
  looks_think: 'think',
  looks_show: 'show',
  looks_hide: 'hide',
  looks_setsizeto: 'set_size',
  control_wait: 'wait',
  control_repeat: 'repeat',
  control_forever: 'forever',
  control_if: 'if',
  control_if_else: 'if_else',
  control_create_clone_of: 'create_clone',
  control_delete_this_clone: 'delete_clone',
  data_setvariableto: 'set_var',
  data_changevariableby: 'change_var',
  sound_play: 'play_sound',
  pen_pendown: 'pen_down',
  pen_penup: 'pen_up',
  ai_ask: 'ask_ai',
};

const CONTROL_OPS = new Set([
  'control_repeat',
  'control_forever',
  'control_if',
  'control_if_else',
]);

/** Render a sprite's scripts as Python-flavoured DSL (never executed). */
export function blocksToPython(sprite: SpriteState): string {
  const out: string[] = [];

  const field = (b: BlockInstance, key: string, fallback: string): string => {
    const inp = b.inputs?.[key];
    const v = b.fields[key] ?? (inp && inp.kind === 'shadow' ? inp.value : undefined);
    return v === undefined || v === '' ? fallback : String(v);
  };

  const fmt = (b: BlockInstance): string => {
    const name = BLOCK_TO_DSL[b.opcode] ?? b.opcode;
    const args: string[] = [];
    const push = (key: string, fb = '') => args.push(field(b, key, fb));
    switch (b.opcode) {
      case 'event_whenkeypressed':
        push('KEY', 'space');
        break;
      case 'motion_movesteps':
        push('STEPS', '10');
        break;
      case 'motion_turnright':
      case 'motion_turnleft':
        push('DEGREES', '15');
        break;
      case 'motion_gotoxy':
        push('X', '0');
        push('Y', '0');
        break;
      case 'motion_glidesecstoxy':
        push('SECS', '1');
        push('X', '0');
        push('Y', '0');
        break;
      case 'looks_say':
      case 'looks_think':
        args.push(`'${field(b, 'MESSAGE', 'Hello!')}'`);
        break;
      case 'looks_sayforsecs':
        args.push(`'${field(b, 'MESSAGE', 'Hello!')}'`);
        push('SECS', '2');
        break;
      case 'looks_setsizeto':
        push('SIZE', '100');
        break;
      case 'control_wait':
        push('DURATION', '1');
        break;
      case 'control_repeat':
        push('TIMES', '10');
        break;
      case 'control_if':
      case 'control_if_else':
        push('CONDITION', 'touching edge');
        break;
      case 'data_setvariableto':
      case 'data_changevariableby':
        args.push(`'${field(b, 'VARIABLE', 'score')}'`);
        push('VALUE', '0');
        break;
      case 'sound_play':
        args.push(`'${field(b, 'SOUND', 'pop')}'`);
        break;
      case 'ai_ask':
        args.push(`'${field(b, 'PROMPT', 'Tell me a joke')}'`);
        args.push(`'${field(b, 'VARIABLE', 'answer')}'`);
        break;
      default:
        break;
    }
    return `${name}(${args.join(', ')})`;
  };

  const render = (id: string, depth: number) => {
    const pad = '  '.repeat(depth);
    let cur: string | null = id;
    let guard = 0;
    while (cur && guard++ < 200) {
      const b: BlockInstance | undefined = sprite.blocks[cur];
      if (!b) break;
      const isC = CONTROL_OPS.has(b.opcode);
      out.push(`${pad}${fmt(b)}${isC ? ':' : ''}`);
      if (b.branchId) render(b.branchId, depth + 1);
      if (b.opcode === 'control_if_else') {
        if (b.branch2Id) {
          out.push(`${pad}else:`);
          render(b.branch2Id, depth + 1);
        }
      }
      cur = b.nextId;
    }
  };

  for (const rootId of sprite.scriptRoots) {
    if (!sprite.blocks[rootId]) continue;
    render(rootId, 0);
    out.push('');
  }
  return out.join('\n').trim();
}

// ── System prompt for the AI when Python mode is on ───────────────────────

export const PYTHON_DSL_SYSTEM = `You are Snap! AI block builder — PYTHON MODE. When the user asks you to build or generate a script, reply with a short explanation AND the script as a Python-flavoured DSL inside a fenced \`\`\`python block. Use ONLY these functions (indentation matters):

Hats: when_flag()  when_key_pressed('space')  when_sprite_clicked()  when_clone_start()
Motion: move(10)  turn_right(15)  turn_left(15)  go_to(0, 0)  glide_to(1, 0, 0)  if_on_edge_bounce()
Looks: say('Hi')  say_for('Hi', 2)  think('Hmm')  show()  hide()  set_size(100)
Control: wait(1)  repeat(10):  forever():  if(condition):  if_else(condition): ... else: ...
Variables: set_var('score', 0)  change_var('score', 1)
Sound/Pen/AI: play_sound('pop')  pen_down()  pen_up()  create_clone()  delete_clone()  ask_ai('prompt', 'variable')

Rules:
- Write ONE script per message, starting with when_flag() unless the user asked for another hat.
- Bodies are indented 2 spaces under repeat/forever/if/if_else.
- For if_else, put else: at the same indentation as the if_else(condition): line.
- Keep scripts short (under 15 blocks).
- Never use import, print, def, or any real Python — this DSL is converted to blocks, not executed.

Example:
when_flag():
  forever():
    if_on_edge_bounce()
    move(10)
    turn_right(15)`;
