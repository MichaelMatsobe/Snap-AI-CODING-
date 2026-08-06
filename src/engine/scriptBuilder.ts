import { v4 as uuid } from 'uuid';
import type { AiScriptBlock, AiScriptPayload, BlockInstance, SpriteState } from './types';
import { getDef } from './blocks';

/**
 * LLMs frequently hallucinate opcode spellings. Normalize the common variants
 * to the real catalogue opcodes so injected scripts actually render and run.
 */
const OPCODE_ALIASES: Record<string, string> = {
  when_green_flag_clicked: 'event_whenflagclicked',
  event_when_green_flag_clicked: 'event_whenflagclicked',
  event_greenflag: 'event_whenflagclicked',
  when_key_pressed: 'event_whenkeypressed',
  when_this_sprite_clicked: 'event_whenthisspriteclicked',
  when_i_receive: 'event_whenbroadcastreceived',
  when_start_as_clone: 'control_start_as_clone',
  move_steps: 'motion_movesteps',
  turn_right: 'motion_turnright',
  turn_left: 'motion_turnleft',
  go_to_x_y: 'motion_gotoxy',
  go_to: 'motion_goto',
  point_in_direction: 'motion_pointindirection',
  say: 'looks_say',
  say_for_secs: 'looks_sayforsecs',
  think: 'looks_think',
  show: 'looks_show',
  hide: 'looks_hide',
  change_size_by: 'looks_changesizeby',
  set_size_to: 'looks_setsizeto',
  wait: 'control_wait',
  wait_seconds: 'control_wait',
  repeat: 'control_repeat',
  forever: 'control_forever',
  if_then: 'control_if',
  if_else: 'control_if_else',
  create_clone_of: 'control_create_clone_of',
  delete_this_clone: 'control_delete_this_clone',
  set_variable_to: 'data_setvariableto',
  change_variable_by: 'data_changevariableby',
  play_sound: 'sound_play',
  pen_down: 'pen_pendown',
  pen_up: 'pen_penup',
};

function normalizeOpcode(opcode: string): string {
  return OPCODE_ALIASES[opcode] || opcode;
}

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
    const opcode = normalizeOpcode(b.opcode);
    const def = getDef(opcode);
    const id = uuid();
    map[idx] = id;
    return {
      id,
      opcode,
      fields: { ...(def?.fields || {}), ...(b.fields || {}) },
      inputs: Object.fromEntries(
        Object.entries({ ...(def?.fields || {}), ...(b.fields || {}) }).map(([k, v]) => [
          k,
          { kind: 'shadow' as const, value: v },
        ])
      ),
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
  const rootIdx = payload.rootIndex ?? 0;
  let rootId = map[rootIdx];
  if (!rootId) return '';

  // Scripts only start when the green flag is pressed if their root is the
  // event_whenflagclicked hat — but the AI frequently omits the hat. If the
  // root isn't already a hat (e.g. a key-pressed or clone hat), wrap the whole
  // script in a green-flag hat so it actually runs.
  const rootDef = getDef(sprite.blocks[rootId]?.opcode ?? '');
  if (rootDef?.shape !== 'hat') {
    const hatId = uuid();
    sprite.blocks[hatId] = {
      id: hatId,
      opcode: 'event_whenflagclicked',
      fields: {},
      inputs: {},
      nextId: rootId,
      branchId: null,
      branch2Id: null,
      x: origin.x,
      y: origin.y,
    };
    sprite.scriptRoots = sprite.scriptRoots.filter((r) => r !== rootId);
    sprite.scriptRoots.push(hatId);
    rootId = hatId;
  } else if (!sprite.scriptRoots.includes(rootId)) {
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
