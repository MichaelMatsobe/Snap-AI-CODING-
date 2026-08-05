/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Snap! Technical Atelier — visual programming IDE with free multi-provider AI
 */

import React, { useState, useEffect } from 'react';
import {
  CloudCheck,
  Bell,
  Settings,
  Plus,
  Puzzle,
  LayoutGrid,
  GraduationCap,
  FolderOpen,
  HelpCircle,
  MessageSquare,
  Play,
  Pause,
  Square,
  Zap,
  Maximize,
  Eye,
  Copy,
  Trash2,
  Cpu,
  Wifi,
  WifiOff,
  Code,
  Layers,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Focus,
  RefreshCw,
  GripVertical,
  PlusCircle,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AiAssistant } from './components/AiAssistant';
import { healthCheck } from './lib/api';

const BLOCK_CATEGORIES = [
  { id: 'Motion', color: 'bg-primary text-on-primary' },
  { id: 'Looks', color: 'bg-tertiary text-on-tertiary' },
  { id: 'Sound', color: 'bg-[#cd84f1] text-white' },
  { id: 'Pen', color: 'bg-[#32ff7e] text-zinc-900' },
  { id: 'Events', color: 'bg-[#a29bfe] text-white' },
  { id: 'Control', color: 'bg-secondary text-on-secondary' },
  { id: 'Sensing', color: 'bg-[#fd79a8] text-white' },
  { id: 'Operators', color: 'bg-[#fab1a0] text-white' },
  { id: 'Variables', color: 'bg-[#ff9f43] text-white' },
  { id: 'Lists', color: 'bg-[#ff6b6b] text-white' },
  { id: 'My Blocks', color: 'bg-[#00d2ff] text-white', span: true },
] as const;

const MOTION_BLOCKS = [
  { label: 'move', value: '10', unit: 'steps' },
  { label: 'turn', value: '15', unit: 'degrees', icon: true },
  { label: 'go to', value: 'random position' },
  { label: 'point in direction', value: '90' },
  { label: 'set x to', value: '0' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Sprites');
  const [selectedSprite, setSelectedSprite] = useState('Rocket_01');
  const [blockCategory, setBlockCategory] = useState('Motion');
  const [aiOpen, setAiOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await healthCheck();
        if (!cancelled) setApiOnline(true);
      } catch {
        if (!cancelled) setApiOnline(false);
      }
    };
    void ping();
    const id = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-on-surface select-none">
      {/* Top Navigation Bar */}
      <header className="h-16 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-xl border-b border-white/5 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tighter text-primary">Snap!</span>
            <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded tracking-widest border border-primary/30 uppercase">
              IDE
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a className="text-zinc-200 border-b-2 border-primary pb-0.5 hover:text-primary transition-colors" href="#">
              File
            </a>
            <a className="text-zinc-400 hover:text-zinc-200 transition-colors" href="#">
              Edit
            </a>
            <a className="text-zinc-400 hover:text-zinc-200 transition-colors" href="#">
              Share
            </a>
            <a className="text-zinc-400 hover:text-zinc-200 transition-colors" href="#">
              Help
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAiOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all active:scale-95"
            title="Open Snap! AI assistant"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assistant
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-lowest rounded-full border border-outline-variant/20">
            <CloudCheck className="w-3 h-3 text-secondary" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Autosaved</span>
          </div>
          <div className="h-8 w-px bg-outline-variant/20 mx-1" />
          <button className="p-2 text-zinc-400 hover:bg-zinc-800/50 rounded-md transition-all active:scale-95">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-zinc-400 hover:bg-zinc-800/50 rounded-md transition-all active:scale-95">
            <Settings className="w-5 h-5" />
          </button>
          <div className="h-8 w-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20 cursor-pointer">
            <img
              alt="User profile avatar"
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWkqT-gn77Z148e5-_pP4IDDoqbX3ttfOCTYBF7vO8w0St7XvbphipgQtc1GYXz86HDXHdFTYAzwEM6YP4NtqABaBiNBMZ1aYRUzyuktb9FPnWk_ZYXDplRkMB9qBrjFSdPi-YICrYjAIl6A8kcZe__kiL6Q_x2J1QXnF_HQj_SHYcpes2GR1x_gcgNplITXG1i-NW7exFES3wKUnZDe0S9PI06AQJnTt1-FarhiSDM2vwU_O8fKfqhGYtbt5R60yNJ_h_Pm_ywaL0"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail Sidebar */}
        <aside className="w-16 flex flex-col items-center py-8 gap-4 bg-surface-container-low border-r border-white/5 z-40">
          <button
            className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all"
            title="New Project"
          >
            <Plus className="w-6 h-6" />
          </button>
          <nav className="flex flex-col gap-4 items-center">
            <a
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-primary text-on-primary shadow-lg shadow-primary/20"
              href="#"
              title="Editor"
            >
              <Puzzle className="w-5 h-5" />
            </a>
            <a
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-surface-container hover:text-zinc-200 transition-all"
              href="#"
              title="Projects"
            >
              <LayoutGrid className="w-5 h-5" />
            </a>
            <a
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-surface-container hover:text-zinc-200 transition-all"
              href="#"
              title="Tutorials"
            >
              <GraduationCap className="w-5 h-5" />
            </a>
            <a
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-surface-container hover:text-zinc-200 transition-all"
              href="#"
              title="Assets"
            >
              <FolderOpen className="w-5 h-5" />
            </a>
          </nav>
          <div className="mt-auto flex flex-col items-center gap-4 border-t border-outline-variant/10 pt-4">
            <button
              onClick={() => setAiOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-all"
              title="Snap! AI"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200" title="Help">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setAiOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200"
              title="Feedback / AI"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* Main Editor Area */}
        <main className="flex-1 flex overflow-hidden">
          {/* Block Palette */}
          <section className="w-80 bg-surface-container-low flex flex-col border-r border-background">
            <div className="p-3 grid grid-cols-2 gap-1.5 border-b border-background/50">
              {BLOCK_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setBlockCategory(cat.id)}
                  className={`text-[9px] font-bold uppercase tracking-widest py-2 px-1 rounded-sm transition-all ${
                    'span' in cat && cat.span ? 'col-span-2' : ''
                  } ${
                    blockCategory === cat.id
                      ? `${cat.color} shadow-sm opacity-100`
                      : `${cat.color} opacity-60 hover:opacity-100`
                  }`}
                >
                  {cat.id}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-black/10">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">
                {blockCategory} Commands
              </h3>

              {blockCategory === 'Motion' &&
                MOTION_BLOCKS.map((b, i) => (
                  <div
                    key={i}
                    className="bg-primary text-on-primary p-2.5 block-shape text-xs font-bold flex items-center justify-between group cursor-grab active:cursor-grabbing"
                    draggable
                  >
                    <span className="flex items-center">
                      {b.label}
                      {b.icon && <RefreshCw className="w-3 h-3 mx-1" />}
                      <span className="bg-black/20 px-2 py-0.5 rounded mx-1">{b.value}</span>
                      {b.unit}
                    </span>
                    <GripVertical className="w-4 h-4 opacity-0 group-hover:opacity-50" />
                  </div>
                ))}

              {blockCategory !== 'Motion' && (
                <div className="text-xs text-zinc-500 py-8 text-center">
                  <p className="mb-2">{blockCategory} blocks coming soon.</p>
                  <button
                    onClick={() => setAiOpen(true)}
                    className="text-primary hover:underline text-[11px] font-semibold"
                  >
                    Ask Snap! AI how to use {blockCategory}
                  </button>
                </div>
              )}

              {blockCategory === 'Motion' && (
                <>
                  <div className="h-px bg-outline-variant/10 my-6" />
                  <div className="flex flex-wrap gap-2">
                    <div className="bg-primary/20 text-primary border border-primary/30 p-2 px-3 rounded-full text-[10px] font-bold">
                      x position
                    </div>
                    <div className="bg-primary/20 text-primary border border-primary/30 p-2 px-3 rounded-full text-[10px] font-bold">
                      y position
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Central Workspace */}
          <section className="flex-1 bg-surface block-canvas-grid relative overflow-hidden">
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <div className="flex bg-surface-container-high/60 backdrop-blur border border-outline-variant/10 rounded-lg p-0.5">
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <Layers className="w-4 h-4" />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors border-l border-white/5">
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex bg-surface-container-high/60 backdrop-blur border border-outline-variant/10 rounded-lg p-0.5">
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button className="p-2 text-on-surface-variant hover:text-white transition-colors border-l border-white/5">
                  <Focus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="absolute top-24 left-24">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
                <div className="bg-[#a29bfe] text-white p-3 hat-block w-52 text-xs font-bold shadow-xl border-b border-black/10">
                  <div className="flex items-center gap-2">
                    <Play className="w-3 h-3 fill-current" />
                    when green flag clicked
                  </div>
                </div>
                <div className="bg-[#ff9f43] text-white p-2.5 block-shape w-52 text-xs font-bold shadow-lg">
                  set <span className="bg-black/20 px-2 py-0.5 rounded mx-1">score</span> to 0
                </div>
                <div className="bg-secondary text-on-secondary p-4 rounded-md w-64 text-xs font-bold shadow-2xl relative">
                  <div className="flex items-center gap-2">forever</div>
                  <div className="mt-2 ml-4 space-y-0">
                    <div className="bg-primary text-on-primary p-2.5 block-shape text-[10px]">
                      move <span className="bg-black/20 px-1.5 py-0.5 rounded">3</span> steps
                    </div>
                    <div className="bg-secondary text-on-secondary p-3 rounded-md mt-1 border border-white/10">
                      <div className="flex items-center gap-1">
                        if{' '}
                        <span className="bg-[#fd79a8] px-2 py-0.5 rounded-full text-[9px] border border-white/20">
                          touching [Edge] ?
                        </span>{' '}
                        then
                      </div>
                      <div className="mt-1 ml-3 bg-primary text-on-primary p-2 block-shape text-[9px]">
                        turn clockwise 180 deg
                      </div>
                    </div>
                    <div className="bg-[#cd84f1] text-white p-2.5 block-shape mt-1 text-[10px]">play sound [pop]</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Right Inspector / Stage Area */}
          <section className="w-[420px] bg-surface-container-low flex flex-col border-l border-background">
            <div className="p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Main Stage</span>
                  <span className="text-[9px] font-mono bg-black/30 px-2 py-0.5 rounded text-secondary border border-white/5">
                    480 x 360
                  </span>
                </div>
                <div className="flex gap-1 bg-surface-container-lowest p-1 rounded-lg border border-outline-variant/10">
                  <button className="w-8 h-8 flex items-center justify-center text-secondary hover:bg-secondary/10 rounded transition-colors" title="Run">
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:bg-white/5 rounded transition-colors" title="Pause">
                    <Pause className="w-4 h-4" />
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded transition-colors" title="Stop">
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                  <div className="w-px bg-outline-variant/10 mx-1" />
                  <button className="w-8 h-8 flex items-center justify-center text-tertiary hover:text-tertiary-container transition-colors" title="Turbo">
                    <Zap className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>

              <div className="aspect-video bg-[#0c0c0c] rounded-xl border border-outline-variant/20 relative overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 opacity-10 pointer-events-none block-canvas-grid" />
                <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
                  <div className="watcher-box text-[#ff9f43]">
                    <span>score</span>
                    <span className="bg-black/40 px-2 py-0.5 rounded text-white min-w-[30px] text-center">0</span>
                  </div>
                  <div className="watcher-box text-[#ff9f43]">
                    <span>lives</span>
                    <span className="bg-black/40 px-2 py-0.5 rounded text-white min-w-[30px] text-center">3</span>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.img
                    animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    alt="Current sprite on stage"
                    className="w-28 h-28 relative z-10 drop-shadow-[0_0_20px_rgba(124,210,241,0.3)]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqK_ml0ZsYv6TbySRZhI-by2OfLZhWNtz6sRnwUnDmjRinL5cDunJR-HEyO4bIMIS-Mvj1Ux44i_TOvTlN6oQVH6g5jkHmBu-pQlqbI4hruhahna6Gaulazi49JpwEhorFPerAzXP2PS6w5XviucVEpAB8TC_PsGreQK4WS-PZkGspH9Or-RG7x_ZblbHRCmQKbY13tu23CDLeo8lSHxcgHC3TUjVim0g_R7HAdHqPDFlRzDptCNFOSk1EmusSjZEyhNmlS2cll0zH"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="absolute bottom-0 inset-x-0 h-8 bg-black/60 backdrop-blur-md flex items-center justify-between px-3 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-zinc-500">
                      X: <span className="text-zinc-300">124</span>
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      Y: <span className="text-zinc-300">-42</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-tighter bg-tertiary/10 text-tertiary px-1.5 rounded border border-tertiary/20">
                      Turbo
                    </span>
                    <Maximize className="w-3.5 h-3.5 text-zinc-500 hover:text-white cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 border-t border-background">
              <div className="flex bg-surface-container-low border-b border-background px-2 overflow-x-auto custom-scrollbar">
                {['Sprites', 'Costumes', 'Backdrops', 'Sounds'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? 'border-primary text-primary'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-black/5">
                <AnimatePresence mode="wait">
                  {activeTab === 'Sprites' && (
                    <motion.div
                      key="sprites"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="grid grid-cols-3 gap-3"
                    >
                      <div
                        onClick={() => setSelectedSprite('Rocket_01')}
                        className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center relative shadow-lg group cursor-pointer transition-all ${
                          selectedSprite === 'Rocket_01'
                            ? 'bg-surface-container border border-primary/40 ring-2 ring-primary/20'
                            : 'bg-surface-container-highest/20 border border-transparent hover:bg-surface-container-high'
                        }`}
                      >
                        <div className="w-12 h-12 flex items-center justify-center mb-1">
                          <img
                            alt="Rocket thumbnail"
                            className="max-w-full max-h-full object-contain"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBzDjwBPR4P2YaXS2X3W6eBTlfHYiIZOs29KI4nbR9oNIhxoqHBZaUK0pDhvhgH37ZvuOwYaJe1LKzTaGjCATUUDJ4NKHPbw0DXkmMT5n8nbJBc1_NMWjHVpHQ_9Xo2TDw6iyazMr7nb0gndstfYIwOItHzZ3bmUlk1zoBs10w9Bk6CT1EQGUUeGfeTqTOTtVAj6Seep6qfcwZcrrt3C-Ir1bR9Ep3WO8kIQ34BWvG1bxtR4vYf9iphGlUms81Rc27np84rF7bwQ5HP"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold truncate w-full text-center ${
                            selectedSprite === 'Rocket_01' ? 'text-primary' : 'text-zinc-500'
                          }`}
                        >
                          Rocket_01
                        </span>
                        <div className="absolute top-1 right-1">
                          <Eye
                            className={`w-3 h-3 ${
                              selectedSprite === 'Rocket_01' ? 'text-primary' : 'text-zinc-600'
                            }`}
                          />
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedSprite('Star_01')}
                        className={`aspect-square rounded-xl p-2 flex flex-col items-center justify-center relative hover:bg-surface-container-high transition-all border border-transparent group cursor-pointer ${
                          selectedSprite === 'Star_01'
                            ? 'bg-surface-container border border-primary/40 ring-2 ring-primary/20'
                            : 'bg-surface-container-highest/20'
                        }`}
                      >
                        <div className="w-12 h-12 flex items-center justify-center mb-1 opacity-50 group-hover:opacity-100 transition-opacity">
                          <img
                            alt="Star thumbnail"
                            className="max-w-full max-h-full object-contain"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAmgiB2wMk6zMFHxoRjYwGS8YvLV2TuGM9dQEmGHGPnCLAg7Oq5G1gjpTD6fijlGGseUE8Xh7Z7MlvLTQ58sE_kozQTNcpkMVVBLJI-DqOo3c8IyzrcGaWhHDOFcHIFiHw8fqNt1-ZMmqqSPmZQWaPOjTZqzpsBuvlhxC_lXaRMSqZw1W4td5cM0AEdmMF8ZGgRB2lWI2OM1Wc-sq0v8_uQaivn0VH6m8qxQ7lTzlb_o_xW8VEoRemIjvN1X7qVxaGFVlK_zM3YfH0d"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold truncate w-full text-center ${
                            selectedSprite === 'Star_01' ? 'text-primary' : 'text-zinc-500'
                          }`}
                        >
                          Star_01
                        </span>
                      </div>

                      <button className="aspect-square rounded-xl border-2 border-dashed border-outline-variant/20 flex flex-col items-center justify-center hover:border-primary/50 hover:bg-primary/5 transition-all group">
                        <PlusCircle className="w-6 h-6 text-zinc-500 group-hover:text-primary transition-colors" />
                        <span className="text-[9px] font-bold text-zinc-500 mt-1 uppercase">Add Sprite</span>
                      </button>
                    </motion.div>
                  )}

                  {activeTab !== 'Sprites' && (
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center text-zinc-500 text-sm py-12"
                    >
                      {activeTab} library — connect assets or ask Snap! AI for help.
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-4 bg-surface-container-lowest border-t border-background space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                      Sprite Name
                    </label>
                    <input
                      className="bg-black/30 border border-outline-variant/20 rounded px-2 py-1 text-xs font-bold text-primary w-32 focus:outline-none focus:border-primary/50"
                      type="text"
                      value={selectedSprite}
                      onChange={(e) => setSelectedSprite(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="p-1.5 bg-black/30 border border-outline-variant/20 rounded text-zinc-400 hover:text-white transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 bg-black/30 border border-outline-variant/20 rounded text-error hover:bg-error/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ['X', '124'],
                    ['Y', '-42'],
                    ['Size', '100%'],
                    ['Dir', '90°'],
                  ].map(([label, val]) => (
                    <div key={label} className="col-span-1 space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-zinc-500">{label}</label>
                      <div className="bg-black/30 border border-outline-variant/20 rounded px-2 py-1.5 text-[10px] font-mono text-center">
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-surface-container-lowest flex items-center justify-between px-4 border-t border-background z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                apiOnline === true
                  ? 'bg-secondary shadow-[0_0_8px_rgba(136,219,96,0.6)]'
                  : apiOnline === false
                    ? 'bg-error'
                    : 'bg-zinc-500'
              }`}
            />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
              {apiOnline === true
                ? 'API Online'
                : apiOnline === false
                  ? 'API Offline — run npm run server'
                  : 'Checking…'}
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
            <Cpu className="w-3 h-3" />
            Engine Ready
          </div>
        </div>
        <div className="flex items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
          <div className="flex items-center gap-2">
            {apiOnline ? (
              <Wifi className="w-3 h-3 text-secondary" />
            ) : (
              <WifiOff className="w-3 h-3 text-error" />
            )}
            {apiOnline ? 'AI Ready' : 'AI Offline'}
          </div>
          <div className="flex items-center gap-2">
            <Code className="w-3 h-3" />
            v1.0.0-Atelier
          </div>
        </div>
      </footer>

      <AiAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
