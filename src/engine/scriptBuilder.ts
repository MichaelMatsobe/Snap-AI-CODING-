import { v4 as uuid } from 'uuid';
import type { AiScriptBlock, AiScriptPayload, BlockInstance, SpriteState } from './types';
import { getDef } from './blocks';

/** Parse AI JSON payload (raw or fenced) into structured blocks */
export function parseAiScript(raw: string): AiScriptPayload | null {
  try {
    let text = raw.trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) text = fence[1].trim();
    // try extract first { ... }
    const brace = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (brace >= 0 && end > brace) text = text.slice(brace, end + 1);
    const data = JSON.parse(text) as AiScriptPayload;
    if (!data.blocks || !Array.isArray(data.blocks)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Heuristic: plain-language lines → simple stack */
export function heuristicScriptFromPrompt(prompt: string): AiScriptPayload {
  const lower = prompt.toLowerCase();
  const blocks: AiScriptBlock[] = [{ opcode: 'event_whenflagclicked' }];
  let i = 0;

  const push = (opcode: string, fields?: Record<string, string | number>) => {
    blocks[i].next = blocks.length;
    blocks.push({ opcode, fields: fields || {} });
    i = blocks.length - 1;
  };

  if (lower.includes('forever') || lower.includes('always') || lower.includes('loop')) {
    blocks[i].next = blocks.length;
    const foreverIdx = blocks.length;
    blocks.push({ opcode: 'control_forever', branch: foreverIdx + 1 });
    i = foreverIdx;
    if (lower.includes('spin') || lower.includes('turn') || lower.includes('rotate')) {
      blocks.push({ opcode: 'motion_turnright', fields: { DEGREES: 15 } });
      blocks[foreverIdx].branch = foreverIdx + 1;
    } else if (lower.includes('move')) {
      blocks.push({ opcode: 'motion_movesteps', fields: { STEPS: 5 } });
      blocks[foreverIdx].branch = foreverIdx + 1;
    } else {
      blocks.push({ opcode: 'motion_movesteps', fields: { STEPS: 3 } });
      blocks.push({ opcode: 'motion_ifonedgebounce' });
      blocks[foreverIdx].branch = foreverIdx + 1;
      blocks[foreverIdx + 1].next = foreverIdx + 2;
    }
  } else {
    if (lower.includes('move')) push('motion_movesteps', { STEPS: 10 });
    if (lower.includes('turn') || lower.includes('spin')) push('motion_turnright', { DEGREES: 90 });
    if (lower.includes('hide')) push('looks_hide');
    if (lower.includes('show')) push('looks_show');
    if (lower.includes('clone')) push('control_create_clone_of', { CLONE_OPTION: '_myself_' });
    if (lower.includes('say') || lower.includes('hello')) push('looks_sayforsecs', { MESSAGE: 'Hello!', SECS: 2 });
    if (blocks.length === 1) {
      push('motion_movesteps', { STEPS: 10 });
      push('motion_turnright', { DEGREES: 15 });
    }
  }

  return { blocks, rootIndex: 0 };
}

/** Inject AI script into sprite as a new root stack */
export function injectScriptIntoSprite(
  sprite: SpriteState,
  payload: AiScriptPayload,
  origin = { x: 60, y: 60 }
): string {
  const map: string[] = [];
  const instances: BlockInstance[] = payload.blocks.map((b, idx) => {
    const def = getDef(b.opcode);
    const id = uuid();
    map[idx] = id;
    return {
      id,
      opcode: b.opcode,
      fields: { ...(def?.fields || {}), ...(b.fields || {}) },
      nextId: null,
      branchId: null,
      branch2Id: null,
      ...(idx === (payload.rootIndex ?? 0) ? { x: origin.x, y: origin.y } : {}),
    };
  });

  payload.blocks.forEach((b, idx) => {
    const inst = instances[idx];
    if (b.next != null && map[b.next]) inst.nextId = map[b.next];
    if (b.branch != null && map[b.branch]) inst.branchId = map[b.branch];
    if (b.branch2 != null && map[b.branch2]) inst.branch2Id = map[b.branch2];
  });

  for (const inst of instances) {
    sprite.blocks[inst.id] = inst;
  }
  const rootId = map[payload.rootIndex ?? 0];
  if (rootId && !sprite.scriptRoots.includes(rootId)) {
    sprite.scriptRoots.push(rootId);
  }
  return rootId;
}

export const AI_SCRIPT_SYSTEM = `You are Snap! AI block builder. When the user asks you to build or generate a script, respond with a short explanation AND a JSON object in a fenced code block.

JSON schema:
{
  "blocks": [
    { "opcode": "event_whenflagclicked", "next": 1 },
    { "opcode": "control_forever", "branch": 2 },
    { "opcode": "motion_turnright", "fields": { "DEGREES": 15 } }
  ],
  "rootIndex": 0
}

Valid opcodes include: event_whenflagclicked, event_whenkeypressed, motion_movesteps, motion_turnright, motion_turnleft, motion_gotoxy, motion_glidesecstoxy, motion_ifonedgebounce, looks_say, looks_sayforsecs, looks_show, looks_hide, looks_setsizeto, control_wait, control_forever, control_repeat, control_if, control_create_clone_of, control_delete_this_clone, control_start_as_clone, data_setvariableto, data_changevariableby, sound_play, pen_pendown, pen_penup, ai_ask, ml_describe_scene.

Use next/branch as array indices. Keep scripts short (under 15 blocks).`;
