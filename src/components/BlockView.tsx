import React from 'react';
import { getDef, formatLabel } from '../engine/blocks';
import type { BlockInstance } from '../engine/types';

interface Props {
  block: BlockInstance;
  onFieldChange?: (key: string, value: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
}

export function BlockView({
  block,
  onFieldChange,
  draggable,
  onDragStart,
  compact,
}: Props) {
  const def = getDef(block.opcode);
  if (!def) return null;

  const bg = def.color;
  const color = def.textColor || '#fff';
  const isHat = def.shape === 'hat';
  const isC = def.shape === 'c';

  const parts = def.label.split(/(\{[A-Z_]+\})/g);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      data-block-id={block.id}
      className={`relative text-xs font-bold select-none shadow-md ${
        isHat ? 'rounded-t-2xl rounded-b-md' : isC ? 'rounded-md' : 'rounded-md'
      } ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
      style={{ backgroundColor: bg, color, minWidth: compact ? 120 : 160 }}
    >
      <div className="flex flex-wrap items-center gap-1">
        {parts.map((part, i) => {
          const m = part.match(/^\{([A-Z_]+)\}$/);
          if (m) {
            const key = m[1];
            const val = block.fields[key] ?? '';
            return (
              <input
                key={i}
                className="bg-black/25 rounded px-1.5 py-0.5 w-14 text-center text-[11px] font-bold outline-none focus:ring-1 focus:ring-white/40"
                value={String(val)}
                onChange={(e) => onFieldChange?.(key, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      {!def.label.includes('{') && <span>{formatLabel(def, block.fields)}</span>}
    </div>
  );
}

export function PaletteBlock({
  opcode,
  onDragStart,
}: {
  opcode: string;
  onDragStart: (e: React.DragEvent, opcode: string) => void;
}) {
  const def = getDef(opcode);
  if (!def) return null;
  const fake: BlockInstance = {
    id: 'palette',
    opcode,
    fields: { ...(def.fields || {}) },
    nextId: null,
    branchId: null,
    branch2Id: null,
  };
  return (
    <div
      className="cursor-grab active:cursor-grabbing opacity-95 hover:opacity-100"
      draggable
      onDragStart={(e) => onDragStart(e, opcode)}
    >
      <BlockView block={fake} compact />
    </div>
  );
}
