/** Snap! Technical Atelier — core project & block types */

export type BlockShape = 'hat' | 'stack' | 'boolean' | 'reporter' | 'c' | 'cap';

export type CategoryId =
  | 'Motion'
  | 'Looks'
  | 'Sound'
  | 'Events'
  | 'Control'
  | 'Sensing'
  | 'Operators'
  | 'Variables'
  | 'Lists'
  | 'Pen'
  | 'AI'
  | 'ML';

export interface BlockDef {
  opcode: string;
  category: CategoryId;
  shape: BlockShape;
  label: string;
  fields?: Record<string, string | number>;
  color: string;
  textColor?: string;
}

export interface BlockInstance {
  id: string;
  opcode: string;
  fields: Record<string, string | number>;
  nextId: string | null;
  branchId: string | null;
  branch2Id: string | null;
  x?: number;
  y?: number;
}

export interface Costume {
  id: string;
  name: string;
  /** data URL or remote URL */
  url: string;
  /** optional pixel bitmap for editor (base64 png) */
  bitmap?: string;
  width: number;
  height: number;
}

export interface SpriteState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: number;
  size: number;
  visible: boolean;
  costumeUrl: string;
  costumes: Costume[];
  costumeIndex: number;
  /** ghost 0–100 */
  ghost: number;
  rotationStyle: 'all around' | 'left-right' | "don't rotate";
  blocks: Record<string, BlockInstance>;
  scriptRoots: string[];
  /** clone metadata */
  isClone?: boolean;
  cloneOf?: string;
  /** local vars for clones */
  localVars?: Record<string, number | string>;
}

export interface ProjectVariables {
  [name: string]: number | string;
}

export interface ProjectLists {
  [name: string]: Array<string | number>;
}

export interface Project {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  stageWidth: number;
  stageHeight: number;
  variables: ProjectVariables;
  lists: ProjectLists;
  sprites: SpriteState[];
  activeSpriteId: string;
  /** pen trails as simple line segments */
  penTrails?: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; size: number }>;
}

export type VmStatus = 'idle' | 'running' | 'paused';

export interface VmSnapshot {
  status: VmStatus;
  variables: ProjectVariables;
  lists?: ProjectLists;
  sprites: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    direction: number;
    size: number;
    visible: boolean;
    costumeUrl: string;
    ghost: number;
    isClone?: boolean;
  }>;
  message?: string;
  penTrails?: Project['penTrails'];
  answer?: string;
}

/** AI-generated script payload */
export interface AiScriptBlock {
  opcode: string;
  fields?: Record<string, string | number>;
  /** index of next block in array, or null */
  next?: number | null;
  /** index of branch body */
  branch?: number | null;
  branch2?: number | null;
}

export interface AiScriptPayload {
  blocks: AiScriptBlock[];
  rootIndex?: number;
}
