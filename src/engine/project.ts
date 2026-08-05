import { v4 as uuid } from 'uuid';
import type { BlockInstance, Costume, Project, SpriteState } from './types';

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

function costume(name: string, url: string): Costume {
  return { id: uuid(), name, url, width: 128, height: 128 };
}

export function createDefaultProject(): Project {
  const hat = block('event_whenflagclicked', {}, { x: 40, y: 40 });
  const setScore = block('data_setvariableto', { VARIABLE: 'score', VALUE: 0 });
  const forever = block('control_forever');
  const move = block('motion_movesteps', { STEPS: 4 });
  const bounce = block('motion_ifonedgebounce');
  const bump = block('data_changevariableby', { VARIABLE: 'score', VALUE: 1 });

  hat.nextId = setScore.id;
  setScore.nextId = forever.id;
  forever.branchId = move.id;
  move.nextId = bounce.id;
  bounce.nextId = bump.id;

  const blocks: Record<string, BlockInstance> = {
    [hat.id]: hat,
    [setScore.id]: setScore,
    [forever.id]: forever,
    [move.id]: move,
    [bounce.id]: bounce,
    [bump.id]: bump,
  };

  const c1 = costume('rocket', ROCKET);
  const rocket: SpriteState = {
    id: uuid(),
    name: 'Rocket_01',
    x: 0,
    y: 0,
    direction: 90,
    size: 100,
    visible: true,
    costumeUrl: ROCKET,
    costumes: [c1],
    costumeIndex: 0,
    ghost: 0,
    rotationStyle: 'all around',
    blocks,
    scriptRoots: [hat.id],
  };

  const c2 = costume('star', STAR);
  const star: SpriteState = {
    id: uuid(),
    name: 'Star_01',
    x: 100,
    y: 60,
    direction: 90,
    size: 80,
    visible: true,
    costumeUrl: STAR,
    costumes: [c2],
    costumeIndex: 0,
    ghost: 0,
    rotationStyle: 'all around',
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
    variables: { score: 0, lives: 3, answer: '' },
    lists: { list: [], objects: [] },
    sprites: [rocket, star],
    activeSpriteId: rocket.id,
    penTrails: [],
  };
}

export function newBlockFromOpcode(opcode: string): BlockInstance {
  const { getDef } = require('./blocks') as typeof import('./blocks');
  const def = getDef(opcode);
  return block(opcode, { ...(def?.fields || {}) });
}

const LS_KEY = 'snap-atelier-project';
const LS_LIST = 'snap-atelier-projects';

function normalize(p: Project): Project {
  if (!p.lists) p.lists = { list: [] };
  if (!p.penTrails) p.penTrails = [];
  for (const s of p.sprites) {
    if (!s.costumes) {
      s.costumes = [costume(s.name, s.costumeUrl)];
      s.costumeIndex = 0;
    }
    if (s.ghost == null) s.ghost = 0;
    if (!s.rotationStyle) s.rotationStyle = 'all around';
  }
  return p;
}

export function saveProjectLocal(project: Project): void {
  const next = normalize({
    ...project,
    updatedAt: new Date().toISOString(),
    version: project.version + 1,
  });
  localStorage.setItem(LS_KEY, JSON.stringify(next));
  const list = listLocalProjects().filter((x) => x.id !== next.id);
  list.unshift({ id: next.id, name: next.name, updatedAt: next.updatedAt });
  localStorage.setItem(LS_LIST, JSON.stringify(list.slice(0, 20)));
  localStorage.setItem(`snap-project-${next.id}`, JSON.stringify(next));
}

export function loadProjectLocal(): Project | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw) as Project);
  } catch {
    return null;
  }
}

export function listLocalProjects(): Array<{ id: string; name: string; updatedAt: string }> {
  try {
    return JSON.parse(localStorage.getItem(LS_LIST) || '[]');
  } catch {
    return [];
  }
}

export function getActiveSprite(project: Project): SpriteState {
  return project.sprites.find((s) => s.id === project.activeSpriteId && !s.isClone) || project.sprites[0];
}
