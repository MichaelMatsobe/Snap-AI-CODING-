import type { BlockInstance, SpriteState } from './types';

export function stackFromRoot(
  blocks: Record<string, BlockInstance>,
  rootId: string
): string[] {
  const out: string[] = [];
  let id: string | null = rootId;
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    out.push(id);
    id = blocks[id]?.nextId ?? null;
  }
  return out;
}

export function detachBlock(sprite: SpriteState, blockId: string): void {
  for (const b of Object.values(sprite.blocks)) {
    if (b.nextId === blockId) b.nextId = null;
    if (b.branchId === blockId) b.branchId = null;
    if (b.branch2Id === blockId) b.branch2Id = null;
    if (b.inputs) {
      for (const [k, inp] of Object.entries(b.inputs)) {
        if (inp.kind === 'block' && inp.blockId === blockId) {
          delete b.inputs[k];
        }
      }
    }
  }
  sprite.scriptRoots = sprite.scriptRoots.filter((id) => id !== blockId);
}

export function attachNext(sprite: SpriteState, parentId: string, childId: string): void {
  detachBlock(sprite, childId);
  const parent = sprite.blocks[parentId];
  const child = sprite.blocks[childId];
  if (!parent || !child) return;
  const oldNext = parent.nextId;
  parent.nextId = childId;
  let end = child;
  const seen = new Set<string>();
  while (end.nextId && !seen.has(end.nextId)) {
    seen.add(end.id);
    end = sprite.blocks[end.nextId]!;
  }
  end.nextId = oldNext;
  sprite.scriptRoots = sprite.scriptRoots.filter((id) => id !== childId);
}

export function attachBranch(sprite: SpriteState, parentId: string, childId: string): void {
  detachBlock(sprite, childId);
  const parent = sprite.blocks[parentId];
  if (!parent) return;
  parent.branchId = childId;
  sprite.scriptRoots = sprite.scriptRoots.filter((id) => id !== childId);
}

export function placeAsRoot(sprite: SpriteState, blockId: string, x: number, y: number): void {
  detachBlock(sprite, blockId);
  const b = sprite.blocks[blockId];
  if (!b) return;
  b.x = x;
  b.y = y;
  if (!sprite.scriptRoots.includes(blockId)) sprite.scriptRoots.push(blockId);
}

export function deleteBlockCascade(sprite: SpriteState, blockId: string): void {
  const toDelete = new Set<string>();
  const walk = (id: string | null) => {
    if (!id || toDelete.has(id)) return;
    toDelete.add(id);
    const b = sprite.blocks[id];
    if (!b) return;
    walk(b.nextId);
    walk(b.branchId);
    walk(b.branch2Id);
    if (b.inputs) {
      for (const inp of Object.values(b.inputs)) {
        if (inp.kind === 'block') walk(inp.blockId);
      }
    }
  };
  walk(blockId);
  detachBlock(sprite, blockId);
  for (const id of toDelete) delete sprite.blocks[id];
  sprite.scriptRoots = sprite.scriptRoots.filter((id) => !toDelete.has(id));
}
