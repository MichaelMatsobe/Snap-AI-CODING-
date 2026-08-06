import React, { useCallback, useEffect, useRef, useState } from 'react';
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

interface SnapSlot {
  id: string;
  mode: 'next' | 'branch' | 'branch2';
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

  // ── Pointer dragging (touch devices) ─────────────────────────────────────
  // HTML5 drag-and-drop does not fire on touch screens at all, so blocks are
  // repositioned with pointer events. Desktop keeps the native DnD flow.
  const canvasRef = useRef<HTMLDivElement>(null);
  const binRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [overBin, setOverBin] = useState(false);
  // Current magnetic-snap target (highlighted slot where the block would attach).
  const [hoverSlot, setHoverSlot] = useState<SnapSlot | null>(null);
  const hoverSlotRef = useRef<SnapSlot | null>(null);
  const didDrag = useRef(false);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const updateHover = (slot: SnapSlot | null) => {
    const prev = hoverSlotRef.current;
    const same =
      prev === slot || (!!prev && !!slot && prev.id === slot.id && prev.mode === slot.mode);
    hoverSlotRef.current = slot;
    if (!same) setHoverSlot(slot);
  };

  const canvasPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const binHit = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    return !!el?.closest('[data-trash-bin]');
  };

  /** Only stack-shaped blocks snap into stacks (reporters go into sockets). */
  const canSnap = (opcode: string) => {
    const shape = getDef(opcode)?.shape;
    return shape === 'stack' || shape === 'hat' || shape === 'c';
  };

  /**
   * Magnetic snap: find the best block near the drop point to attach to.
   *  - inside a C-body → attach as branch / else-branch
   *  - near a block's bottom edge → attach as next
   */
  const findSnapSlot = (cx: number, cy: number, draggedId?: string | null): SnapSlot | null => {
    if (!canvasRef.current) return null;
    const els = canvasRef.current.querySelectorAll<HTMLElement>('[data-block-id]');
    let best: (SnapSlot & { score: number }) | null = null;
    for (const el of els) {
      const id = el.dataset.blockId;
      if (!id || id === draggedId) continue;
      const b = sprite.blocks[id];
      if (!b || !canSnap(b.opcode)) continue;
      const r = el.getBoundingClientRect();
      const def = getDef(b.opcode);

      // Branch / else-body: dropping inside the C-body area attaches there.
      if (def?.shape === 'c' && cy >= r.top && cy <= r.bottom - 6 && cx >= r.left + 36 && cx <= r.right) {
        const isIfElse = b.opcode === 'control_if_else';
        const mode = isIfElse ? (cx < (r.left + r.right) / 2 ? 'branch' : 'branch2') : 'branch';
        const score = Math.abs(cy - (r.top + r.bottom) / 2) * 0.5;
        if (!best || score < best.score) best = { id, mode, score };
        continue;
      }
      // Next-slot: near the bottom edge of the block, horizontally aligned.
      if (cy >= r.bottom - 20 && cy <= r.bottom + 34 && cx >= r.left - 16 && cx <= r.right + 16) {
        const score = Math.abs(cy - r.bottom) + Math.abs(cx - (r.left + r.right) / 2) * 0.1;
        if (!best || score < best.score) best = { id, mode: 'next', score };
      }
    }
    return best ? { id: best.id, mode: best.mode } : null;
  };

  const autoScroll = (cx: number, cy: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const M = 44;
    let dx = 0;
    let dy = 0;
    if (cx < r.left + M) dx = -16;
    else if (cx > r.right - M) dx = 16;
    if (cy < r.top + M) dy = -16;
    else if (cy > r.bottom - M) dy = 16;
    if (dx) c.scrollLeft += dx;
    if (dy) c.scrollTop += dy;
  };

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const p = canvasPoint(e.clientX, e.clientY);
      if (p) {
        setDragPos({ x: p.x - dragOffset.current.dx, y: p.y - dragOffset.current.dy });
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) didDrag.current = true;
      }
      const overBinNow = binHit(e.clientX, e.clientY);
      setOverBin(overBinNow);
      updateHover(overBinNow ? null : findSnapSlot(e.clientX, e.clientY, dragId));
      autoScroll(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      const id = dragId;
      setDragId(null);
      setDragPos(null);
      setOverBin(false);
      updateHover(null);
      if (!id) return;
      const p = canvasPoint(e.clientX, e.clientY);
      if (binHit(e.clientX, e.clientY)) {
        mutate((s) => deleteBlockCascade(s, id));
        return;
      }
      const slot = hoverSlotRef.current ?? findSnapSlot(e.clientX, e.clientY, id);
      if (slot) {
        mutate((s) => {
          if (slot.mode === 'next') attachNext(s, slot.id, id);
          else if (slot.mode === 'branch') attachBranch(s, slot.id, id);
          else attachBranch2(s, slot.id, id);
        });
      } else if (p) {
        mutate((s) => placeAsRoot(s, id, p.x - dragOffset.current.dx, p.y - dragOffset.current.dy));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, mutate]);

  const onPointerDownBlock = (e: React.PointerEvent, id: string) => {
    if (e.pointerType !== 'touch') return; // mouse/keyboard keep HTML5 DnD
    if ((e.target as HTMLElement).closest('input,button,textarea,select')) return;
    e.preventDefault();
    const p = canvasPoint(e.clientX, e.clientY);
    if (!p) return;
    const el = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - el.left, dy: e.clientY - el.top };
    didDrag.current = false;
    updateHover(null);
    setDragId(id);
    setDragPos({ x: p.x - dragOffset.current.dx, y: p.y - dragOffset.current.dy });
  };

  const onCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    updateHover(
      findSnapSlot(
        e.clientX,
        e.clientY,
        e.dataTransfer.getData('application/snap-block-id') || null
      )
    );
  };

  const onDropCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    const p = canvasPoint(e.clientX, e.clientY);
    if (!p) return;
    const opcode = e.dataTransfer.getData('application/snap-opcode');
    const existingId = e.dataTransfer.getData('application/snap-block-id');
    const slot = hoverSlotRef.current ?? findSnapSlot(e.clientX, e.clientY, existingId || null);
    updateHover(null);

    mutate((s) => {
      if (opcode) {
        const b = newBlockFromOpcode(opcode);
        if (!b) return;
        s.blocks[b.id] = b;
        if (slot && canSnap(opcode)) {
          if (slot.mode === 'next') attachNext(s, slot.id, b.id);
          else if (slot.mode === 'branch') attachBranch(s, slot.id, b.id);
          else attachBranch2(s, slot.id, b.id);
        } else {
          b.x = p.x;
          b.y = p.y;
          s.scriptRoots.push(b.id);
        }
      } else if (existingId && s.blocks[existingId]) {
        if (slot) {
          if (slot.mode === 'next') attachNext(s, slot.id, existingId);
          else if (slot.mode === 'branch') attachBranch(s, slot.id, existingId);
          else attachBranch2(s, slot.id, existingId);
        } else {
          placeAsRoot(s, existingId, p.x, p.y);
        }
      }
    });
  };

  // Tap-to-place (touch devices): place the pending palette block at a point.
  const placeAt = useCallback(
    (clientX: number, clientY: number) => {
      if (didDrag.current) {
        didDrag.current = false;
        return;
      }
      const p = canvasPoint(clientX, clientY);
      const opcode = pendingOpcode;
      if (!opcode || !p) return;
      mutate((s) => {
        const b = newBlockFromOpcode(opcode);
        if (!b) return;
        b.x = p.x;
        b.y = p.y;
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
        if (!b) return;
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
        if (!b) return;
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
      if (!blk.inputs[key] || blk.inputs[key].kind === 'shadow') {
        blk.inputs[key] = { kind: 'shadow', value: v };
      }
    });
  };

  const zoneOver = (e: React.DragEvent) => {
    e.preventDefault();
    // no stopPropagation — let the canvas compute the snap highlight
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
      const isGhost = dragId === id;
      const hoverNext = hoverSlot?.id === id && hoverSlot.mode === 'next';
      const hoverBranch = hoverSlot?.id === id && hoverSlot.mode === 'branch';
      const hoverBranch2 = hoverSlot?.id === id && hoverSlot.mode === 'branch2';
      const node = (
        <div key={id} className="absolute" style={{ left: originX, top: y, opacity: isGhost ? 0.25 : 1 }}>
          <div
            data-block-id={id}
            draggable
            className="touch-none"
            onPointerDown={(e) => onPointerDownBlock(e, id)}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/snap-block-id', id);
              const d = getDef(b.opcode);
              if (d) e.dataTransfer.setData('application/snap-shape', d.shape);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDoubleClick={() => mutate((s) => deleteBlockCascade(s, id))}
            title="Drag to move · drop near a block to snap · double-click or trash bin to delete"
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
            className={`h-3 -mb-1 rounded ${hoverNext ? 'bg-primary/80 animate-pulse' : ''}`}
            onDragOver={zoneOver}
            onDrop={(e) => onDropOnBlock(e, id, 'next')}
          />
          {isC && (
            <div
              className={`ml-4 mt-1 border-l-2 pl-2 min-h-[28px] transition-colors ${
                hoverBranch ? 'border-primary' : 'border-white/20'
              }`}
            >
              <div
                className="text-[9px] text-zinc-500 mb-1"
                onDragOver={zoneOver}
                onDrop={(e) => onDropOnBlock(e, id, 'branch')}
              >
                {b.branchId ? null : hoverBranch ? 'snap here' : 'drop then-body here'}
              </div>
              {b.branchId && renderInner(b.branchId)}
              {isIfElse && (
                <div
                  className={`ml-0 mt-2 mb-1 border-l-2 pl-1 transition-colors ${
                    hoverBranch2 ? 'border-amber-400/90' : 'border-white/15'
                  }`}
                >
                  <div className="text-[9px] text-amber-500/80 mb-1 font-bold">else</div>
                  <div
                    className="text-[9px] text-zinc-500 min-h-[20px]"
                    onDragOver={zoneOver}
                    onDrop={(e) => onDropOnBlock(e, id, 'branch2')}
                  >
                    {b.branch2Id ? null : hoverBranch2 ? 'snap here' : 'drop else-body here'}
                  </div>
                  {b.branch2Id && renderInner(b.branch2Id)}
                </div>
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
      const isGhost = dragId === id;
      const hoverNext = hoverSlot?.id === id && hoverSlot.mode === 'next';
      const hoverBranch = hoverSlot?.id === id && hoverSlot.mode === 'branch';
      const hoverBranch2 = hoverSlot?.id === id && hoverSlot.mode === 'branch2';
      return (
        <div key={id} className="mb-0.5" style={{ opacity: isGhost ? 0.25 : 1 }}>
          <div
            data-block-id={id}
            draggable
            className="touch-none"
            onPointerDown={(e) => onPointerDownBlock(e, id)}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/snap-block-id', id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={zoneOver}
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
          {hoverNext && <div className="h-1.5 rounded bg-primary/80 animate-pulse mx-2" />}
          {isC && (
            <div
              className={`ml-3 mt-0.5 border-l pl-2 transition-colors ${
                hoverBranch ? 'border-primary' : 'border-white/15'
              }`}
            >
              <div
                className="text-[8px] text-zinc-600"
                onDragOver={zoneOver}
                onDrop={(e) => onDropOnBlock(e, id, 'branch')}
              >
                {b.branchId ? null : hoverBranch ? 'snap here' : 'body'}
              </div>
              {b.branchId && renderInner(b.branchId)}
              {isIfElse && (
                <div
                  className={`mt-1 border-l-2 pl-1 transition-colors ${
                    hoverBranch2 ? 'border-amber-400/90' : 'border-white/15'
                  }`}
                >
                  <div className="text-[8px] text-amber-600/70">else</div>
                  <div
                    onDragOver={zoneOver}
                    onDrop={(e) => onDropOnBlock(e, id, 'branch2')}
                  >
                    {b.branch2Id ? null : (
                      <span className="text-[8px] text-zinc-600">{hoverBranch2 ? 'snap here' : 'else body'}</span>
                    )}
                  </div>
                  {b.branch2Id && renderInner(b.branch2Id)}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  const ghostBlock = dragId && sprite.blocks[dragId] ? sprite.blocks[dragId] : null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        ref={canvasRef}
        className="absolute inset-0 overflow-auto custom-scrollbar"
        onDragOver={onCanvasDragOver}
        onDragLeave={() => updateHover(null)}
        onDrop={onDropCanvas}
        onClick={(e) => {
          if (pendingOpcode) placeAt(e.clientX, e.clientY);
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
              Drag blocks · drop reporters into number/boolean slots · drop near a block to snap
            </div>
          )}
          {/* Drag ghost follows the finger/pointer */}
          {dragPos && ghostBlock && (
            <div
              className="absolute z-30 pointer-events-none"
              style={{ left: dragPos.x, top: dragPos.y }}
            >
              <BlockView block={ghostBlock} sprite={sprite} compact />
            </div>
          )}
        </div>
      </div>

      {/* Trash bin — drop a block (desktop DnD or touch drag) to delete it */}
      <div
        ref={binRef}
        data-trash-bin
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOverBin(true);
          updateHover(null);
        }}
        onDragLeave={() => setOverBin(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const existingId = e.dataTransfer.getData('application/snap-block-id');
          if (existingId) mutate((s) => deleteBlockCascade(s, existingId));
          setOverBin(false);
          updateHover(null);
        }}
        className={`absolute bottom-4 right-4 z-40 flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-2.5 backdrop-blur transition-all duration-150 ${
          overBin
            ? 'border-error bg-error/20 scale-110'
            : 'border-outline-variant/40 bg-surface-container/80 opacity-80 hover:opacity-100'
        }`}
        title="Drag a block here to delete it"
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-6 h-6 ${overBin ? 'text-error' : 'text-zinc-400'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span className={`text-[9px] font-black uppercase tracking-wider ${overBin ? 'text-error' : 'text-zinc-500'}`}>
          Delete
        </span>
      </div>
    </div>
  );
}
