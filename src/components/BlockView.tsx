import React from 'react';
import { getDef, formatLabel } from '../engine/blocks';
import type { BlockInstance, SpriteState } from '../engine/types';

interface Props {
  block: BlockInstance;
  sprite?: SpriteState;
  onFieldChange?: (key: string, value: string) => void;
  onDropInput?: (inputName: string, e: React.DragEvent) => void;
  /** When nested, parent can still receive field/drop for deeper sockets */
  onNestedFieldChange?: (blockId: string, key: string, value: string) => void;
  onNestedDropInput?: (blockId: string, inputName: string, e: React.DragEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
  nested?: boolean;
}

export function BlockView({
  block,
  sprite,
  onFieldChange,
  onDropInput,
  onNestedFieldChange,
  onNestedDropInput,
  draggable,
  onDragStart,
  compact,
  nested,
}: Props) {
  const def = getDef(block.opcode);
  if (!def) return null;

  const bg = def.color;
  const color = def.textColor || '#fff';
  const isHat = def.shape === 'hat';
  const isReporter = def.shape === 'reporter';
  const isBoolean = def.shape === 'boolean';

  const parts = def.label.split(/(\{[A-Z_]+\})/g);

  const shapeClass = isHat
    ? 'rounded-t-2xl rounded-b-md'
    : isBoolean
      ? 'rounded-none clip-boolean'
      : isReporter
        ? 'rounded-full'
        : 'rounded-md';

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      data-block-id={block.id}
      className={`relative text-xs font-bold select-none shadow-md inline-flex flex-wrap items-center gap-1 ${
        shapeClass
      } ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${nested ? 'scale-90 origin-left' : ''} ${
        isBoolean ? 'boolean-socket' : ''
      }`}
      style={{
        backgroundColor: bg,
        color,
        minWidth: compact ? 100 : 140,
        ...(isBoolean
          ? {
              clipPath: 'polygon(8px 50%, 0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)',
              paddingLeft: 14,
              paddingRight: 14,
            }
          : {}),
      }}
    >
      {parts.map((part, i) => {
        const m = part.match(/^\{([A-Z_]+)\}$/);
        if (m) {
          const key = m[1];
          const nestedIn = block.inputs?.[key];
          if (nestedIn?.kind === 'block' && sprite?.blocks[nestedIn.blockId]) {
            const nestedBlock = sprite.blocks[nestedIn.blockId];
            return (
              <span
                key={i}
                className="inline-block"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDropInput?.(key, e);
                }}
              >
                <BlockView
                  block={nestedBlock}
                  sprite={sprite}
                  nested
                  compact
                  onFieldChange={(k, v) => onNestedFieldChange?.(nestedBlock.id, k, v)}
                  onDropInput={(inputName, e) => onNestedDropInput?.(nestedBlock.id, inputName, e)}
                  onNestedFieldChange={onNestedFieldChange}
                  onNestedDropInput={onNestedDropInput}
                />
              </span>
            );
          }
          const val = nestedIn?.kind === 'shadow' ? nestedIn.value : block.fields[key] ?? '';
          const isCond = key === 'CONDITION' || key === 'OPERAND' || key === 'OPERAND1' || key === 'OPERAND2';
          return (
            <input
              key={i}
              className={`bg-black/25 px-1.5 py-0.5 w-12 text-center text-[11px] font-bold outline-none focus:ring-1 focus:ring-white/40 ${
                isCond ? 'rounded-sm border border-dashed border-white/30' : 'rounded'
              }`}
              value={String(val)}
              onChange={(e) => onFieldChange?.(key, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDropInput?.(key, e);
              }}
              title={isCond ? 'Type or drop a boolean / reporter' : 'Type a value or drop a reporter block'}
              draggable={false}
            />
          );
        }
        return part ? <span key={i}>{part}</span> : null;
      })}
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
    inputs: Object.fromEntries(
      Object.entries(def.fields || {}).map(([k, v]) => [k, { kind: 'shadow' as const, value: v }])
    ),
    nextId: null,
    branchId: null,
    branch2Id: null,
  };
  return (
    <div
      className="cursor-grab active:cursor-grabbing opacity-95 hover:opacity-100"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/snap-opcode', opcode);
        e.dataTransfer.setData('application/snap-shape', def.shape);
        onDragStart(e, opcode);
      }}
    >
      <BlockView block={fake} compact />
    </div>
  );
}
