export interface Point {
  x: number;
  y: number;
}

export interface Vertex extends Point {
  id: number;
  originalX: number;
  originalY: number;
}

export interface Cell {
  id: number;
  v_indices: [number, number, number, number]; // TopLeft, TopRight, BottomRight, BottomLeft
  color: string | null;
  isFilled: boolean;
}

export interface GridConfig {
  baseCols: number;
  baseRows: number;
  ruleString: string;
}

export interface SubdivisionRules {
  cols: Record<number, number>;
  rows: Record<number, number>;
}

export type EditorMode = 'UV' | 'DISPLACEMENT' | 'PEN';

export interface EditorState {
  vertices: Vertex[];
  cells: Cell[];
  boundaryPoints: Point[]; // Finalized boundary polygon
  gridConfig: GridConfig;
}

export const SVG_WIDTH = 1000;
export const SVG_HEIGHT = 2000;
export const GRID_MARGIN = 50;

export const DEFAULT_COLORS = [
  "#888888", "#b8b3b3", "#d1cbc9", "#3e3234", 
  "#554443", "#a9a2a2", "#4f4645", "#c0bdbd"
];