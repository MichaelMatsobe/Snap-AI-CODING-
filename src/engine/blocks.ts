import type { BlockDef, CategoryId } from './types';

export const CATEGORY_COLORS: Record<CategoryId, { bg: string; text: string }> = {
  Motion: { bg: '#4C97FF', text: '#fff' },
  Looks: { bg: '#9966FF', text: '#fff' },
  Sound: { bg: '#CF63CF', text: '#fff' },
  Events: { bg: '#FFBF00', text: '#1a1a1a' },
  Control: { bg: '#FFAB19', text: '#1a1a1a' },
  Sensing: { bg: '#5CB1D6', text: '#fff' },
  Operators: { bg: '#59C059', text: '#fff' },
  Variables: { bg: '#FF8C1A', text: '#fff' },
  Lists: { bg: '#FF661A', text: '#fff' },
  Pen: { bg: '#0FBD8C', text: '#fff' },
  AI: { bg: '#00D2FF', text: '#003543' },
  ML: { bg: '#E040FB', text: '#fff' },
};

function d(
  opcode: string,
  category: CategoryId,
  shape: BlockDef['shape'],
  label: string,
  fields?: Record<string, string | number>
): BlockDef {
  const c = CATEGORY_COLORS[category];
  return { opcode, category, shape, label, fields, color: c.bg, textColor: c.text };
}

/** Scratch 3-inspired + Snap! extras + AI/ML blocks */
export const BLOCK_DEFS: BlockDef[] = [
  // ── Events ──────────────────────────────────────────
  d('event_whenflagclicked', 'Events', 'hat', 'when green flag clicked'),
  d('event_whenkeypressed', 'Events', 'hat', 'when {KEY} key pressed', { KEY: 'space' }),
  d('event_whenthisspriteclicked', 'Events', 'hat', 'when this sprite clicked'),
  d('event_whenbroadcastreceived', 'Events', 'hat', 'when I receive {BROADCAST}', { BROADCAST: 'message1' }),
  d('event_broadcast', 'Events', 'stack', 'broadcast {BROADCAST}', { BROADCAST: 'message1' }),
  d('event_broadcastandwait', 'Events', 'stack', 'broadcast {BROADCAST} and wait', { BROADCAST: 'message1' }),
  d('control_start_as_clone', 'Events', 'hat', 'when I start as a clone'),

  // ── Motion ──────────────────────────────────────────
  d('motion_movesteps', 'Motion', 'stack', 'move {STEPS} steps', { STEPS: 10 }),
  d('motion_turnright', 'Motion', 'stack', 'turn right {DEGREES} degrees', { DEGREES: 15 }),
  d('motion_turnleft', 'Motion', 'stack', 'turn left {DEGREES} degrees', { DEGREES: 15 }),
  d('motion_goto', 'Motion', 'stack', 'go to {TARGET}', { TARGET: 'random position' }),
  d('motion_gotoxy', 'Motion', 'stack', 'go to x: {X} y: {Y}', { X: 0, Y: 0 }),
  d('motion_glidesecstoxy', 'Motion', 'stack', 'glide {SECS} secs to x: {X} y: {Y}', { SECS: 1, X: 0, Y: 0 }),
  d('motion_pointindirection', 'Motion', 'stack', 'point in direction {DIRECTION}', { DIRECTION: 90 }),
  d('motion_pointtowards', 'Motion', 'stack', 'point towards {TARGET}', { TARGET: 'mouse-pointer' }),
  d('motion_changexby', 'Motion', 'stack', 'change x by {DX}', { DX: 10 }),
  d('motion_setx', 'Motion', 'stack', 'set x to {X}', { X: 0 }),
  d('motion_changeyby', 'Motion', 'stack', 'change y by {DY}', { DY: 10 }),
  d('motion_sety', 'Motion', 'stack', 'set y to {Y}', { Y: 0 }),
  d('motion_ifonedgebounce', 'Motion', 'stack', 'if on edge, bounce'),
  d('motion_setrotationstyle', 'Motion', 'stack', 'set rotation style {STYLE}', { STYLE: 'all around' }),
  d('motion_xposition', 'Motion', 'reporter', 'x position'),
  d('motion_yposition', 'Motion', 'reporter', 'y position'),
  d('motion_direction', 'Motion', 'reporter', 'direction'),

  // ── Looks ───────────────────────────────────────────
  d('looks_sayforsecs', 'Looks', 'stack', 'say {MESSAGE} for {SECS} seconds', { MESSAGE: 'Hello!', SECS: 2 }),
  d('looks_say', 'Looks', 'stack', 'say {MESSAGE}', { MESSAGE: 'Hello!' }),
  d('looks_thinkforsecs', 'Looks', 'stack', 'think {MESSAGE} for {SECS} seconds', { MESSAGE: 'Hmm...', SECS: 2 }),
  d('looks_think', 'Looks', 'stack', 'think {MESSAGE}', { MESSAGE: 'Hmm...' }),
  d('looks_switchcostumeto', 'Looks', 'stack', 'switch costume to {COSTUME}', { COSTUME: '0' }),
  d('looks_nextcostume', 'Looks', 'stack', 'next costume'),
  d('looks_changesizeby', 'Looks', 'stack', 'change size by {CHANGE}', { CHANGE: 10 }),
  d('looks_setsizeto', 'Looks', 'stack', 'set size to {SIZE} %', { SIZE: 100 }),
  d('looks_changeeffectby', 'Looks', 'stack', 'change {EFFECT} effect by {CHANGE}', { EFFECT: 'ghost', CHANGE: 25 }),
  d('looks_seteffectto', 'Looks', 'stack', 'set {EFFECT} effect to {VALUE}', { EFFECT: 'ghost', VALUE: 0 }),
  d('looks_cleargraphiceffects', 'Looks', 'stack', 'clear graphic effects'),
  d('looks_show', 'Looks', 'stack', 'show'),
  d('looks_hide', 'Looks', 'stack', 'hide'),
  d('looks_gotofrontback', 'Looks', 'stack', 'go to {LAYER} layer', { LAYER: 'front' }),
  d('looks_size', 'Looks', 'reporter', 'size'),
  d('looks_costumenumbername', 'Looks', 'reporter', 'costume {NUMBER_NAME}', { NUMBER_NAME: 'number' }),

  // ── Sound ───────────────────────────────────────────
  d('sound_play', 'Sound', 'stack', 'play sound {SOUND}', { SOUND: 'pop' }),
  d('sound_playuntildone', 'Sound', 'stack', 'play sound {SOUND} until done', { SOUND: 'pop' }),
  d('sound_stopallsounds', 'Sound', 'stack', 'stop all sounds'),
  d('sound_changevolumeby', 'Sound', 'stack', 'change volume by {VOLUME}', { VOLUME: -10 }),
  d('sound_setvolumeto', 'Sound', 'stack', 'set volume to {VOLUME} %', { VOLUME: 100 }),
  d('sound_volume', 'Sound', 'reporter', 'volume'),

  // ── Control ─────────────────────────────────────────
  d('control_wait', 'Control', 'stack', 'wait {SECS} seconds', { SECS: 1 }),
  d('control_repeat', 'Control', 'c', 'repeat {TIMES}', { TIMES: 10 }),
  d('control_forever', 'Control', 'c', 'forever'),
  d('control_if', 'Control', 'c', 'if {CONDITION} then', { CONDITION: 'touching edge' }),
  d('control_if_else', 'Control', 'c', 'if {CONDITION} then else', { CONDITION: 'touching edge' }),
  d('control_wait_until', 'Control', 'stack', 'wait until {CONDITION}', { CONDITION: 'touching edge' }),
  d('control_repeat_until', 'Control', 'c', 'repeat until {CONDITION}', { CONDITION: 'touching edge' }),
  d('control_stop', 'Control', 'cap', 'stop {STOP_OPTION}', { STOP_OPTION: 'this script' }),
  d('control_create_clone_of', 'Control', 'stack', 'create clone of {CLONE_OPTION}', { CLONE_OPTION: '_myself_' }),
  d('control_delete_this_clone', 'Control', 'cap', 'delete this clone'),

  // ── Sensing ─────────────────────────────────────────
  d('sensing_touchingobject', 'Sensing', 'boolean', 'touching {TOUCHINGOBJECTMENU} ?', { TOUCHINGOBJECTMENU: 'edge' }),
  d('sensing_touchingcolor', 'Sensing', 'boolean', 'touching color {COLOR} ?', { COLOR: '#FF0000' }),
  d('sensing_distanceto', 'Sensing', 'reporter', 'distance to {DISTANCETOMENU}', { DISTANCETOMENU: 'mouse-pointer' }),
  d('sensing_askandwait', 'Sensing', 'stack', 'ask {QUESTION} and wait', { QUESTION: 'What is your name?' }),
  d('sensing_answer', 'Sensing', 'reporter', 'answer'),
  d('sensing_keypressed', 'Sensing', 'boolean', 'key {KEY_OPTION} pressed?', { KEY_OPTION: 'space' }),
  d('sensing_mousedown', 'Sensing', 'boolean', 'mouse down?'),
  d('sensing_mousex', 'Sensing', 'reporter', 'mouse x'),
  d('sensing_mousey', 'Sensing', 'reporter', 'mouse y'),
  d('sensing_loudness', 'Sensing', 'reporter', 'loudness'),
  d('sensing_timer', 'Sensing', 'reporter', 'timer'),
  d('sensing_resettimer', 'Sensing', 'stack', 'reset timer'),
  d('sensing_of', 'Sensing', 'reporter', '{PROPERTY} of {OBJECT}', { PROPERTY: 'x position', OBJECT: 'Stage' }),
  d('sensing_current', 'Sensing', 'reporter', 'current {CURRENTMENU}', { CURRENTMENU: 'year' }),
  d('sensing_dayssince2000', 'Sensing', 'reporter', 'days since 2000'),

  // ── Operators ───────────────────────────────────────
  d('operator_add', 'Operators', 'reporter', '{NUM1} + {NUM2}', { NUM1: 0, NUM2: 0 }),
  d('operator_subtract', 'Operators', 'reporter', '{NUM1} − {NUM2}', { NUM1: 0, NUM2: 0 }),
  d('operator_multiply', 'Operators', 'reporter', '{NUM1} × {NUM2}', { NUM1: 0, NUM2: 0 }),
  d('operator_divide', 'Operators', 'reporter', '{NUM1} ÷ {NUM2}', { NUM1: 0, NUM2: 0 }),
  d('operator_random', 'Operators', 'reporter', 'pick random {FROM} to {TO}', { FROM: 1, TO: 10 }),
  d('operator_gt', 'Operators', 'boolean', '{OPERAND1} > {OPERAND2}', { OPERAND1: 0, OPERAND2: 0 }),
  d('operator_lt', 'Operators', 'boolean', '{OPERAND1} < {OPERAND2}', { OPERAND1: 0, OPERAND2: 0 }),
  d('operator_equals', 'Operators', 'boolean', '{OPERAND1} = {OPERAND2}', { OPERAND1: 0, OPERAND2: 0 }),
  d('operator_and', 'Operators', 'boolean', '{OPERAND1} and {OPERAND2}', { OPERAND1: 'true', OPERAND2: 'true' }),
  d('operator_or', 'Operators', 'boolean', '{OPERAND1} or {OPERAND2}', { OPERAND1: 'false', OPERAND2: 'false' }),
  d('operator_not', 'Operators', 'boolean', 'not {OPERAND}', { OPERAND: 'false' }),
  d('operator_join', 'Operators', 'reporter', 'join {STRING1} {STRING2}', { STRING1: 'hello ', STRING2: 'world' }),
  d('operator_letter_of', 'Operators', 'reporter', 'letter {LETTER} of {STRING}', { LETTER: 1, STRING: 'world' }),
  d('operator_length', 'Operators', 'reporter', 'length of {STRING}', { STRING: 'world' }),
  d('operator_contains', 'Operators', 'boolean', '{STRING1} contains {STRING2} ?', { STRING1: 'hello', STRING2: 'el' }),
  d('operator_mod', 'Operators', 'reporter', '{NUM1} mod {NUM2}', { NUM1: 0, NUM2: 0 }),
  d('operator_round', 'Operators', 'reporter', 'round {NUM}', { NUM: 0 }),
  d('operator_mathop', 'Operators', 'reporter', '{OPERATOR} of {NUM}', { OPERATOR: 'abs', NUM: 0 }),

  // ── Variables ───────────────────────────────────────
  d('data_variable', 'Variables', 'reporter', '{VARIABLE}', { VARIABLE: 'score' }),
  d('data_setvariableto', 'Variables', 'stack', 'set {VARIABLE} to {VALUE}', { VARIABLE: 'score', VALUE: 0 }),
  d('data_changevariableby', 'Variables', 'stack', 'change {VARIABLE} by {VALUE}', { VARIABLE: 'score', VALUE: 1 }),
  d('data_showvariable', 'Variables', 'stack', 'show variable {VARIABLE}', { VARIABLE: 'score' }),
  d('data_hidevariable', 'Variables', 'stack', 'hide variable {VARIABLE}', { VARIABLE: 'score' }),

  // ── Lists ───────────────────────────────────────────
  d('data_addtolist', 'Lists', 'stack', 'add {ITEM} to {LIST}', { ITEM: 'thing', LIST: 'list' }),
  d('data_deleteoflist', 'Lists', 'stack', 'delete {INDEX} of {LIST}', { INDEX: 1, LIST: 'list' }),
  d('data_deletealloflist', 'Lists', 'stack', 'delete all of {LIST}', { LIST: 'list' }),
  d('data_insertatlist', 'Lists', 'stack', 'insert {ITEM} at {INDEX} of {LIST}', { ITEM: 'thing', INDEX: 1, LIST: 'list' }),
  d('data_replaceitemoflist', 'Lists', 'stack', 'replace item {INDEX} of {LIST} with {ITEM}', { INDEX: 1, LIST: 'list', ITEM: 'thing' }),
  d('data_itemoflist', 'Lists', 'reporter', 'item {INDEX} of {LIST}', { INDEX: 1, LIST: 'list' }),
  d('data_lengthoflist', 'Lists', 'reporter', 'length of {LIST}', { LIST: 'list' }),
  d('data_listcontainsitem', 'Lists', 'boolean', '{LIST} contains {ITEM} ?', { LIST: 'list', ITEM: 'thing' }),

  // ── Pen ─────────────────────────────────────────────
  d('pen_clear', 'Pen', 'stack', 'erase all'),
  d('pen_stamp', 'Pen', 'stack', 'stamp'),
  d('pen_pendown', 'Pen', 'stack', 'pen down'),
  d('pen_penup', 'Pen', 'stack', 'pen up'),
  d('pen_setpencolorto', 'Pen', 'stack', 'set pen color to {COLOR}', { COLOR: '#00D2FF' }),
  d('pen_setpensizeto', 'Pen', 'stack', 'set pen size to {SIZE}', { SIZE: 1 }),

  // ── AI ──────────────────────────────────────────────
  d('ai_ask', 'AI', 'stack', 'ask AI {PROMPT} → {VARIABLE}', { PROMPT: 'Write a joke', VARIABLE: 'answer' }),
  d('ai_complete', 'AI', 'stack', 'AI complete {PROMPT} into {VARIABLE}', { PROMPT: 'once upon a time', VARIABLE: 'story' }),
  d('ai_classify_text', 'AI', 'stack', 'classify text {TEXT} labels {LABELS} → {VARIABLE}', {
    TEXT: 'I love this!',
    LABELS: 'positive,negative,neutral',
    VARIABLE: 'sentiment',
  }),
  d('ai_build_script', 'AI', 'stack', 'AI build script: {PROMPT}', { PROMPT: 'make the sprite spin forever' }),
  d('ai_summarize', 'AI', 'stack', 'summarize {TEXT} → {VARIABLE}', { TEXT: 'long text here', VARIABLE: 'summary' }),

  // ── ML / Computer Vision ────────────────────────────
  d('ml_classify_image', 'ML', 'stack', 'classify stage image → {VARIABLE}', { VARIABLE: 'label' }),
  d('ml_describe_scene', 'ML', 'stack', 'describe stage with AI → {VARIABLE}', { VARIABLE: 'description' }),
  d('ml_detect_objects', 'ML', 'stack', 'detect objects on stage → {LIST}', { LIST: 'objects' }),
  d('ml_webcam_label', 'ML', 'stack', 'webcam label → {VARIABLE}', { VARIABLE: 'vision' }),
  d('ml_similarity', 'ML', 'stack', 'text similarity {A} vs {B} → {VARIABLE}', {
    A: 'cat',
    B: 'kitten',
    VARIABLE: 'score',
  }),
  d('ml_predict_number', 'ML', 'stack', 'predict number from {FEATURES} → {VARIABLE}', {
    FEATURES: '1,2,3',
    VARIABLE: 'prediction',
  }),
];

export function getDef(opcode: string): BlockDef | undefined {
  return BLOCK_DEFS.find((b) => b.opcode === opcode);
}

export function blocksForCategory(category: CategoryId): BlockDef[] {
  return BLOCK_DEFS.filter((b) => b.category === category);
}

export function formatLabel(def: BlockDef, fields: Record<string, string | number>): string {
  let s = def.label;
  for (const [k, v] of Object.entries({ ...def.fields, ...fields })) {
    s = s.replace(`{${k}}`, String(v));
  }
  return s;
}

export const ALL_CATEGORIES: CategoryId[] = [
  'Motion',
  'Looks',
  'Sound',
  'Events',
  'Control',
  'Sensing',
  'Operators',
  'Variables',
  'Lists',
  'Pen',
  'AI',
  'ML',
];
