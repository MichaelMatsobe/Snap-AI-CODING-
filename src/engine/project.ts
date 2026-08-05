import { v4 as uuid } from 'uuid';
import type { BlockInstance, Project, SpriteState } from './types';

const ROCKET =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCqK_ml0ZsYv6TbySRZhI-by2OfLZhWNtz6sRnwUnDmjRinL5cDunJR-HEyO4bIMIS-Mvj1Ux44i_TOvTlN6oQVH6g5jkHmBu-pQlqbI4hruhahna6Gaulazi49JpwEhorFPerAzXP2PS6w5XviucVEpAB8TC_PsGreQK4WS-PZkGspH9Or-RG7x_ZblbHRCmQKbY13tu23CDLeo8lSHxcgHC3TUjVim0g_R7HAdHqPDFlRzDptCNFOSk1EmusSjZEyhNmlS2cll0zH';
const STAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAmgiB2wMk6zMFHxoRjYwGS8YvLV2TuGM9dQEmGHGPnCLAg7Oq5G1gjpTD6fijlGGseUE8Xh7Z7MlvLTQ58sE_kozQTNcpkMVVBLJI-DqOo3c8IyzrcGaWhHDOFcHIFiHw8fqNt1-ZMmqqSPmZQWaPOjTZqzpsBuvlhxC_lXaRMSqZw1W4td5cM0AEdmMF8ZGgRB2lWI2OM1Wc-sq0v8_uQaivn0VH6m8qxQ7lTzlb_o_xW8VEoRemIjvN1X7qVxaGFVlK_zM3YfH0d';

function block(
  opcode: string,
  fields: Record<string, string | number> = {},
  opts: Partial<BlockInstance> = {}
): BlockInstance {
  return {
    id: uuid(),
    opcode,
    fields,
    nextId: null,
    branchId: null,
    branch2Id: null,
    ...opts,
  };
}

/** Demo project: bounce off edges + score */
export function createDefaultProject(): Project {
  const hat = block('event_whenflagclicked', {}, { x: 40, y: 40 });
  const setScore = block('data_setvariableto', { VARIABLE: 'score', VALUE: 0 });
  const forever = block('control_forever');
  const move = block('motion_movesteps', { STEPS: 4 });
  const ifEdge = block('control_if');
  const turn = block('motion_turnright', { DEGREES: 180 });
  const bump = block('data_changevariableby', { VARIABLE: 'score', VALUE: 1 });
  const sound = block('sound_play', { SOUND: 'pop' });

  hat.nextId = setScore.id;
  setScore.nextId = forever.id;
  forever.branchId = move.id;
  move.nextId = ifEdge.id;
  ifEdge.branchId = turn.id;
  turn.nextId = bump.id;
  bump.nextId = sound.id;

  const blocks: Record<string, BlockInstance> = {
    [hat.id]: hat,
    [setScore.id]: setScore,
    [forever.id]: forever,
    [move.id]: move,
    [ifEdge.id]: ifEdge,
    [turn.id]: turn,
    [bump.id]: bump,
    [sound.id]: sound,
  };

  const rocket: SpriteState = {
    id: uuid(),
    name: 'Rocket_01',
    x: 0,
    y: 0,
    direction: 90,
    size: 100,
    visible: true,
    costumeUrl: ROCKET,
    blocks,
    scriptRoots: [hat.id],
  };

  const star: SpriteState = {
    id: uuid(),
    name: 'Star_01',
    x: 100,
    y: 60,
    direction: 90,
    size: 80,
    visible: true,
    costumeUrl: STAR,
    blocks: {},
    scriptRoots: [],
  };

  return {
    id: uuid(),
    name: 'Untitled Project',
    version: 1,
    updatedAt: new Date().toISOString(),
    stageWidth: 480,
    stageHeight: 360,
    variables: { score: 0, lives: 3 },
    sprites: [rocket, star],
    activeSpriteId: rocket.id,
  };
}

export function cloneBlockFromDef(
  opcode: string,
  fields?: Record<string, string | number>
): BlockInstance {
  const { getDef } = require('./blocks') as typeof import('./blocks');
  const def = getDef(opcode);
  return block(opcode, { ...(def?.fields || {}), ...fields });
}

export function newBlockFromOpcode(opcode: string): BlockInstance {
  // inline to avoid require issues
  const defaults: Record<string, Record<string, string | number>> = {
    motion_movesteps: { STEPS: 10 },
    motion_turnright: { DEGREES: 15 },
    motion_turnleft: { DEGREES: 15 },
    motion_gotoxy: { X: 0, Y: 0 },
    motion_pointindirection: { DIRECTION: 90 },
    motion_changexby: { DX: 10 },
    motion_changeyby: { DY: 10 },
    motion_setx: { X: 0 },
    motion_sety: { Y: 0 },
    control_wait: { SECS: 1 },
    control_repeat: { TIMES: 10 },
    data_setvariableto: { VARIABLE: 'score', VALUE: 0 },
    data_changevariableby: { VARIABLE: 'score', VALUE: 1 },
    sound_play: { SOUND: 'pop' },
    looks_setsizeto: { SIZE: 100 },
  };
  return block(opcode, defaults[opcode] || {});
}

const LS_KEY = 'snap-atelier-project';
const LS_LIST = 'snap-atelier-projects';

export function saveProjectLocal(project: Project): void {
  const next = {
    ...project,
    updatedAt: new Date().toISOString(),
    version: project.version + 1,
  };
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  const list = listLocalProjects().filter((p) => p.id !== next.id);
  list.unshift({
    id: next.id,
    name: next.name,
    updatedAt: next.updatedAt,
  });
  localStorage.setItem(LS_LIST, JSON.stringify(list.slice(0, 20)));
  localStorage.setItem(`snap-project-${next.id}`, JSON.stringify(next));
}

export function loadProjectLocal(): Project | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function loadProjectById(id: string): Project | null {
  try {
    const raw = localStorage.getItem(`snap-project-${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function listLocalProjects(): Array<{ id: string; name: string; updatedAt: string }> {
  try {
    const raw = localStorage.getItem(LS_LIST);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getActiveSprite(project: Project): SpriteState {
  return (
    project.sprites.find((s) => s.id === project.activeSpriteId) ||
    project.sprites[0]
  );
}
