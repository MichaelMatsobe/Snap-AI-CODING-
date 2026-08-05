import React from 'react';
import type { Project, VmSnapshot } from '../engine/types';

interface Props {
  project: Project;
  snapshot: VmSnapshot | null;
}

function toCss(x: number, y: number, stageW: number, stageH: number) {
  return { left: stageW / 2 + x, top: stageH / 2 - y };
}

export function Stage({ project, snapshot }: Props) {
  const vars = snapshot?.variables ?? project.variables;
  const spriteStates = snapshot?.sprites;
  const trails = snapshot?.penTrails ?? project.penTrails ?? [];

  return (
    <div
      className="relative bg-[#0c0c0c] rounded-xl border border-outline-variant/20 overflow-hidden shadow-2xl mx-auto"
      style={{ width: project.stageWidth, height: project.stageHeight, maxWidth: '100%' }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none block-canvas-grid" />

      {/* Pen trails */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
        {trails.map((t, i) => {
          const a = toCss(t.x1, t.y1, project.stageWidth, project.stageHeight);
          const b = toCss(t.x2, t.y2, project.stageWidth, project.stageHeight);
          return (
            <line
              key={i}
              x1={a.left}
              y1={a.top}
              x2={b.left}
              y2={b.top}
              stroke={t.color}
              strokeWidth={t.size}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20 max-h-[40%] overflow-auto">
        {Object.entries(vars)
          .slice(0, 8)
          .map(([name, val]) => (
            <div key={name} className="watcher-box text-[#ff9f43]">
              <span>{name}</span>
              <span className="bg-black/40 px-2 py-0.5 rounded text-white min-w-[28px] text-center truncate max-w-[120px]">
                {String(val).slice(0, 24)}
              </span>
            </div>
          ))}
      </div>

      {(spriteStates
        ? spriteStates
        : project.sprites.map((s) => ({
            id: s.id,
            name: s.name,
            x: s.x,
            y: s.y,
            direction: s.direction,
            size: s.size,
            visible: s.visible,
            costumeUrl: s.costumeUrl,
            ghost: s.ghost || 0,
            isClone: s.isClone,
          }))
      ).map((sp) => {
        if (!sp.visible) return null;
        const pos = toCss(sp.x, sp.y, project.stageWidth, project.stageHeight);
        const rot = sp.direction - 90;
        const px = (sp.size / 100) * 72;
        return (
          <img
            key={sp.id}
            alt={sp.name}
            src={sp.costumeUrl}
            referrerPolicy="no-referrer"
            className="absolute z-10 pointer-events-none"
            style={{
              width: px,
              height: px,
              left: pos.left,
              top: pos.top,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              objectFit: 'contain',
              opacity: 1 - (sp.ghost || 0) / 100,
              filter: sp.isClone ? 'hue-rotate(40deg)' : undefined,
            }}
          />
        );
      })}

      {snapshot?.message && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/70 text-secondary text-[10px] px-2 py-1 rounded z-30 max-w-[90%] truncate">
          {snapshot.message}
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 h-7 bg-black/60 backdrop-blur-md flex items-center justify-between px-3 border-t border-white/5 text-[9px] font-mono text-zinc-500 z-20">
        <span>
          {snapshot?.status === 'running'
            ? '▶ RUNNING'
            : snapshot?.status === 'paused'
              ? '❚❚ PAUSED'
              : '■ STOPPED'}
          {spriteStates && ` · ${spriteStates.length} sprites`}
        </span>
        <span>
          {project.stageWidth}×{project.stageHeight}
        </span>
      </div>
    </div>
  );
}
