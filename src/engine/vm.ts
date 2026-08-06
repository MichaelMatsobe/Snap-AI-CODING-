/**
 * Stage VM — Scratch-like interpreter with clones, lists, pen, AI/ML hooks.
 * Nested reporters via eval.ts; webcam via TensorFlow.js COCO-SSD.
 */

import { v4 as uuid } from 'uuid';
import type { Project, SpriteState, VmSnapshot, VmStatus } from './types';
import { makeEvalCtx, numInput, strInput, boolCondition } from './vmEvalBridge';
import { evalInput } from './eval';
import { detectFromWebcam, topLabel } from './vision';

interface Thread {
  spriteId: string;
  blockId: string | null;
  stack: Array<{ blockId: string; mode: 'forever' | 'repeat' | 'repeat_until' | 'branch'; remaining?: number }>;
  waitUntil: number;
  stopped: boolean;
}

export type VmListener = (snap: VmSnapshot) => void;
export type AiCaller = (prompt: string) => Promise<string>;

export class StageVM {
  private project: Project;
  private threads: Thread[] = [];
  private status: VmStatus = 'idle';
  private raf = 0;
  private listeners = new Set<VmListener>();
  private turbo = false;
  private lastMessage = '';
  private answer = '';
  private timerStart = performance.now();
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false };
  private aiCaller: AiCaller | null = null;
  private volume = 100;
  private sayUntil = 0;
  private sayText = '';
  private visionLabels: string[] = [];
  private pendingAsk: { thread: Thread; question: string } | null = null;

  constructor(project: Project) {
    this.project = structuredClone(project);
    if (!this.project.lists) this.project.lists = { list: [] };
    if (!this.project.penTrails) this.project.penTrails = [];
  }

  setAiCaller(fn: AiCaller | null) {
    this.aiCaller = fn;
  }

  setVisionLabels(labels: string[]) {
    this.visionLabels = labels;
  }

  setInputState(opts: { keys?: Set<string>; mouse?: { x: number; y: number; down: boolean } }) {
    if (opts.keys) this.keys = opts.keys;
    if (opts.mouse) this.mouse = opts.mouse;
  }

  subscribe(fn: VmListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snap: VmSnapshot = {
      status: this.status,
      variables: { ...this.project.variables },
      lists: { ...this.project.lists },
      sprites: this.project.sprites.map((s) => ({
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        direction: s.direction,
        size: s.size,
        visible: s.visible,
        costumeUrl: s.costumes?.[s.costumeIndex]?.url || s.costumeUrl,
        ghost: s.ghost ?? 0,
        isClone: s.isClone,
      })),
      message: this.lastMessage || this.sayText || undefined,
      penTrails: this.project.penTrails,
      answer: this.answer,
      ask: this.pendingAsk?.question ?? null,
      visionLabels: this.visionLabels,
    };
    this.listeners.forEach((fn) => fn(snap));
  }

  getProject(): Project {
    return this.project;
  }

  loadProject(project: Project) {
    this.stop();
    this.project = structuredClone(project);
    if (!this.project.lists) this.project.lists = { list: [] };
    if (!this.project.penTrails) this.project.penTrails = [];
    this.project.sprites = this.project.sprites.filter((s) => !s.isClone);
    this.emit();
  }

  setTurbo(on: boolean) {
    this.turbo = on;
  }

  greenFlag() {
    this.stop();
    this.project.sprites = this.project.sprites.filter((s) => !s.isClone);
    this.threads = [];
    this.pendingAsk = null;
    this.status = 'running';
    this.lastMessage = '';
    this.timerStart = performance.now();
    for (const sprite of this.project.sprites) {
      this.startHats(sprite, 'event_whenflagclicked');
    }
    this.emit();
    this.loop();
  }

  private startHats(sprite: SpriteState, opcode: string, broadcast?: string) {
    for (const rootId of sprite.scriptRoots) {
      const root = sprite.blocks[rootId];
      if (!root || root.opcode !== opcode) continue;
      if (opcode === 'event_whenbroadcastreceived') {
        if (String(root.fields.BROADCAST) !== broadcast) continue;
      }
      this.threads.push({
        spriteId: sprite.id,
        blockId: root.nextId,
        stack: [],
        waitUntil: 0,
        stopped: false,
      });
    }
  }

  keyPressed(key: string) {
    const normalized = key.toLowerCase();
    this.keys.add(normalized);
    let started = false;
    for (const sprite of this.project.sprites) {
      for (const rootId of sprite.scriptRoots) {
        const root = sprite.blocks[rootId];
        if (root?.opcode === 'event_whenkeypressed') {
          const want = String(root.fields.KEY || 'space').toLowerCase();
          if (want === normalized || (want === 'space' && key === ' ')) {
            this.threads.push({
              spriteId: sprite.id,
              blockId: root.nextId,
              stack: [],
              waitUntil: 0,
              stopped: false,
            });
            started = true;
          }
        }
      }
    }
    // Start the VM from idle when a key hat fires
    if (started && this.status === 'idle') {
      this.status = 'running';
      this.loop();
    }
  }

  /** Fire "when this sprite clicked" hats for the given sprite (starts VM from idle if needed). */
  spriteClicked(spriteId: string) {
    const sprite = this.getSprite(spriteId);
    if (!sprite) return;
    let started = false;
    for (const rootId of sprite.scriptRoots) {
      const root = sprite.blocks[rootId];
      if (root?.opcode === 'event_whenthisspriteclicked') {
        this.threads.push({
          spriteId: sprite.id,
          blockId: root.nextId,
          stack: [],
          waitUntil: 0,
          stopped: false,
        });
        started = true;
      }
    }
    if (started && this.status === 'idle') {
      this.status = 'running';
      this.loop();
    }
  }

  keyReleased(key: string) {
    this.keys.delete(key.toLowerCase());
  }

  pause() {
    if (this.status === 'running') {
      this.status = 'paused';
      cancelAnimationFrame(this.raf);
      this.emit();
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.emit();
      this.loop();
    }
  }

  stop() {
    this.status = 'idle';
    this.threads = [];
    this.pendingAsk = null;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  private loop = () => {
    if (this.status !== 'running') return;
    const steps = this.turbo ? 12 : 2;
    for (let i = 0; i < steps; i++) this.stepAll();
    if (performance.now() > this.sayUntil) this.sayText = '';
    this.emit();
    if (this.threads.some((t) => !t.stopped)) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.status = 'idle';
      this.emit();
    }
  };

  private stepAll() {
    const now = performance.now();
    const list = [...this.threads];
    for (const thread of list) {
      if (thread.stopped) continue;
      if (thread.waitUntil > now) continue;
      this.stepThread(thread, now);
    }
  }

  private getSprite(id: string): SpriteState | undefined {
    return this.project.sprites.find((s) => s.id === id);
  }

  private stepThread(thread: Thread, now: number) {
    const sprite = this.getSprite(thread.spriteId);
    if (!sprite) {
      thread.stopped = true;
      return;
    }

    if (!thread.blockId) {
      const frame = thread.stack.pop();
      if (!frame) {
        thread.stopped = true;
        return;
      }
      if (frame.mode === 'forever') {
        const blk = sprite.blocks[frame.blockId];
        thread.blockId = blk?.branchId || null;
        thread.stack.push(frame);
        return;
      }
      if (frame.mode === 'repeat') {
        if ((frame.remaining ?? 0) > 1) {
          frame.remaining! -= 1;
          const blk = sprite.blocks[frame.blockId];
          thread.blockId = blk?.branchId || null;
          thread.stack.push(frame);
        } else {
          thread.blockId = sprite.blocks[frame.blockId]?.nextId || null;
        }
        return;
      }
      if (frame.mode === 'repeat_until') {
        // Re-check the loop condition each iteration, not just on entry.
        const blk = sprite.blocks[frame.blockId];
        if (!blk) {
          thread.blockId = null;
          return;
        }
        const loopCtx = makeEvalCtx(
          this.project,
          sprite,
          this.keys,
          this.mouse,
          this.timerStart,
          this.answer,
          this.visionLabels
        );
        if (boolCondition(blk, loopCtx)) {
          thread.blockId = blk.nextId;
        } else {
          thread.blockId = blk.branchId || null;
          thread.stack.push(frame);
        }
        return;
      }
      if (frame.mode === 'branch') {
        thread.blockId = sprite.blocks[frame.blockId]?.nextId || null;
        return;
      }
    }

    const id = thread.blockId;
    if (!id) {
      thread.stopped = true;
      return;
    }
    const b = sprite.blocks[id];
    if (!b) {
      thread.stopped = true;
      return;
    }

    const ctx = makeEvalCtx(
      this.project,
      sprite,
      this.keys,
      this.mouse,
      this.timerStart,
      this.answer,
      this.visionLabels
    );
    const num = (k: string, fb = 0) => numInput(b, k, ctx, fb);
    const str = (k: string, fb = '') => strInput(b, k, ctx, fb);

    const moveTo = (nx: number, ny: number) => {
      if ((sprite as SpriteState & { _pen?: boolean })._pen) {
        this.project.penTrails = this.project.penTrails || [];
        this.project.penTrails.push({
          x1: sprite.x,
          y1: sprite.y,
          x2: nx,
          y2: ny,
          color: (sprite as SpriteState & { _penColor?: string })._penColor || '#00D2FF',
          size: (sprite as SpriteState & { _penSize?: number })._penSize || 2,
        });
        // Cap trail history so long forever-loops don't grow memory unboundedly.
        const MAX_TRAILS = 3000;
        if (this.project.penTrails.length > MAX_TRAILS) {
          this.project.penTrails.splice(0, this.project.penTrails.length - MAX_TRAILS);
        }
      }
      sprite.x = nx;
      sprite.y = ny;
      this.clamp(sprite);
    };

    switch (b.opcode) {
      case 'motion_movesteps': {
        const steps = num('STEPS', 10);
        const rad = ((90 - sprite.direction) * Math.PI) / 180;
        moveTo(sprite.x + Math.cos(rad) * steps, sprite.y + Math.sin(rad) * steps);
        thread.blockId = b.nextId;
        break;
      }
      case 'motion_turnright':
        sprite.direction = (sprite.direction + num('DEGREES', 15) + 360) % 360;
        thread.blockId = b.nextId;
        break;
      case 'motion_turnleft':
        sprite.direction = (sprite.direction - num('DEGREES', 15) + 360) % 360;
        thread.blockId = b.nextId;
        break;
      case 'motion_gotoxy':
        moveTo(num('X'), num('Y'));
        thread.blockId = b.nextId;
        break;
      case 'motion_goto': {
        const t = str('TARGET');
        if (t.includes('random'))
          moveTo((Math.random() - 0.5) * this.project.stageWidth, (Math.random() - 0.5) * this.project.stageHeight);
        else if (t.includes('mouse')) moveTo(this.mouse.x, this.mouse.y);
        thread.blockId = b.nextId;
        break;
      }
      case 'motion_glidesecstoxy':
        moveTo(num('X'), num('Y'));
        thread.waitUntil = now + num('SECS', 1) * 1000;
        thread.blockId = b.nextId;
        break;
      case 'motion_pointindirection':
        sprite.direction = num('DIRECTION', 90);
        thread.blockId = b.nextId;
        break;
      case 'motion_pointtowards': {
        const t = str('TARGET');
        let tx = 0,
          ty = 0;
        if (t.includes('mouse')) {
          tx = this.mouse.x;
          ty = this.mouse.y;
        }
        sprite.direction = (90 - (Math.atan2(ty - sprite.y, tx - sprite.x) * 180) / Math.PI + 360) % 360;
        thread.blockId = b.nextId;
        break;
      }
      case 'motion_changexby':
        moveTo(sprite.x + num('DX', 10), sprite.y);
        thread.blockId = b.nextId;
        break;
      case 'motion_setx':
        moveTo(num('X'), sprite.y);
        thread.blockId = b.nextId;
        break;
      case 'motion_changeyby':
        moveTo(sprite.x, sprite.y + num('DY', 10));
        thread.blockId = b.nextId;
        break;
      case 'motion_sety':
        moveTo(sprite.x, num('Y'));
        thread.blockId = b.nextId;
        break;
      case 'motion_ifonedgebounce':
        if (this.touchingEdge(sprite)) sprite.direction = (sprite.direction + 180) % 360;
        thread.blockId = b.nextId;
        break;
      case 'motion_setrotationstyle':
        sprite.rotationStyle = str('STYLE', 'all around') as SpriteState['rotationStyle'];
        thread.blockId = b.nextId;
        break;

      case 'looks_say':
      case 'looks_think':
        this.sayText = str('MESSAGE');
        this.sayUntil = now + 999999;
        thread.blockId = b.nextId;
        break;
      case 'looks_sayforsecs':
      case 'looks_thinkforsecs':
        this.sayText = str('MESSAGE');
        this.sayUntil = now + num('SECS', 2) * 1000;
        thread.waitUntil = this.sayUntil;
        thread.blockId = b.nextId;
        break;
      case 'looks_switchcostumeto': {
        if (sprite.costumes?.length) {
          const target = str('COSTUME', '0');
          const asNumber = Number(target);
          let idx: number;
          if (Number.isFinite(asNumber) && target.trim() !== '') {
            idx = ((Math.trunc(asNumber) % sprite.costumes.length) + sprite.costumes.length) % sprite.costumes.length;
          } else {
            // Fall back to matching by costume name
            idx = sprite.costumes.findIndex((c) => c.name.toLowerCase() === target.toLowerCase());
            if (idx < 0) idx = sprite.costumeIndex;
          }
          sprite.costumeIndex = idx;
          sprite.costumeUrl = sprite.costumes[idx].url;
        }
        thread.blockId = b.nextId;
        break;
      }
      case 'looks_nextcostume':
        if (sprite.costumes?.length) {
          sprite.costumeIndex = (sprite.costumeIndex + 1) % sprite.costumes.length;
          sprite.costumeUrl = sprite.costumes[sprite.costumeIndex].url;
        }
        thread.blockId = b.nextId;
        break;
      case 'looks_changesizeby':
        sprite.size += num('CHANGE', 10);
        thread.blockId = b.nextId;
        break;
      case 'looks_setsizeto':
        sprite.size = num('SIZE', 100);
        thread.blockId = b.nextId;
        break;
      case 'looks_changeeffectby':
        if (str('EFFECT') === 'ghost')
          sprite.ghost = Math.min(100, Math.max(0, (sprite.ghost || 0) + num('CHANGE', 25)));
        thread.blockId = b.nextId;
        break;
      case 'looks_seteffectto':
        if (str('EFFECT') === 'ghost') sprite.ghost = num('VALUE', 0);
        thread.blockId = b.nextId;
        break;
      case 'looks_cleargraphiceffects':
        sprite.ghost = 0;
        thread.blockId = b.nextId;
        break;
      case 'looks_show':
        sprite.visible = true;
        thread.blockId = b.nextId;
        break;
      case 'looks_hide':
        sprite.visible = false;
        thread.blockId = b.nextId;
        break;
      case 'looks_gotofrontback':
        thread.blockId = b.nextId;
        break;

      case 'sound_play':
      case 'sound_playuntildone':
        this.lastMessage = `♪ ${str('SOUND', 'pop')}`;
        if (b.opcode === 'sound_playuntildone') thread.waitUntil = now + 300;
        thread.blockId = b.nextId;
        break;
      case 'sound_stopallsounds':
        this.lastMessage = '';
        thread.blockId = b.nextId;
        break;
      case 'sound_setvolumeto':
        this.volume = num('VOLUME', 100);
        thread.blockId = b.nextId;
        break;
      case 'sound_changevolumeby':
        this.volume += num('VOLUME', -10);
        thread.blockId = b.nextId;
        break;

      case 'control_wait':
        thread.waitUntil = now + num('SECS', 1) * 1000;
        thread.blockId = b.nextId;
        break;
      case 'control_forever':
        if (b.branchId) {
          thread.stack.push({ blockId: b.id, mode: 'forever' });
          thread.blockId = b.branchId;
        } else {
          thread.blockId = b.nextId;
        }
        break;
      case 'control_repeat': {
        const times = Math.max(0, Math.floor(num('TIMES', 10)));
        if (times > 0 && b.branchId) {
          thread.stack.push({ blockId: b.id, mode: 'repeat', remaining: times });
          thread.blockId = b.branchId;
        } else {
          // repeat 0 times (or empty body) — skip the body entirely
          thread.blockId = b.nextId;
        }
        break;
      }
      case 'control_if': {
        const ok = boolCondition(b, ctx);
        if (ok && b.branchId) {
          thread.stack.push({ blockId: b.id, mode: 'branch' });
          thread.blockId = b.branchId;
        } else thread.blockId = b.nextId;
        break;
      }
      case 'control_if_else': {
        const ok = boolCondition(b, ctx);
        thread.stack.push({ blockId: b.id, mode: 'branch' });
        thread.blockId = ok ? b.branchId : b.branch2Id;
        break;
      }
      case 'control_wait_until':
        if (boolCondition(b, ctx)) thread.blockId = b.nextId;
        break;
      case 'control_repeat_until':
        if (boolCondition(b, ctx)) thread.blockId = b.nextId;
        else {
          thread.stack.push({ blockId: b.id, mode: 'repeat_until' });
          thread.blockId = b.branchId;
        }
        break;
      case 'control_stop': {
        const opt = str('STOP_OPTION', 'this script');
        if (opt.includes('all')) {
          this.stop();
          return;
        }
        thread.stopped = true;
        thread.blockId = null;
        break;
      }
      case 'control_create_clone_of': {
        const opt = str('CLONE_OPTION', '_myself_');
        const src =
          opt === '_myself_' || opt === 'myself'
            ? sprite
            : this.project.sprites.find((s) => s.name === opt && !s.isClone) || sprite;
        const clone: SpriteState = {
          ...structuredClone(src),
          id: uuid(),
          name: `${src.name} clone`,
          isClone: true,
          cloneOf: src.id,
          localVars: {},
        };
        this.project.sprites.push(clone);
        for (const rootId of clone.scriptRoots) {
          const root = clone.blocks[rootId];
          if (root?.opcode === 'control_start_as_clone') {
            this.threads.push({
              spriteId: clone.id,
              blockId: root.nextId,
              stack: [],
              waitUntil: 0,
              stopped: false,
            });
          }
        }
        thread.blockId = b.nextId;
        break;
      }
      case 'control_delete_this_clone':
        if (sprite.isClone) {
          this.project.sprites = this.project.sprites.filter((s) => s.id !== sprite.id);
          thread.stopped = true;
          thread.blockId = null;
        } else thread.blockId = b.nextId;
        break;

      case 'sensing_askandwait':
        if (this.pendingAsk) {
          // Another thread is already waiting on an answer — skip this ask.
          if (this.pendingAsk.thread !== thread) thread.blockId = b.nextId;
          break;
        }
        // Pause this thread until the user answers in the in-app dialog.
        this.pendingAsk = { thread, question: str('QUESTION', '?') };
        this.emit();
        break;
      case 'sensing_resettimer':
        this.timerStart = now;
        thread.blockId = b.nextId;
        break;

      case 'data_setvariableto': {
        const raw = String(evalInput(b, 'VALUE', ctx, 0));
        const n = Number(raw);
        this.project.variables[str('VARIABLE', 'score')] = raw.trim() !== '' && !Number.isNaN(n) ? n : raw;
        thread.blockId = b.nextId;
        break;
      }
      case 'data_changevariableby': {
        const name = str('VARIABLE', 'score');
        const cur = Number(this.project.variables[name]) || 0;
        this.project.variables[name] = cur + num('VALUE', 1);
        thread.blockId = b.nextId;
        break;
      }
      case 'data_showvariable':
      case 'data_hidevariable':
        thread.blockId = b.nextId;
        break;

      case 'data_addtolist': {
        const list = str('LIST', 'list');
        if (!this.project.lists[list]) this.project.lists[list] = [];
        this.project.lists[list].push(str('ITEM', 'thing'));
        thread.blockId = b.nextId;
        break;
      }
      case 'data_deleteoflist': {
        const list = str('LIST', 'list');
        const arr = this.project.lists[list] || [];
        arr.splice(Math.max(0, num('INDEX', 1) - 1), 1);
        thread.blockId = b.nextId;
        break;
      }
      case 'data_deletealloflist':
        this.project.lists[str('LIST', 'list')] = [];
        thread.blockId = b.nextId;
        break;
      case 'data_insertatlist': {
        const list = str('LIST', 'list');
        if (!this.project.lists[list]) this.project.lists[list] = [];
        this.project.lists[list].splice(Math.max(0, num('INDEX', 1) - 1), 0, str('ITEM'));
        thread.blockId = b.nextId;
        break;
      }
      case 'data_replaceitemoflist': {
        const list = str('LIST', 'list');
        const arr = this.project.lists[list] || (this.project.lists[list] = []);
        arr[Math.max(0, num('INDEX', 1) - 1)] = str('ITEM');
        thread.blockId = b.nextId;
        break;
      }

      case 'pen_clear':
        this.project.penTrails = [];
        thread.blockId = b.nextId;
        break;
      case 'pen_pendown':
        (sprite as SpriteState & { _pen?: boolean })._pen = true;
        thread.blockId = b.nextId;
        break;
      case 'pen_penup':
        (sprite as SpriteState & { _pen?: boolean })._pen = false;
        thread.blockId = b.nextId;
        break;
      case 'pen_setpencolorto':
        (sprite as SpriteState & { _penColor?: string })._penColor = str('COLOR', '#00D2FF');
        thread.blockId = b.nextId;
        break;
      case 'pen_setpensizeto':
        (sprite as SpriteState & { _penSize?: number })._penSize = num('SIZE', 1);
        thread.blockId = b.nextId;
        break;
      case 'pen_stamp':
        thread.blockId = b.nextId;
        break;

      case 'event_broadcast':
      case 'event_broadcastandwait': {
        const msg = str('BROADCAST', 'message1');
        for (const sp of this.project.sprites) this.startHats(sp, 'event_whenbroadcastreceived', msg);
        thread.blockId = b.nextId;
        break;
      }

      case 'ml_webcam_label': {
        const variable = str('VARIABLE', 'vision');
        thread.waitUntil = now + 60000;
        void (async () => {
          try {
            const dets = await detectFromWebcam();
            const labels = dets.map((d) => d.class);
            this.visionLabels = labels;
            this.project.variables[variable] = topLabel(dets);
            this.project.lists['objects'] = labels;
          } catch {
            this.project.variables[variable] = 'webcam-error';
          }
          thread.waitUntil = 0;
        })();
        thread.blockId = b.nextId;
        break;
      }

      case 'ai_ask':
      case 'ai_complete':
      case 'ai_summarize':
      case 'ai_classify_text':
      case 'ml_describe_scene':
      case 'ml_classify_image':
      case 'ml_similarity':
      case 'ml_predict_number':
      case 'ml_detect_objects': {
        const variable = str('VARIABLE', str('LIST', 'answer'));
        const prompt =
          b.opcode === 'ai_classify_text'
            ? `Classify this text into one of [${str('LABELS')}]. Reply with only the label.\nText: ${str('TEXT')}`
            : b.opcode === 'ml_similarity'
              ? `Rate similarity 0-100 between "${str('A')}" and "${str('B')}". Reply with a number only.`
              : b.opcode === 'ml_predict_number'
                ? `Given features [${str('FEATURES')}], predict a number. Reply with a number only.`
                : b.opcode === 'ml_detect_objects'
                  ? 'List 3 objects as comma-separated names.'
                  : b.opcode.startsWith('ml_')
                    ? 'Describe a game stage scene briefly.'
                    : str('PROMPT', str('TEXT', 'Hello'));

        if (this.aiCaller) {
          thread.waitUntil = now + 60000;
          this.aiCaller(prompt)
            .then((text) => {
              if (b.opcode === 'ml_detect_objects') {
                this.project.lists[str('LIST', 'objects')] = text
                  .split(/[,\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
              } else {
                this.project.variables[variable] = text.slice(0, 500);
              }
              thread.waitUntil = 0;
            })
            .catch(() => {
              this.project.variables[variable] = '(AI unavailable)';
              thread.waitUntil = 0;
            });
        } else {
          this.project.variables[variable] =
            b.opcode === 'ml_similarity'
              ? String(50 + Math.floor(Math.random() * 40))
              : `AI offline: ${prompt.slice(0, 40)}`;
        }
        thread.blockId = b.nextId;
        break;
      }
      case 'ai_build_script':
        this.lastMessage = `AI build: ${str('PROMPT')} (use assistant panel)`;
        thread.blockId = b.nextId;
        break;

      default:
        thread.blockId = b.nextId;
    }
  }

  /**
   * Resolve a pending "ask and wait" — called from the UI answer dialog.
   * Stores the answer in the `answer` variable and resumes the waiting thread.
   */
  submitAnswer(text: string) {
    this.answer = text;
    this.project.variables['answer'] = text;
    if (!this.pendingAsk) {
      this.emit();
      return;
    }
    const { thread } = this.pendingAsk;
    this.pendingAsk = null;
    const sprite = this.getSprite(thread.spriteId);
    const askBlock = thread.blockId ? sprite?.blocks[thread.blockId] : null;
    thread.blockId = askBlock?.nextId || null;
    this.emit();
  }

  private clamp(sprite: SpriteState) {
    const halfW = this.project.stageWidth / 2;
    const halfH = this.project.stageHeight / 2;
    sprite.x = Math.max(-halfW, Math.min(halfW, sprite.x));
    sprite.y = Math.max(-halfH, Math.min(halfH, sprite.y));
  }

  private touchingEdge(sprite: SpriteState): boolean {
    const halfW = this.project.stageWidth / 2 - 4;
    const halfH = this.project.stageHeight / 2 - 4;
    return Math.abs(sprite.x) >= halfW || Math.abs(sprite.y) >= halfH;
  }
}
