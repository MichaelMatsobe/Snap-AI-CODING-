/** Snap! Technical Atelier — core project & block types */

export type BlockShape = 'hat' | 'stack' | 'boolean' | 'reporter' | 'c';

export type CategoryId =
  | 'Motion'
  | 'Looks'
  | 'Sound'
  | 'Events'
  | 'Control'
  | 'Sensing'
  | 'Operators'
  | 'Variables';

export interface BlockDef {
  opcode: string;
  category: CategoryId;
  shape: BlockShape;
  label: string;
  /** Field slots: name -> default string/number */
  fields?: Record<string, string | number>;
  /** Color class for UI */
  color: string;
  textColor?: string;
}

/** Instance of a block in a script */
export interface BlockInstance {
  id: string;
  opcode: string;
  fields: Record<string, string | number>;
  /** Next block in linear stack */
  nextId: string | null;
  /** Nested branch (e.g. forever / if body) */
  branchId: string | null;
  /** Else branch for if-else */
  branch2Id: string | null;
  /** Canvas position for top-of-stack only */
  x?: number;
  y?: number;
}

export interface SpriteState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: number; // degrees, Scratch-style (90 = right)
  size: number; // percent
  visible: boolean;
  costumeUrl: string;
  /** All blocks belonging to this sprite */
  blocks: Record<string, BlockInstance>;
  /** Top-level script root ids (hat blocks or orphan stacks) */
  scriptRoots: string[];
}

export interface ProjectVariables {
  [name: string]: number | string;
}

export interface Project {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  stageWidth: number;
  stageHeight: number;
  variables: ProjectVariables;
  sprites: SpriteState[];
  activeSpriteId: string;
}

export type VmStatus = 'idle' | 'running' | 'paused';

export interface VmSnapshot {
  status: VmStatus;
  variables: ProjectVariables;
  sprites: Array<{
    id: string;
    x: number;
    y: number;
    direction: number;
    size: number;
    visible: boolean;
  }>;
  message?: string;
}
