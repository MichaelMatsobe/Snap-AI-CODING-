/**
 * VM uses src/engine/eval.ts for nested reporters.
 * Vision uses src/engine/vision.ts (TensorFlow.js COCO-SSD).
 * SB3 import uses src/engine/sb3Import.ts.
 *
 * This file documents integration points; runtime hooks live in App + vm helpers.
 */
export const FEATURES_V13 = [
  'nested-reporter-sockets',
  'tensorflow-coco-ssd-webcam',
  'sb3-import',
] as const;
