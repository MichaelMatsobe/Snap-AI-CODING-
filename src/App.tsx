/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Snap! Technical Atelier — IDE with live block VM
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudCheck,
  Settings,
  Plus,
  Puzzle,
  HelpCircle,
  Play,
  Pause,
  Square,
  Zap,
  Eye,
  Trash2,
  Wifi,
  WifiOff,
  Code,
  Sparkles,
  Save,
  FolderOpen,
} from 'lucide-react';
import { AiAssistant } from './components/AiAssistant';
import { Workspace } from './components/Workspace';
import { Stage } from './components/Stage';
import { PaletteBlock } from './components/BlockView';
import { healthCheck, saveRemoteProject } from './lib/api';
import {
  createDefaultProject,
  getActiveSprite,
  loadProjectLocal,
  saveProjectLocal,
} from './engine/project';
import { blocksForCategory } from './engine/blocks';
import type { CategoryId, Project, SpriteState, VmSnapshot } from './engine/types';
import { StageVM } from './engine/vm';

const CATEGORIES: CategoryId[] = [
  'Motion',
  'Looks',
  'Sound',
  'Events',
  'Control',
  'Variables',
];

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProjectLocal() || createDefaultProject());
  const [category, setCategory] = useState<CategoryId>('Motion');
  const [aiOpen, setAiOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<VmSnapshot | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const vmRef = useRef<StageVM | null>(null);

  // Init VM
  useEffect(() => {
    const vm = new StageVM(project);
    vmRef.current = vm;
    const unsub = vm.subscribe(setSnapshot);
    return () => {
      unsub();
      vm.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync project into VM when scripts change (not every frame)
  useEffect(() => {
    vmRef.current?.loadProject(project);
  }, [project]);

  useEffect(() => {
    vmRef.current?.setTurbo(turbo);
  }, [turbo]);

  useEffect(() => {
    let c = false;
    const ping = async () => {
      try {
        await healthCheck();
        if (!c) setApiOnline(true);
      } catch {
        if (!c) setApiOnline(false);
      }
    };
    void ping();
    const id = setInterval(ping, 30000);
    return () => {
      c = true;
      clearInterval(id);
    };
  }, []);

  // Autosave local
  useEffect(() => {
    const t = setTimeout(() => saveProjectLocal(project), 800);
    return () => clearTimeout(t);
  }, [project]);

  const active = useMemo(() => getActiveSprite(project), [project]);

  const updateSprite = useCallback((sprite: SpriteState) => {
    setProject((p) => ({
      ...p,
      sprites: p.sprites.map((s) => (s.id === sprite.id ? sprite : s)),
    }));
  }, []);

  const saveAll = async () => {
    saveProjectLocal(project);
    try {
      if (apiOnline) await saveRemoteProject(project.id, project.name, project);
    } catch {
      /* local still saved */
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const newProject = () => {
    vmRef.current?.stop();
    const p = createDefaultProject();
    setProject(p);
  };

  const onPaletteDrag = (e: React.DragEvent, opcode: string) => {
    e.dataTransfer.setData('application/snap-opcode', opcode);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const status = snapshot?.status ?? 'idle';

  return (
    <div className="flex flex-col h-screen bg-background text-on-surface select-none">
      <header className="h-14 flex items-center justify-between px-4 bg-surface/90 backdrop-blur border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tighter text-primary">Snap!</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/30 uppercase">
              Atelier
            </span>
          </div>
          <input
            className="bg-transparent text-sm font-semibold text-zinc-300 border-b border-transparent focus:border-primary/40 outline-none px-1 w-48"
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void saveAll()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10 hover:bg-surface-container-high"
          >
            <Save className="w-3.5 h-3.5" />
            {savedFlash ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={newProject}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10 hover:bg-surface-container-high"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            New
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-outline-variant/20 text-[10px] text-zinc-400">
            <CloudCheck className={`w-3 h-3 ${savedFlash ? 'text-secondary' : 'text-zinc-500'}`} />
            Local autosave
          </div>
          <button className="p-2 text-zinc-400 hover:bg-zinc-800/50 rounded-md">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-12 flex flex-col items-center py-6 gap-3 bg-surface-container-low border-r border-white/5">
          <button onClick={newProject} className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center" title="New">
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Puzzle className="w-4 h-4" />
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <button onClick={() => setAiOpen(true)} className="w-9 h-9 flex items-center justify-center text-primary rounded-lg hover:bg-primary/10">
              <Sparkles className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center text-zinc-500 rounded-lg">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </aside>

        <main className="flex-1 flex overflow-hidden">
          {/* Palette */}
          <section className="w-72 bg-surface-container-low flex flex-col border-r border-background">
            <div className="p-2 grid grid-cols-2 gap-1 border-b border-background/50">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[9px] font-bold uppercase tracking-wider py-1.5 rounded-sm ${
                    category === c
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-high text-zinc-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {blocksForCategory(category).map((def) => (
                <PaletteBlock key={def.opcode} opcode={def.opcode} onDragStart={onPaletteDrag} />
              ))}
            </div>
          </section>

          {/* Scripts */}
          <section className="flex-1 bg-surface block-canvas-grid relative overflow-hidden">
            <Workspace sprite={active} onChange={updateSprite} />
          </section>

          {/* Stage + sprites */}
          <section className="w-[400px] bg-surface-container-low flex flex-col border-l border-background">
            <div className="p-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stage</span>
                <div className="flex gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10">
                  <button
                    title="Green flag"
                    onClick={() => vmRef.current?.greenFlag()}
                    className="w-8 h-8 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    title="Pause / Resume"
                    onClick={() =>
                      status === 'paused' ? vmRef.current?.resume() : vmRef.current?.pause()
                    }
                    className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:bg-white/5 rounded"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                  <button
                    title="Stop"
                    onClick={() => vmRef.current?.stop()}
                    className="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                  <div className="w-px bg-outline-variant/10 mx-0.5" />
                  <button
                    title="Turbo mode"
                    onClick={() => setTurbo((t) => !t)}
                    className={`w-8 h-8 flex items-center justify-center rounded ${
                      turbo ? 'text-tertiary bg-tertiary/10' : 'text-zinc-500'
                    }`}
                  >
                    <Zap className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
              <Stage project={project} snapshot={snapshot} />
            </div>

            <div className="flex-1 border-t border-background overflow-y-auto custom-scrollbar p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Sprites</div>
              <div className="grid grid-cols-3 gap-2">
                {project.sprites.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => setProject((p) => ({ ...p, activeSpriteId: sp.id }))}
                    className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center border transition-all ${
                      project.activeSpriteId === sp.id
                        ? 'border-primary/40 bg-surface-container ring-2 ring-primary/20'
                        : 'border-transparent bg-surface-container-highest/20 hover:bg-surface-container-high'
                    }`}
                  >
                    <img src={sp.costumeUrl} alt="" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                    <span className={`text-[9px] font-bold truncate w-full text-center mt-1 ${
                      project.activeSpriteId === sp.id ? 'text-primary' : 'text-zinc-500'
                    }`}>
                      {sp.name}
                    </span>
                    {project.activeSpriteId === sp.id && (
                      <Eye className="w-3 h-3 text-primary absolute top-1 right-1" />
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-zinc-600 space-y-1">
                <div>Scripts: {Object.keys(active.blocks).length} blocks</div>
                <div>Double-click a block to delete its stack</div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <footer className="h-7 bg-surface-container-lowest flex items-center justify-between px-3 border-t border-background text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'running'
                  ? 'bg-secondary animate-pulse'
                  : status === 'paused'
                    ? 'bg-tertiary'
                    : 'bg-zinc-600'
              }`}
            />
            {status}
          </span>
          <span className="flex items-center gap-1">
            {apiOnline ? <Wifi className="w-3 h-3 text-secondary" /> : <WifiOff className="w-3 h-3 text-error" />}
            {apiOnline ? 'API' : 'offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Code className="w-3 h-3" />
          v1.1.0-runtime
        </div>
      </footer>

      <AiAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
