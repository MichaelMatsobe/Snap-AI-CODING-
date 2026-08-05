import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { importSb3 } from '../engine/sb3Import';
import type { Project } from '../engine/types';

interface Props {
  onImported: (project: Project) => void;
}

export function ImportSb3Button({ onImported }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const buf = await file.arrayBuffer();
      const project = await importSb3(buf);
      onImported(project);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10 disabled:opacity-50"
        title="Import Scratch 3 .sb3 project"
      >
        <Upload className="w-3.5 h-3.5" />
        {busy ? 'Importing…' : 'Import SB3'}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".sb3,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
      {err && <span className="text-[10px] text-error">{err}</span>}
    </>
  );
}
