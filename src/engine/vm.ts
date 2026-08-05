/**
 * Stage VM — interprets Snap! block stacks (Scratch-like coordinate system).
 * Stage: center (0,0), x ∈ [-240,240], y ∈ [-180,180] for 480×360.
 */

import type {
  BlockInstance,
  Project,
  SpriteState,
  VmSnapshot,
  VmStatus,
} from './types';

interface Thread {
  spriteId: string;
  blockId: string | null;
  /** Stack for C-blocks (forever/repeat return points) */
  stack: Array<{ blockId: string; mode: 'forever' | 'repeat'; remaining?: number }>;
  waitUntil: number;
  stopped: boolean;
}

export type VmListener = (snap: VmSnapshot) => void;

export class StageVM {
  private project: Project;
  private threads: Thread[] = [];
  private status: VmStatus = 'idle';
  private raf = 0;
  private listeners = new Set<VmListener>();
  private turbo = false;
  private lastMessage = '';

  constructor(project: Project) {
    this.project = structuredClone(project);
  }

  subscribe(fn: VmListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    const snap: VmSnapshot = {
      status: this.status,
      variables: { ...this.project.variables },
      sprites: this.project.sprites.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        direction: s.direction,
        size: s.size,
        visible: s.visible,
      })),
      message: this.lastMessage || undefined,
    };
    this.listeners.forEach((fn) => fn(snap));
  }

  getProject(): Project {
    return this.project;
  }

  loadProject(project: Project) {
    this.stop();
    this.project = structuredClone(project);
    this.emit();
  }

  setTurbo(on: boolean) {
    this.turbo = on;
  }

  greenFlag() {
    this.stop();
    // reset runtime copies of positions from loaded scripts' starting state
    // keep current project geometry; only restart threads
    this.threads = [];
    this.status = 'running';
    this.lastMessage = '';

    for (const sprite of this.project.sprites) {
      for (const rootId of sprite.scriptRoots) {
        const root = sprite.blocks[rootId];
        if (root?.opcode === 'event_whenflagclicked') {
          this.threads.push({
            spriteId: sprite.id,
            blockId: root.nextId,
            stack: [],
            waitUntil: 0,
            stopped: false,
          });
        }
      }
    }

    this.emit();
    this.loop();
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
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  private loop = () => {
    if (this.status !== 'running') return;
    const steps = this.turbo ? 8 : 1;
    for (let i = 0; i < steps; i++) this.stepAll();
    this.emit();
    if (this.threads.some((t) => !t.stopped && t.blockId)) {
      this.raf = requestAnimationFrame(this.loop);
    } else if (this.threads.every((t) => t.stopped || !t.blockId)) {
      // keep forever loops alive
      const anyAlive = this.threads.some((t) => !t.stopped);
      if (anyAlive) this.raf = requestAnimationFrame(this.loop);
      else {
        this.status = 'idle';
        this.emit();
      }
    } else {
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private stepAll() {
    const now = performance.now();
    for (const thread of this.threads) {
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

    // Resume from C-block stack if no current block
    if (!thread.blockId) {
      const frame = thread.stack.pop();
      if (!frame) {
        thread.stopped = true;
        return;
      }
      if (frame.mode === 'forever') {
        const blk = sprite.blocks[frame.blockId];
        thread.blockId = blk?.branchId || null;
        thread.stack.push(frame); // re-push forever
        return;
      }
      if (frame.mode === 'repeat') {
        if ((frame.remaining ?? 0) > 1) {
          frame.remaining = (frame.remaining ?? 1) - 1;
          const blk = sprite.blocks[frame.blockId];
          thread.blockId = blk?.branchId || null;
          thread.stack.push(frame);
        } else {
          const blk = sprite.blocks[frame.blockId];
          thread.blockId = blk?.nextId || null;
        }
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

    const num = (k: string, fallback = 0) => Number(b.fields[k] ?? fallback);
    const str = (k: string, fallback = '') => String(b.fields[k] ?? fallback);

    switch (b.opcode) {
      case 'motion_movesteps': {
        const steps = num('STEPS', 10);
        const rad = ((90 - sprite.direction) * Math.PI) / 180;
        sprite.x += Math.cos(rad) * steps;
        sprite.y += Math.sin(rad) * steps;
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      }
      case 'motion_turnright':
        sprite.direction = (sprite.direction + num('DEGREES', 15)) % 360;
        thread.blockId = b.nextId;
        break;
      case 'motion_turnleft':
        sprite.direction = (sprite.direction - num('DEGREES', 15) + 360) % 360;
        thread.blockId = b.nextId;
        break;
      case 'motion_gotoxy':
        sprite.x = num('X');
        sprite.y = num('Y');
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      case 'motion_pointindirection':
        sprite.direction = num('DIRECTION', 90);
        thread.blockId = b.nextId;
        break;
      case 'motion_changexby':
        sprite.x += num('DX', 10);
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      case 'motion_changeyby':
        sprite.y += num('DY', 10);
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      case 'motion_setx':
        sprite.x = num('X');
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      case 'motion_sety':
        sprite.y = num('Y');
        this.clamp(sprite);
        thread.blockId = b.nextId;
        break;
      case 'control_wait':
        thread.waitUntil = now + num('SECS', 1) * 1000;
        thread.blockId = b.nextId;
        break;
      case 'control_forever':
        thread.stack.push({ blockId: b.id, mode: 'forever' });
        thread.blockId = b.branchId;
        break;
      case 'control_repeat':
        thread.stack.push({
          blockId: b.id,
          mode: 'repeat',
          remaining: Math.max(0, Math.floor(num('TIMES', 10))),
        });
        thread.blockId = b.branchId;
        break;
      case 'control_if': {
        // sensing: touching edge
        const touching = this.touchingEdge(sprite);
        if (touching) thread.blockId = b.branchId;
        else thread.blockId = b.nextId;
        // after branch completes we need to go to next — simple approach:
        // if entering branch, push a one-shot return
        if (touching && b.branchId) {
          // linearize: run branch then next via stack frame simulated by chaining
          // For MVP: execute branch blocks inline by setting next of last... 
          // simpler: only support single-level if by jumping into branch, and
          // when branch ends (null), go to b.nextId via temporary stack
          thread.stack.push({
            blockId: b.id,
            mode: 'repeat',
            remaining: 1,
          });
          // override: after one "repeat" of empty body end, nextId runs
          // Actually use custom: store next on a pseudo frame
          thread.stack.pop();
          // Walk: set a synthetic return by appending next after branch chain is complex.
          // MVP: if branch runs, when branch finishes thread ends branch then we set:
          const branchEndReturn = b.nextId;
          // Patch: push forever-like one iteration that then goes to next
          thread.stack.push({
            blockId: b.id,
            mode: 'repeat',
            remaining: 1,
          });
          // When repeat finishes it uses blk.nextId — wrong.
          // Fix control_if specially: after entering branch, we need return to nextId.
          // Store return target on thread via stack with remaining 0 trick:
          void branchEndReturn;
          // Cleaner rewrite below in touching false already set next.
          // For true: run branch, then continue to next when branch null using stack frame
          // with mode that goes to nextId of control_if
          thread.stack.pop();
          thread.stack.push({
            blockId: b.id,
            mode: 'repeat',
            remaining: 1,
          });
          // When remaining hits 0 path uses nextId of control_if — good if we
          // don't re-enter branch. On first push remaining=1, body runs, then
          // remaining becomes 0 and nextId runs. Perfect if body is branchId.
          // Wait: first entry already set blockId = branchId. Stack has remaining 1.
          // When body ends blockId=null, pop frame remaining>1? remaining is 1 so
          // goes to nextId. Yes!
        }
        break;
      }
      case 'control_stop':
        thread.stopped = true;
        thread.blockId = null;
        break;
      case 'looks_setsizeto':
        sprite.size = num('SIZE', 100);
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
      case 'data_setvariableto': {
        const name = str('VARIABLE', 'score');
        this.project.variables[name] = num('VALUE', 0);
        thread.blockId = b.nextId;
        break;
      }
      case 'data_changevariableby': {
        const name = str('VARIABLE', 'score');
        const cur = Number(this.project.variables[name] ?? 0);
        this.project.variables[name] = cur + num('VALUE', 1);
        thread.blockId = b.nextId;
        break;
      }
      case 'sound_play':
        this.lastMessage = `♪ ${str('SOUND', 'pop')}`;
        thread.blockId = b.nextId;
        break;
      default:
        thread.blockId = b.nextId;
    }
  }

  private clamp(sprite: SpriteState) {
    const halfW = this.project.stageWidth / 2;
    const halfH = this.project.stageHeight / 2;
    sprite.x = Math.max(-halfW, Math.min(halfW, sprite.x));
    sprite.y = Math.max(-halfH, Math.min(halfH, sprite.y));
  }

  private touchingEdge(sprite: SpriteState): boolean {
    const halfW = this.project.stageWidth / 2 - 2;
    const halfH = this.project.stageHeight / 2 - 2;
    return (
      Math.abs(sprite.x) >= halfW || Math.abs(sprite.y) >= halfH
    );
  }
}
