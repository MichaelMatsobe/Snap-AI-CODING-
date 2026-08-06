/**
 * Snap! Technical Atelier — full runtime IDE v1.3
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
  Wifi,
  WifiOff,
  Code,
  Sparkles,
  Save,
  FolderOpen,
  Palette,
} from 'lucide-react';
import { AiAssistant } from './components/AiAssistant';
import { Workspace } from './components/Workspace';
import { Stage } from './components/Stage';
import { PaletteBlock } from './components/BlockView';
import { CostumeEditor } from './components/CostumeEditor';
import { ImportSb3Button } from './components/ImportSb3Button';
import { WebcamPanel } from './components/WebcamPanel';
import { SettingsModal } from './components/SettingsModal';
import { healthCheck, saveRemoteProject, aiChat } from './lib/api';
import {
  createDefaultProject,
  getActiveSprite,
  loadProjectLocal,
  saveProjectLocal,
} from './engine/project';
import { ALL_CATEGORIES, blocksForCategory } from './engine/blocks';
import type { CategoryId, Costume, Project, SpriteState, VmSnapshot } from './engine/types';
import { StageVM } from './engine/vm';
import { detectFromWebcam, topLabel } from './engine/vision';

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProjectLocal() || createDefaultProject());
  const [category, setCategory] = useState<CategoryId>('Motion');
  const [aiOpen, setAiOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<VmSnapshot | null>(null);
  const [turbo, setTurbo] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [costumeOpen, setCostumeOpen] = useState(false);
  const [editCostume, setEditCostume] = useState<Costume | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visionLabels, setVisionLabels] = useState<string[]>([]);
  const [askText, setAskText] = useState('');
  const vmRef = useRef<StageVM | null>(null);

  useEffect(() => {
    const vm = new StageVM(project);
    vm.setAiCaller(async (prompt) => {
      const r = await aiChat([{ role: 'user', content: prompt }]);
      return r.content;
    });
    // Vision scan hook used by ml_webcam_label opcode path
    (vm as unknown as { runVisionScan?: () => Promise<string[]> }).runVisionScan = async () => {
      const dets = await detectFromWebcam();
      const labels = dets.map((d) => d.class);
      const p = vm.getProject();
      p.variables['vision'] = topLabel(dets);
      p.lists['objects'] = labels;
      setVisionLabels(labels);
      return labels;
    };
    vmRef.current = vm;
    const unsub = vm.subscribe(setSnapshot);
    return () => {
      unsub();
      vm.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload the VM only when the project *structure* changes (blocks, sprites,
  // scripts) — variable/list watcher updates must not stop a running script.
  const projectSig = useMemo(
    () =>
      JSON.stringify({
        id: project.id,
        name: project.name,
        stageWidth: project.stageWidth,
        stageHeight: project.stageHeight,
        activeSpriteId: project.activeSpriteId,
        sprites: project.sprites.map((s) => ({
          id: s.id,
          name: s.name,
          costumeUrl: s.costumeUrl,
          costumeIndex: s.costumeIndex,
          scriptRoots: s.scriptRoots,
          blocks: s.blocks,
        })),
      }),
    [project]
  );

  useEffect(() => {
    vmRef.current?.loadProject(project);
    vmRef.current?.setAiCaller(async (prompt) => {
      const r = await aiChat([{ role: 'user', content: prompt }]);
      return r.content;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSig]);

  useEffect(() => {
    vmRef.current?.setVisionLabels(visionLabels);
  }, [visionLabels]);

  useEffect(() => {
    vmRef.current?.setTurbo(turbo);
  }, [turbo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Don't trigger "when key pressed" hats while typing in fields.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      ) {
        return;
      }
      vmRef.current?.keyPressed(e.key === ' ' ? 'space' : e.key);
    };
    const onUp = (e: KeyboardEvent) => vmRef.current?.keyReleased(e.key === ' ' ? 'space' : e.key);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

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
      /* local ok */
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const newProject = () => {
    vmRef.current?.stop();
    setProject(createDefaultProject());
  };

  const onPaletteDrag = (e: React.DragEvent, opcode: string) => {
    e.dataTransfer.setData('application/snap-opcode', opcode);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const saveCostume = (c: Costume) => {
    setProject((p) => {
      const sprites = p.sprites.map((s) => {
        if (s.id !== p.activeSpriteId) return s;
        const costumes = [...(s.costumes || [])];
        const idx = costumes.findIndex((x) => x.id === c.id);
        if (idx >= 0) costumes[idx] = c;
        else costumes.push(c);
        return {
          ...s,
          costumes,
          costumeIndex: idx >= 0 ? idx : costumes.length - 1,
          costumeUrl: c.url,
        };
      });
      return { ...p, sprites };
    });
  };

  const status = snapshot?.status ?? 'idle';

  const submitAsk = () => {
    vmRef.current?.submitAnswer(askText);
    setAskText('');
  };

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
            className="bg-transparent text-sm font-semibold text-zinc-300 border-b border-transparent focus:border-primary/40 outline-none px-1 w-40"
            value={project.name}
            onChange={(e) => setProject((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <ImportSb3Button
            onImported={(p) => {
              vmRef.current?.stop();
              setProject(p);
            }}
          />
          <button onClick={() => void saveAll()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10">
            <Save className="w-3.5 h-3.5" />
            {savedFlash ? 'Saved' : 'Save'}
          </button>
          <button onClick={newProject} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10">
            <FolderOpen className="w-3.5 h-3.5" />
            New
          </button>
          <button
            onClick={() => {
              setEditCostume(null);
              setCostumeOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container border border-white/10"
          >
            <Palette className="w-3.5 h-3.5" />
            Costume
          </button>
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </button>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-outline-variant/20 text-[10px] text-zinc-400">
            <CloudCheck className={`w-3 h-3 ${savedFlash ? 'text-secondary' : 'text-zinc-500'}`} />
            Autosave
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:bg-zinc-800/50 rounded-md"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-12 flex flex-col items-center py-6 gap-3 bg-surface-container-low border-r border-white/5">
          <button onClick={newProject} className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-primary text-on-primary flex items-center justify-center">
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
          <section className="w-72 bg-surface-container-low flex flex-col border-r border-background">
            <div className="p-2 grid grid-cols-3 gap-1 border-b border-background/50 max-h-36 overflow-y-auto custom-scrollbar">
              {ALL_CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[8px] font-bold uppercase tracking-wider py-1.5 rounded-sm ${
                    category === c ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-zinc-400 hover:text-white'
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

          <section className="flex-1 bg-surface block-canvas-grid relative overflow-hidden">
            <Workspace sprite={active} onChange={updateSprite} />
          </section>

          <section className="w-[400px] bg-surface-container-low flex flex-col border-l border-background">
            <div className="p-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stage</span>
                <div className="flex gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10">
                  <button title="Green flag" onClick={() => vmRef.current?.greenFlag()} className="w-8 h-8 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded">
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    title="Pause"
                    onClick={() => (status === 'paused' ? vmRef.current?.resume() : vmRef.current?.pause())}
                    className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:bg-white/5 rounded"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                  <button title="Stop" onClick={() => vmRef.current?.stop()} className="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded">
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                  <button title="Turbo" onClick={() => setTurbo((t) => !t)} className={`w-8 h-8 flex items-center justify-center rounded ${turbo ? 'text-tertiary bg-tertiary/10' : 'text-zinc-500'}`}>
                    <Zap className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
              <Stage
                project={project}
                snapshot={snapshot}
                onSpriteClick={(id) => vmRef.current?.spriteClicked(id)}
              />
            </div>

            <div className="flex-1 border-t border-background overflow-y-auto custom-scrollbar p-3 space-y-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Webcam · COCO-SSD</div>
                <WebcamPanel
                  onLabels={(labels, top) => {
                    setVisionLabels(labels);
                    setProject((p) => ({
                      ...p,
                      variables: { ...p.variables, vision: top },
                      lists: { ...p.lists, objects: labels },
                    }));
                  }}
                />
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Sprites</div>
              <div className="grid grid-cols-3 gap-2">
                {project.sprites
                  .filter((s) => !s.isClone)
                  .map((sp) => (
                    <button
                      key={sp.id}
                      onClick={() => setProject((p) => ({ ...p, activeSpriteId: sp.id }))}
                      className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center border ${
                        project.activeSpriteId === sp.id
                          ? 'border-primary/40 bg-surface-container ring-2 ring-primary/20'
                          : 'border-transparent bg-surface-container-highest/20'
                      }`}
                    >
                      <img src={sp.costumeUrl} alt="" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                      <span className="text-[9px] font-bold truncate w-full text-center mt-1 text-zinc-400">{sp.name}</span>
                    </button>
                  ))}
              </div>

              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Costumes</div>
              <div className="flex flex-wrap gap-2">
                {(active.costumes || []).map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setProject((p) => ({
                        ...p,
                        sprites: p.sprites.map((s) =>
                          s.id === active.id ? { ...s, costumeIndex: i, costumeUrl: c.url } : s
                        ),
                      }));
                    }}
                    onDoubleClick={() => {
                      setEditCostume(c);
                      setCostumeOpen(true);
                    }}
                    className={`w-14 h-14 rounded-lg border p-1 ${
                      active.costumeIndex === i ? 'border-primary' : 'border-white/10'
                    }`}
                  >
                    <img src={c.url} alt={c.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </button>
                ))}
                <button
                  onClick={() => {
                    setEditCostume(null);
                    setCostumeOpen(true);
                  }}
                  className="w-14 h-14 rounded-lg border border-dashed border-white/20 text-zinc-500 text-[9px]"
                >
                  + New
                </button>
              </div>
              <p className="text-[10px] text-zinc-600">
                Drop reporters into slots · Import .sb3 · Webcam TF.js · AI builds scripts
              </p>
            </div>
          </section>
        </main>
      </div>

      <footer className="h-7 bg-surface-container-lowest flex items-center justify-between px-3 border-t border-background text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-secondary animate-pulse' : 'bg-zinc-600'}`} />
            {status}
          </span>
          <span className="flex items-center gap-1">
            {apiOnline ? <Wifi className="w-3 h-3 text-secondary" /> : <WifiOff className="w-3 h-3 text-error" />}
            {apiOnline ? 'API' : 'offline'}
          </span>
          {visionLabels[0] && <span className="text-primary normal-case">vision: {visionLabels[0]}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Code className="w-3 h-3" />
          v1.4.0
        </div>
      </footer>

      <AiAssistant open={aiOpen} onClose={() => setAiOpen(false)} activeSprite={active} onInjectSprite={updateSprite} />
      <CostumeEditor open={costumeOpen} onClose={() => setCostumeOpen(false)} costume={editCostume} onSave={saveCostume} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {snapshot?.ask && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-surface-container-low border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-4 pt-4">
              <div className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Ask &amp; wait</div>
              <div className="text-sm font-semibold text-on-surface">{snapshot.ask}</div>
            </div>
            <div className="p-4 space-y-3">
              <input
                autoFocus
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitAsk();
                }}
                placeholder="Type your answer…"
                className="w-full bg-black/40 border border-outline-variant/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={submitAsk}
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold"
              >
                Submit answer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
