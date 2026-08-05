import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Scan } from 'lucide-react';
import { detectFromWebcam, startWebcam, stopWebcam, topLabel, type VisionDetection } from '../engine/vision';

interface Props {
  onLabels?: (labels: string[], top: string) => void;
}

export function WebcamPanel({ onLabels }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dets, setDets] = useState<VisionDetection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => stopWebcam();
  }, []);

  async function toggle() {
    setError(null);
    if (on) {
      stopWebcam();
      setOn(false);
      setDets([]);
      return;
    }
    try {
      const video = await startWebcam();
      video.className = 'w-full rounded-lg';
      hostRef.current?.replaceChildren(video);
      setOn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Webcam denied');
    }
  }

  async function scan() {
    setBusy(true);
    setError(null);
    try {
      const preds = await detectFromWebcam();
      setDets(preds);
      const labels = preds.map((p) => p.class);
      onLabels?.(labels, topLabel(preds));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={() => void toggle()}
          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-1.5 rounded-lg bg-surface-container-high border border-white/10"
        >
          {on ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
          {on ? 'Stop cam' : 'Start webcam'}
        </button>
        <button
          onClick={() => void scan()}
          disabled={!on || busy}
          className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-bold py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 disabled:opacity-40"
        >
          <Scan className="w-3.5 h-3.5" />
          {busy ? 'Detecting…' : 'COCO-SSD'}
        </button>
      </div>
      <div ref={hostRef} className="bg-black/40 rounded-lg min-h-[80px] overflow-hidden" />
      {error && <div className="text-[10px] text-error">{error}</div>}
      {dets.length > 0 && (
        <div className="text-[10px] text-zinc-400 space-y-0.5">
          {dets.slice(0, 5).map((d, i) => (
            <div key={i}>
              {d.class}{' '}
              <span className="text-zinc-600">{(d.score * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
