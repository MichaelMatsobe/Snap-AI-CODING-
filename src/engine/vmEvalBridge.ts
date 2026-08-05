/** Bridge StageVM private state to eval.ts without circular imports issues */

import { evalCondition, evalInput, type EvalCtx } from './eval';
import type { BlockInstance, Project, SpriteState } from './types';

export function makeEvalCtx(
  project: Project,
  sprite: SpriteState,
  keys: Set<string>,
  mouse: { x: number; y: number; down: boolean },
  timerStart: number,
  answer: string,
  visionLabels: string[] = []
): EvalCtx {
  return { project, sprite, keys, mouse, timerStart, answer, visionLabels };
}

export function numInput(
  block: BlockInstance,
  name: string,
  ctx: EvalCtx,
  fallback = 0
): number {
  return Number(evalInput(block, name, ctx, fallback));
}

export function strInput(
  block: BlockInstance,
  name: string,
  ctx: EvalCtx,
  fallback = ''
): string {
  return String(evalInput(block, name, ctx, fallback));
}

export function boolCondition(block: BlockInstance, ctx: EvalCtx): boolean {
  const condBlock =
    block.inputs?.CONDITION?.kind === 'block'
      ? ctx.sprite.blocks[block.inputs.CONDITION.blockId]
      : null;
  const text = String(block.fields.CONDITION ?? 'touching edge');
  return evalCondition(condBlock || null, text, ctx);
}
