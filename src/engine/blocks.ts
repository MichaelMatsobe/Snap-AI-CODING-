import type { BlockDef, CategoryId } from './types';

export const CATEGORY_COLORS: Record<
  CategoryId,
  { bg: string; text: string }
> = {
  Motion: { bg: '#4C97FF', text: '#fff' },
  Looks: { bg: '#9966FF', text: '#fff' },
  Sound: { bg: '#CF63CF', text: '#fff' },
  Events: { bg: '#FFBF00', text: '#1a1a1a' },
  Control: { bg: '#FFAB19', text: '#1a1a1a' },
  Sensing: { bg: '#5CB1D6', text: '#fff' },
  Operators: { bg: '#59C059', text: '#fff' },
  Variables: { bg: '#FF8C1A', text: '#fff' },
};

export const BLOCK_DEFS: BlockDef[] = [
  // Events
  {
    opcode: 'event_whenflagclicked',
    category: 'Events',
    shape: 'hat',
    label: 'when green flag clicked',
    color: CATEGORY_COLORS.Events.bg,
    textColor: CATEGORY_COLORS.Events.text,
  },
  // Motion
  {
    opcode: 'motion_movesteps',
    category: 'Motion',
    shape: 'stack',
    label: 'move {STEPS} steps',
    fields: { STEPS: 10 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_turnright',
    category: 'Motion',
    shape: 'stack',
    label: 'turn right {DEGREES} degrees',
    fields: { DEGREES: 15 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_turnleft',
    category: 'Motion',
    shape: 'stack',
    label: 'turn left {DEGREES} degrees',
    fields: { DEGREES: 15 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_gotoxy',
    category: 'Motion',
    shape: 'stack',
    label: 'go to x: {X} y: {Y}',
    fields: { X: 0, Y: 0 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_pointindirection',
    category: 'Motion',
    shape: 'stack',
    label: 'point in direction {DIRECTION}',
    fields: { DIRECTION: 90 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_changexby',
    category: 'Motion',
    shape: 'stack',
    label: 'change x by {DX}',
    fields: { DX: 10 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_changeyby',
    category: 'Motion',
    shape: 'stack',
    label: 'change y by {DY}',
    fields: { DY: 10 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_setx',
    category: 'Motion',
    shape: 'stack',
    label: 'set x to {X}',
    fields: { X: 0 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  {
    opcode: 'motion_sety',
    category: 'Motion',
    shape: 'stack',
    label: 'set y to {Y}',
    fields: { Y: 0 },
    color: CATEGORY_COLORS.Motion.bg,
  },
  // Control
  {
    opcode: 'control_wait',
    category: 'Control',
    shape: 'stack',
    label: 'wait {SECS} seconds',
    fields: { SECS: 1 },
    color: CATEGORY_COLORS.Control.bg,
    textColor: CATEGORY_COLORS.Control.text,
  },
  {
    opcode: 'control_forever',
    category: 'Control',
    shape: 'c',
    label: 'forever',
    color: CATEGORY_COLORS.Control.bg,
    textColor: CATEGORY_COLORS.Control.text,
  },
  {
    opcode: 'control_repeat',
    category: 'Control',
    shape: 'c',
    label: 'repeat {TIMES}',
    fields: { TIMES: 10 },
    color: CATEGORY_COLORS.Control.bg,
    textColor: CATEGORY_COLORS.Control.text,
  },
  {
    opcode: 'control_if',
    category: 'Control',
    shape: 'c',
    label: 'if touching edge then',
    color: CATEGORY_COLORS.Control.bg,
    textColor: CATEGORY_COLORS.Control.text,
  },
  {
    opcode: 'control_stop',
    category: 'Control',
    shape: 'stack',
    label: 'stop this script',
    color: CATEGORY_COLORS.Control.bg,
    textColor: CATEGORY_COLORS.Control.text,
  },
  // Looks
  {
    opcode: 'looks_setsizeto',
    category: 'Looks',
    shape: 'stack',
    label: 'set size to {SIZE} %',
    fields: { SIZE: 100 },
    color: CATEGORY_COLORS.Looks.bg,
  },
  {
    opcode: 'looks_show',
    category: 'Looks',
    shape: 'stack',
    label: 'show',
    color: CATEGORY_COLORS.Looks.bg,
  },
  {
    opcode: 'looks_hide',
    category: 'Looks',
    shape: 'stack',
    label: 'hide',
    color: CATEGORY_COLORS.Looks.bg,
  },
  // Variables
  {
    opcode: 'data_setvariableto',
    category: 'Variables',
    shape: 'stack',
    label: 'set {VARIABLE} to {VALUE}',
    fields: { VARIABLE: 'score', VALUE: 0 },
    color: CATEGORY_COLORS.Variables.bg,
  },
  {
    opcode: 'data_changevariableby',
    category: 'Variables',
    shape: 'stack',
    label: 'change {VARIABLE} by {VALUE}',
    fields: { VARIABLE: 'score', VALUE: 1 },
    color: CATEGORY_COLORS.Variables.bg,
  },
  // Sound (visual feedback only)
  {
    opcode: 'sound_play',
    category: 'Sound',
    shape: 'stack',
    label: 'play sound {SOUND}',
    fields: { SOUND: 'pop' },
    color: CATEGORY_COLORS.Sound.bg,
  },
];

export function getDef(opcode: string): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.opcode === opcode);
}

export function blocksForCategory(category: CategoryId): BlockDef[] {
  return BLOCK_DEFS.filter((b) => b.category === category);
}

export function formatLabel(
  def: BlockDef,
  fields: Record<string, string | number>
): string {
  let s = def.label;
  for (const [k, v] of Object.entries({ ...def.fields, ...fields })) {
    s = s.replace(`{${k}}`, String(v));
  }
  return s;
}
