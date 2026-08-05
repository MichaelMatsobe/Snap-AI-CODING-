import React, { useCallback } from 'react';
import type { SpriteState } from '../engine/types';
import { getDef } from '../engine/blocks';
import { BlockView } from './BlockView';
import {
  attachBranch,
  attachNext,
  placeAsRoot,
  stackFromRoot,
  deleteBlockCascade,
} from '../engine/scripts';
import { newBlockFromOpcode } from '../engine/project';

interface Props {
  sprite: SpriteState;
  onChange: (sprite: SpriteState) => void;
}

export function Workspace({ sprite, onChange }: Props) {
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

  const onDropOnBlock = (e: React.DragEvent, targetId: string, asBranch: boolean) => {
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
      if (asBranch) attachBranch(s, targetId, childId);
      else attachNext(s, targetId, childId);
    });
  };

  const onDropInput = (hostId: string, inputName: string, e: React.DragEvent) => {
    const opcode = e.dataTransfer.getData('application/snap-opcode');
    const existingId = e.dataTransfer.getData('application/snap-block-id');
    const shape = e.dataTransfer.getData('application/snap-shape');

    mutate((s) => {
      let reporterId = existingId;
      if (opcode) {
        const def = getDef(opcode);
        if (def && def.shape !== 'reporter' && def.shape !== 'boolean') {
          // still allow operators/sensing from palette by opcode
          if (!def.opcode.startsWith('operator_') && !def.opcode.startsWith('sensing_') && !def.opcode.startsWith('data_')) {
            return;
          }
        }
        void shape;
        const b = newBlockFromOpcode(opcode);
        s.blocks[b.id] = b;
        reporterId = b.id;
        s.scriptRoots = s.scriptRoots.filter((r) => r !== b.id);
      }
      if (!reporterId || !s.blocks[reporterId]) return;
      // detach from roots if needed
      s.scriptRoots = s.scriptRoots.filter((r) => r !== reporterId);
      const host = s.blocks[hostId];
      if (!host) return;
      if (!host.inputs) host.inputs = {};
      host.inputs[inputName] = { kind: 'block', blockId: reporterId };
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
      blk.inputs[key] = { kind: 'shadow', value: v };
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
            />
          </div>
          <div
            className="h-3 -mb-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => onDropOnBlock(e, id, false)}
          />
          {isC && (
            <div className="ml-4 mt-1 border-l-2 border-white/20 pl-2 min-h-[28px]">
              <div
                className="text-[9px] text-zinc-500 mb-1"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDropOnBlock(e, id, true)}
              >
                {b.branchId ? null : 'drop body here'}
              </div>
              {b.branchId && renderInner(b.branchId)}
            </div>
          )}
        </div>
      );
      y += isC ? 88 : 40;
      return node;
    });
  };

  const renderInner = (rootId: string): React.ReactNode => {
    const ids = stackFromRoot(sprite.blocks, rootId);
    return ids.map((id) => {
      const b = sprite.blocks[id];
      if (!b) return null;
      return (
        <div
          key={id}
          className="mb-0.5"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/snap-block-id', id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => onDropOnBlock(e, id, false)}
          onDoubleClick={() => mutate((s) => deleteBlockCascade(s, id))}
        >
          <BlockView
            block={b}
            sprite={sprite}
            onFieldChange={(key, value) => fieldChange(id, key, value)}
            onDropInput={(inputName, e) => onDropInput(id, inputName, e)}
          />
        </div>
      );
    });
  };

  return (
    <div className="absolute inset-0 overflow-auto custom-scrollbar" onDragOver={onDragOver} onDrop={onDropCanvas}>
      <div className="relative w-full min-h-full" style={{ height: 1400, width: 1000 }}>
        {sprite.scriptRoots.map((rootId) => {
          const root = sprite.blocks[rootId];
          if (!root) return null;
          return <React.Fragment key={rootId}>{renderStack(rootId, root.x ?? 40, root.y ?? 40)}</React.Fragment>;
        })}
        {sprite.scriptRoots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm pointer-events-none">
            Drag blocks · drop reporters into number slots
          </div>
        )}
      </div>
    </div>
  );
}
