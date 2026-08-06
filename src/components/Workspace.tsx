import React, { useCallback } from 'react';
import type { SpriteState } from '../engine/types';
import { getDef } from '../engine/blocks';
import { BlockView } from './BlockView';
import {
  attachBranch,
  attachBranch2,
  attachNext,
  placeAsRoot,
  stackFromRoot,
  deleteBlockCascade,
} from '../engine/scripts';
import { newBlockFromOpcode } from '../engine/project';

interface Props {
  sprite: SpriteState;
  onChange: (sprite: SpriteState) => void;
  /** Touch flow: when a palette block was tapped, the next canvas tap places it. */
  pendingOpcode?: string | null;
  onConsumePending?: () => void;
}

export function Workspace({ sprite, onChange, pendingOpcode, onConsumePending }: Props) {
  const mutate = useCallback(
    (fn: (s: SpriteState) => void) => {
      const copy = structuredClone(sprite);
      fn(copy);
      onChange(copy);
    },
    [sprite, onChange]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const opcode = e.dataTransfer.getData('application/snap-opcode');
    const existingId = e.dataTransfer.getData('application/snap-block-id');

    mutate((s) => {
      if (opcode) {
        const b = newBlockFromOpcode(opcode);
        b.x = x;
        b.y = y;
        s.blocks[b.id] = b;
        s.scriptRoots.push(b.id);
      } else if (existingId && s.blocks[existingId]) {
        placeAsRoot(s, existingId, x, y);
      }
    });
  };

  // Tap-to-place (touch devices): place the pending palette block at a point.
  const placeAt = useCallback(
    (clientX: number, clientY: number, container: HTMLElement) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const opcode = pendingOpcode;
      if (!opcode) return;
      mutate((s) => {
        const b = newBlockFromOpcode(opcode);
        if (!b) return;
        b.x = x;
        b.y = y;
        s.blocks[b.id] = b;
        s.scriptRoots.push(b.id);
        onConsumePending?.();
      });
    },
    [pendingOpcode, mutate, onConsumePending]
  );

  const onDropOnBlock = (e: React.DragEvent, targetId: string, mode: 'next' | 'branch' | 'branch2') => {
    e.preventDefault();
    e.stopPropagation();
    const opcode = e.dataTransfer.getData('application/snap-opcode');
    const existingId = e.dataTransfer.getData('application/snap-block-id');

    mutate((s) => {
      let childId = existingId;
      if (opcode) {
        const b = newBlockFromOpcode(opcode);
        s.blocks[b.id] = b;
        childId = b.id;
      }
      if (!childId || childId === targetId) return;
      if (mode === 'branch') attachBranch(s, targetId, childId);
      else if (mode === 'branch2') attachBranch2(s, targetId, childId);
      else attachNext(s, targetId, childId);
    });
  };

  const onDropInput = (hostId: string, inputName: string, e: React.DragEvent) => {
    const opcode = e.dataTransfer.getData('application/snap-opcode');
    const existingId = e.dataTransfer.getData('application/snap-block-id');

    mutate((s) => {
      let reporterId = existingId;
      if (opcode) {
        const def = getDef(opcode);
        if (def) {
          const okShape = def.shape === 'reporter' || def.shape === 'boolean';
          const okPrefix =
            def.opcode.startsWith('operator_') ||
            def.opcode.startsWith('sensing_') ||
            def.opcode.startsWith('data_') ||
            def.opcode.startsWith('motion_x') ||
            def.opcode.startsWith('motion_y') ||
            def.opcode.startsWith('motion_direction');
          if (!okShape && !okPrefix) return;
        }
        const b = newBlockFromOpcode(opcode);
        s.blocks[b.id] = b;
        reporterId = b.id;
        s.scriptRoots = s.scriptRoots.filter((r) => r !== b.id);
      }
      if (!reporterId || !s.blocks[reporterId]) return;
      s.scriptRoots = s.scriptRoots.filter((r) => r !== reporterId);
      const host = s.blocks[hostId];
      if (!host) return;
      if (!host.inputs) host.inputs = {};
      host.inputs[inputName] = { kind: 'block', blockId: reporterId };
      // clear literal field so eval prefers nested block
      if (host.fields[inputName] !== undefined) {
        // keep field as fallback display only when no nested
      }
    });
  };

  const fieldChange = (id: string, key: string, value: string) => {
    mutate((s) => {
      const blk = s.blocks[id];
      if (!blk) return;
      const n = Number(value);
      const v = Number.isFinite(n) && value.trim() !== '' ? n : value;
      blk.fields[key] = v;
      if (!blk.inputs) blk.inputs = {};
      // only set shadow if no nested block already plugged
      if (!blk.inputs[key] || blk.inputs[key].kind === 'shadow') {
        blk.inputs[key] = { kind: 'shadow', value: v };
      }
    });
  };

  const renderStack = (rootId: string, originX: number, originY: number) => {
    const ids = stackFromRoot(sprite.blocks, rootId);
    let y = originY;
    return ids.map((id) => {
      const b = sprite.blocks[id];
      if (!b) return null;
      const def = getDef(b.opcode);
      const isC = def?.shape === 'c';
      const isIfElse = b.opcode === 'control_if_else';
      const node = (
        <div key={id} className="absolute" style={{ left: originX, top: y }}>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/snap-block-id', id);
              const d = getDef(b.opcode);
              if (d) e.dataTransfer.setData('application/snap-shape', d.shape);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDoubleClick={() => mutate((s) => deleteBlockCascade(s, id))}
            title="Double-click to delete"
          >
            <BlockView
              block={b}
              sprite={sprite}
              onFieldChange={(key, value) => fieldChange(id, key, value)}
              onDropInput={(inputName, e) => onDropInput(id, inputName, e)}
              onNestedFieldChange={(blockId, key, value) => fieldChange(blockId, key, value)}
              onNestedDropInput={(blockId, inputName, e) => onDropInput(blockId, inputName, e)}
            />
          </div>
          <div
            className="h-3 -mb-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => onDropOnBlock(e, id, 'next')}
          />
          {isC && (
            <div className="ml-4 mt-1 border-l-2 border-white/20 pl-2 min-h-[28px]">
              <div
                className="text-[9px] text-zinc-500 mb-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropOnBlock(e, id, 'branch')}
              >
                {b.branchId ? null : 'drop then-body here'}
              </div>
              {b.branchId && renderInner(b.branchId)}
              {isIfElse && (
                <>
                  <div className="text-[9px] text-amber-500/80 mt-2 mb-1 font-bold">else</div>
                  <div
                    className="text-[9px] text-zinc-500 mb-1 min-h-[20px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropOnBlock(e, id, 'branch2')}
                  >
                    {b.branch2Id ? null : 'drop else-body here'}
                  </div>
                  {b.branch2Id && renderInner(b.branch2Id)}
                </>
              )}
            </div>
          )}
        </div>
      );
      y += isC ? (isIfElse ? 120 : 88) : 40;
      return node;
    });
  };

  const renderInner = (rootId: string): React.ReactNode => {
    const ids = stackFromRoot(sprite.blocks, rootId);
    return ids.map((id) => {
      const b = sprite.blocks[id];
      if (!b) return null;
      const def = getDef(b.opcode);
      const isC = def?.shape === 'c';
      const isIfElse = b.opcode === 'control_if_else';
      return (
        <div key={id} className="mb-0.5">
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/snap-block-id', id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => onDropOnBlock(e, id, 'next')}
            onDoubleClick={() => mutate((s) => deleteBlockCascade(s, id))}
          >
            <BlockView
              block={b}
              sprite={sprite}
              onFieldChange={(key, value) => fieldChange(id, key, value)}
              onDropInput={(inputName, e) => onDropInput(id, inputName, e)}
              onNestedFieldChange={(blockId, key, value) => fieldChange(blockId, key, value)}
              onNestedDropInput={(blockId, inputName, e) => onDropInput(blockId, inputName, e)}
            />
          </div>
          {isC && (
            <div className="ml-3 mt-0.5 border-l border-white/15 pl-2">
              <div
                className="text-[8px] text-zinc-600"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropOnBlock(e, id, 'branch')}
              >
                {b.branchId ? null : 'body'}
              </div>
              {b.branchId && renderInner(b.branchId)}
              {isIfElse && (
                <>
                  <div className="text-[8px] text-amber-600/70 mt-1">else</div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropOnBlock(e, id, 'branch2')}
                  >
                    {b.branch2Id ? null : <span className="text-[8px] text-zinc-600">else body</span>}
                  </div>
                  {b.branch2Id && renderInner(b.branch2Id)}
                </>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="absolute inset-0 overflow-auto custom-scrollbar"
      onDragOver={onDragOver}
      onDrop={onDropCanvas}
      onClick={(e) => {
        if (pendingOpcode) placeAt(e.clientX, e.clientY, e.currentTarget);
      }}
    >
      {pendingOpcode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-primary text-on-primary text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
          Tap the canvas to place the block · Esc cancels
        </div>
      )}
      <div className="relative w-full min-h-full" style={{ height: 1600, width: 1100 }}>
        {sprite.scriptRoots.map((rootId) => {
          const root = sprite.blocks[rootId];
          if (!root) return null;
          return <React.Fragment key={rootId}>{renderStack(rootId, root.x ?? 40, root.y ?? 40)}</React.Fragment>;
        })}
        {sprite.scriptRoots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm pointer-events-none">
            Drag blocks · drop reporters into number/boolean slots (multi-level OK)
          </div>
        )}
      </div>
    </div>
  );
}
