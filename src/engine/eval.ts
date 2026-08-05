/** Nested reporter / boolean evaluation */

import type { BlockInstance, Project, SpriteState } from './types';

export type EvalCtx = {
  project: Project;
  sprite: SpriteState;
  keys: Set<string>;
  mouse: { x: number; y: number; down: boolean };
  timerStart: number;
  answer: string;
  visionLabels: string[];
};

export function evalInput(
  block: BlockInstance,
  name: string,
  ctx: EvalCtx,
  fallback: string | number = 0
): string | number | boolean {
  const input = block.inputs?.[name];
  if (!input) {
    if (block.fields[name] !== undefined) return block.fields[name];
    return fallback;
  }
  if (input.kind === 'shadow') return input.value;
  const nested = ctx.sprite.blocks[input.blockId];
  if (!nested) return fallback;
  return evalReporter(nested, ctx);
}

export function evalReporter(block: BlockInstance, ctx: EvalCtx): string | number | boolean {
  const num = (k: string, fb = 0) => Number(evalInput(block, k, ctx, fb));
  const str = (k: string, fb = '') => String(evalInput(block, k, ctx, fb));

  switch (block.opcode) {
    case 'operator_add':
      return num('NUM1') + num('NUM2');
    case 'operator_subtract':
      return num('NUM1') - num('NUM2');
    case 'operator_multiply':
      return num('NUM1') * num('NUM2');
    case 'operator_divide': {
      const d = num('NUM2');
      return d === 0 ? 0 : num('NUM1') / d;
    }
    case 'operator_random': {
      const a = num('FROM', 1);
      const b = num('TO', 10);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
    case 'operator_gt':
      return num('OPERAND1') > num('OPERAND2');
    case 'operator_lt':
      return num('OPERAND1') < num('OPERAND2');
    case 'operator_equals':
      return String(evalInput(block, 'OPERAND1', ctx)) === String(evalInput(block, 'OPERAND2', ctx));
    case 'operator_and':
      return Boolean(evalInput(block, 'OPERAND1', ctx, false)) && Boolean(evalInput(block, 'OPERAND2', ctx, false));
    case 'operator_or':
      return Boolean(evalInput(block, 'OPERAND1', ctx, false)) || Boolean(evalInput(block, 'OPERAND2', ctx, false));
    case 'operator_not':
      return !Boolean(evalInput(block, 'OPERAND', ctx, false));
    case 'operator_join':
      return str('STRING1') + str('STRING2');
    case 'operator_letter_of': {
      const s = str('STRING');
      const i = num('LETTER', 1) - 1;
      return s.charAt(i) || '';
    }
    case 'operator_length':
      return str('STRING').length;
    case 'operator_contains':
      return str('STRING1').includes(str('STRING2'));
    case 'operator_mod':
      return num('NUM1') % num('NUM2');
    case 'operator_round':
      return Math.round(num('NUM'));
    case 'operator_mathop': {
      const n = num('NUM');
      const op = str('OPERATOR', 'abs');
      if (op === 'abs') return Math.abs(n);
      if (op === 'floor') return Math.floor(n);
      if (op === 'ceiling') return Math.ceil(n);
      if (op === 'sqrt') return Math.sqrt(n);
      if (op === 'sin') return Math.sin((n * Math.PI) / 180);
      if (op === 'cos') return Math.cos((n * Math.PI) / 180);
      return n;
    }
    case 'sensing_mousex':
      return ctx.mouse.x;
    case 'sensing_mousey':
      return ctx.mouse.y;
    case 'sensing_mousedown':
      return ctx.mouse.down;
    case 'sensing_timer':
      return (performance.now() - ctx.timerStart) / 1000;
    case 'sensing_answer':
      return ctx.answer;
    case 'sensing_keypressed':
      return ctx.keys.has(str('KEY_OPTION', 'space').toLowerCase());
    case 'sensing_touchingobject': {
      const t = str('TOUCHINGOBJECTMENU', 'edge');
      if (t.includes('edge')) {
        const halfW = ctx.project.stageWidth / 2 - 4;
        const halfH = ctx.project.stageHeight / 2 - 4;
        return Math.abs(ctx.sprite.x) >= halfW || Math.abs(ctx.sprite.y) >= halfH;
      }
      return false;
    }
    case 'sensing_distanceto': {
      const t = str('DISTANCETOMENU', 'mouse-pointer');
      if (t.includes('mouse')) {
        const dx = ctx.mouse.x - ctx.sprite.x;
        const dy = ctx.mouse.y - ctx.sprite.y;
        return Math.sqrt(dx * dx + dy * dy);
      }
      return 0;
    }
    case 'data_itemoflist': {
      const list = ctx.project.lists[str('LIST', 'list')] || [];
      return list[num('INDEX', 1) - 1] ?? '';
    }
    case 'data_lengthoflist':
      return (ctx.project.lists[str('LIST', 'list')] || []).length;
    case 'data_listcontainsitem':
      return (ctx.project.lists[str('LIST', 'list')] || []).map(String).includes(str('ITEM'));
    case 'sensing_of': {
      const prop = str('PROPERTY', 'x position');
      if (prop.includes('x')) return ctx.sprite.x;
      if (prop.includes('y')) return ctx.sprite.y;
      if (prop.includes('direction')) return ctx.sprite.direction;
      if (prop.includes('size')) return ctx.sprite.size;
      return 0;
    }
    case 'sensing_current': {
      const d = new Date();
      const m = str('CURRENTMENU', 'year');
      if (m === 'year') return d.getFullYear();
      if (m === 'month') return d.getMonth() + 1;
      if (m === 'date') return d.getDate();
      if (m === 'day of week') return d.getDay() + 1;
      if (m === 'hour') return d.getHours();
      if (m === 'minute') return d.getMinutes();
      if (m === 'second') return d.getSeconds();
      return 0;
    }
    case 'sensing_dayssince2000':
      return (Date.now() - Date.UTC(2000, 0, 1)) / 86400000;
    default:
      // variable reporter-like: field VARIABLE
      if (block.fields.VARIABLE) return ctx.project.variables[String(block.fields.VARIABLE)] ?? 0;
      return 0;
  }
}

export function evalCondition(block: BlockInstance | null, text: string, ctx: EvalCtx): boolean {
  if (block) {
    const v = evalReporter(block, ctx);
    return Boolean(v);
  }
  const c = text.toLowerCase().trim();
  if (c === 'true' || c === '1') return true;
  if (c === 'false' || c === '0') return false;
  if (c.includes('touching') && c.includes('edge')) {
    const halfW = ctx.project.stageWidth / 2 - 4;
    const halfH = ctx.project.stageHeight / 2 - 4;
    return Math.abs(ctx.sprite.x) >= halfW || Math.abs(ctx.sprite.y) >= halfH;
  }
  const m = c.match(/^(\w+)\s*([><=]+)\s*(-?[\d.]+)$/);
  if (m) {
    const v = Number(ctx.project.variables[m[1]] ?? 0);
    const n = Number(m[3]);
    if (m[2] === '>') return v > n;
    if (m[2] === '<') return v < n;
    return v === n;
  }
  return false;
}
