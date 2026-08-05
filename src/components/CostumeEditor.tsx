import React, { useEffect, useRef, useState } from 'react';
import { X, Paintbrush, Eraser, Trash2, Check } from 'lucide-react';
import type { Costume } from '../engine/types';
import { v4 as uuid } from 'uuid';

interface Props {
  open: boolean;
  onClose: () => void;
  costume?: Costume | null;
  onSave: (costume: Costume) => void;
}

const SIZE = 128;

export function CostumeEditor({ open, onClose, costume, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [color, setColor] = useState('#7cd2f1');
  const [name, setName] = useState('costume1');
  const drawing = useRef(false);

  useEffect(() => {
    if (!open) return;
    setName(costume?.name || `costume${Date.now() % 1000}`);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (costume?.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
      };
      img.src = costume.url;
    } else {
      // default blob
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [open, costume]);

  const paint = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = tool === 'eraser' ? '#1a1a1a' : color;
    ctx.beginPath();
    ctx.arc(x, y, tool === 'eraser' ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, SIZE, SIZE);
  };

  const save = () => {
    const url = canvasRef.current?.toDataURL('image/png') || '';
    onSave({
      id: costume?.id || uuid(),
      name,
      url,
      bitmap: url,
      width: SIZE,
      height: SIZE,
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-surface-container-low border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-bold">Costume Editor</span>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            className="w-full bg-black/40 border border-outline-variant/30 rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Costume name"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setTool('brush')}
              className={`p-2 rounded-lg ${tool === 'brush' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg ${tool === 'eraser' ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}
            >
              <Eraser className="w-4 h-4" />
            </button>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <button onClick={clear} className="p-2 rounded-lg bg-surface-container-high text-error ml-auto">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className="w-full aspect-square rounded-xl border border-white/10 cursor-crosshair bg-black"
            onMouseDown={(e) => {
              drawing.current = true;
              paint(e);
            }}
            onMouseMove={(e) => drawing.current && paint(e)}
            onMouseUp={() => {
              drawing.current = false;
            }}
            onMouseLeave={() => {
              drawing.current = false;
            }}
          />
          <button
            onClick={save}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            <Check className="w-4 h-4" />
            Save costume
          </button>
        </div>
      </div>
    </div>
  );
}
