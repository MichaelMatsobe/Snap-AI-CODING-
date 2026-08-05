import React from 'react';
import { motion } from 'motion/react';
import type { Project, VmSnapshot } from '../engine/types';

interface Props {
  project: Project;
  snapshot: VmSnapshot | null;
}

/** Map Scratch coords to CSS inside stage box */
function toCss(
  x: number,
  y: number,
  stageW: number,
  stageH: number
): { left: string; top: string } {
  const cx = stageW / 2 + x;
  const cy = stageH / 2 - y;
  return { left: `${cx}px`, top: `${cy}px` };
}

export function Stage({ project, snapshot }: Props) {
  const vars = snapshot?.variables ?? project.variables;
  const spriteStates = snapshot?.sprites;

  return (
    <div
      className="relative bg-[#0c0c0c] rounded-xl border border-outline-variant/20 overflow-hidden shadow-2xl mx-auto"
      style={{
        width: project.stageWidth,
        height: project.stageHeight,
        maxWidth: '100%',
      }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none block-canvas-grid" />

      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
        {Object.entries(vars).map(([name, val]) => (
          <div key={name} className="watcher-box text-[#ff9f43]">
            <span>{name}</span>
            <span className="bg-black/40 px-2 py-0.5 rounded text-white min-w-[28px] text-center">
              {String(val)}
            </span>
          </div>
        ))}
      </div>

      {project.sprites.map((sp) => {
        const live = spriteStates?.find((s) => s.id === sp.id);
        const x = live?.x ?? sp.x;
        const y = live?.y ?? sp.y;
        const dir = live?.direction ?? sp.direction;
        const size = live?.size ?? sp.size;
        const visible = live?.visible ?? sp.visible;
        if (!visible) return null;
        const pos = toCss(x, y, project.stageWidth, project.stageHeight);
        // Scratch direction 90 = right; CSS rotate 0 = up → rotate(dir - 90)
        const rot = dir - 90;
        const px = (size / 100) * 72;

        return (
          <motion.img
            key={sp.id}
            alt={sp.name}
            src={sp.costumeUrl}
            referrerPolicy="no-referrer"
            className="absolute z-10 drop-shadow-lg pointer-events-none"
            style={{
              width: px,
              height: px,
              left: pos.left,
              top: pos.top,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              objectFit: 'contain',
            }}
          />
        );
      })}

      {snapshot?.message && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/70 text-secondary text-[10px] px-2 py-1 rounded">
          {snapshot.message}
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 h-7 bg-black/60 backdrop-blur-md flex items-center justify-between px-3 border-t border-white/5 text-[9px] font-mono text-zinc-500">
        <span>
          {snapshot?.status === 'running' ? '▶ RUNNING' : snapshot?.status === 'paused' ? '❚❚ PAUSED' : '■ STOPPED'}
        </span>
        <span>
          {project.stageWidth}×{project.stageHeight}
        </span>
      </div>
    </div>
  );
}
