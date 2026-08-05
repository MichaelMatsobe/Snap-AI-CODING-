/**
 * Import Scratch 3 .sb3 (ZIP + project.json) into Atelier Project format.
 */

import JSZip from 'jszip';
import { v4 as uuid } from 'uuid';
import type { BlockInput, BlockInstance, Costume, Project, SpriteState } from './types';

interface Sb3Block {
  opcode: string;
  next?: string | null;
  parent?: string | null;
  inputs?: Record<string, unknown>;
  fields?: Record<string, [string, string?]>;
  shadow?: boolean;
  topLevel?: boolean;
  x?: number;
  y?: number;
}

interface Sb3Target {
  isStage: boolean;
  name: string;
  variables?: Record<string, [string, string | number]>;
  lists?: Record<string, [string, Array<string | number>]>;
  blocks?: Record<string, Sb3Block>;
  costumes?: Array<{ name: string; md5ext?: string; dataFormat?: string; assetId?: string }>;
  currentCostume?: number;
  x?: number;
  y?: number;
  direction?: number;
  size?: number;
  visible?: boolean;
}

interface Sb3Project {
  targets: Sb3Target[];
  meta?: { semver?: string };
}

function parseInput(raw: unknown): BlockInput | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const payload = raw[1];
  // [1, blockId] or [2, blockId] — block reference
  if (typeof payload === 'string') {
    return { kind: 'block', blockId: payload };
  }
  // [1, [type, value]] shadow literal
  if (Array.isArray(payload)) {
    const v = payload[1];
    if (typeof v === 'string' || typeof v === 'number') {
      return { kind: 'shadow', value: v };
    }
  }
  return null;
}

function convertBlocks(sb3Blocks: Record<string, Sb3Block>): {
  blocks: Record<string, BlockInstance>;
  roots: string[];
} {
  const blocks: Record<string, BlockInstance> = {};
  const roots: string[] = [];

  for (const [id, b] of Object.entries(sb3Blocks)) {
    if (b.shadow) continue; // shadows absorbed into inputs

    const fields: Record<string, string | number> = {};
    if (b.fields) {
      for (const [k, arr] of Object.entries(b.fields)) {
        fields[k] = arr[0];
      }
    }

    const inputs: Record<string, BlockInput> = {};
    if (b.inputs) {
      for (const [k, raw] of Object.entries(b.inputs)) {
        // SUBSTACK / SUBSTACK2 handled as branch
        if (k === 'SUBSTACK' || k === 'SUBSTACK2') continue;
        const parsed = parseInput(raw);
        if (parsed) inputs[k] = parsed;
        // also mirror numeric shadows into fields for simple opcodes
        if (parsed?.kind === 'shadow') {
          fields[k] = parsed.value;
        }
      }
    }

    let branchId: string | null = null;
    let branch2Id: string | null = null;
    if (b.inputs?.SUBSTACK && Array.isArray(b.inputs.SUBSTACK)) {
      const p = b.inputs.SUBSTACK[1];
      if (typeof p === 'string') branchId = p;
    }
    if (b.inputs?.SUBSTACK2 && Array.isArray(b.inputs.SUBSTACK2)) {
      const p = b.inputs.SUBSTACK2[1];
      if (typeof p === 'string') branch2Id = p;
    }
    if (b.inputs?.CONDITION && Array.isArray(b.inputs.CONDITION)) {
      const p = b.inputs.CONDITION[1];
      if (typeof p === 'string') {
        inputs.CONDITION = { kind: 'block', blockId: p };
      }
    }

    blocks[id] = {
      id,
      opcode: b.opcode,
      fields,
      inputs,
      nextId: b.next || null,
      branchId,
      branch2Id,
      x: b.x,
      y: b.y,
    };

    if (b.topLevel) roots.push(id);
  }

  return { blocks, roots };
}

async function loadAsset(
  zip: JSZip,
  costume: { name: string; md5ext?: string; dataFormat?: string; assetId?: string }
): Promise<Costume> {
  const name = costume.md5ext || `${costume.assetId}.${costume.dataFormat || 'png'}`;
  const file = zip.file(name);
  let url =
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="40" fill="#7cd2f1"/></svg>`
    );
  if (file) {
    const blob = await file.async('blob');
    url = URL.createObjectURL(blob);
  }
  return {
    id: uuid(),
    name: costume.name,
    url,
    width: 96,
    height: 96,
  };
}

export async function importSb3(file: ArrayBuffer | Blob): Promise<Project> {
  const zip = await JSZip.loadAsync(file);
  const jsonFile = zip.file('project.json');
  if (!jsonFile) throw new Error('Invalid SB3: missing project.json');
  const text = await jsonFile.async('string');
  const data = JSON.parse(text) as Sb3Project;

  const variables: Project['variables'] = {};
  const lists: Project['lists'] = {};
  const sprites: SpriteState[] = [];

  for (const target of data.targets || []) {
    if (target.variables) {
      for (const [, [name, val]] of Object.entries(target.variables)) {
        variables[name] = val;
      }
    }
    if (target.lists) {
      for (const [, [name, arr]] of Object.entries(target.lists)) {
        lists[name] = arr || [];
      }
    }

    if (target.isStage) continue;

    const { blocks, roots } = convertBlocks(target.blocks || {});
    const costumes: Costume[] = [];
    for (const c of target.costumes || []) {
      costumes.push(await loadAsset(zip, c));
    }
    if (!costumes.length) {
      costumes.push({
        id: uuid(),
        name: 'default',
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="12" fill="#9966FF"/></svg>`
          ),
        width: 96,
        height: 96,
      });
    }
    const idx = target.currentCostume || 0;

    sprites.push({
      id: uuid(),
      name: target.name,
      x: target.x ?? 0,
      y: target.y ?? 0,
      direction: target.direction ?? 90,
      size: target.size ?? 100,
      visible: target.visible !== false,
      costumeUrl: costumes[Math.min(idx, costumes.length - 1)].url,
      costumes,
      costumeIndex: Math.min(idx, costumes.length - 1),
      ghost: 0,
      rotationStyle: 'all around',
      blocks,
      scriptRoots: roots,
    });
  }

  if (!sprites.length) {
    throw new Error('No sprites found in SB3');
  }

  return {
    id: uuid(),
    name: 'Imported SB3',
    version: 1,
    updatedAt: new Date().toISOString(),
    stageWidth: 480,
    stageHeight: 360,
    variables: Object.keys(variables).length ? variables : { score: 0 },
    lists: Object.keys(lists).length ? lists : { list: [] },
    sprites,
    activeSpriteId: sprites[0].id,
    penTrails: [],
  };
}
