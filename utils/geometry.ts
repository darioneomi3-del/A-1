import { Point, Vertex, SubdivisionRules, GRID_MARGIN, SVG_WIDTH, SVG_HEIGHT, Cell } from '../types';

export function parseSubdivisionRules(rulesString: string, baseCols: number, baseRows: number): SubdivisionRules {
  const rules: SubdivisionRules = { cols: {}, rows: {} };
  if (!rulesString) return rules;

  const parts = rulesString.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);

  parts.forEach(part => {
    // Improved regex to allow optional whitespace between components
    // Matches "C 1 : 4", "C1:4", "R 3:2" etc.
    const match = part.match(/^([CR])\s*(\d+)\s*:\s*(\d+)$/);
    if (!match) return;

    const type = match[1]; // C or R
    const index = parseInt(match[2]);
    const mult = parseInt(match[3]);

    if (isNaN(index) || isNaN(mult) || mult <= 0) return;

    if (type === 'C' && index >= 0 && index < baseCols) {
      rules.cols[index] = mult;
    } else if (type === 'R' && index >= 0 && index < baseRows) {
      rules.rows[index] = mult;
    }
  });
  return rules;
}

export function generateGrid(baseCols: number, baseRows: number, rules: SubdivisionRules) {
  // Safeguard against invalid inputs (NaN or <= 0)
  const safeCols = Math.max(1, isNaN(baseCols) ? 1 : baseCols);
  const safeRows = Math.max(1, isNaN(baseRows) ? 1 : baseRows);

  const gridAreaX = SVG_WIDTH - 2 * GRID_MARGIN;
  const gridAreaY = SVG_HEIGHT - 2 * GRID_MARGIN;
  
  // Calculate Column Widths
  const colWidths: number[] = [];
  let totalXPoints = 0;
  
  for (let c = 0; c < safeCols; c++) {
    const multiplier = rules.cols[c] || 1;
    const baseStep = gridAreaX / safeCols;
    for (let i = 0; i < multiplier; i++) {
      colWidths.push(baseStep / multiplier);
    }
    totalXPoints += multiplier;
  }
  totalXPoints += 1; // Fencepost

  // Calculate Row Heights
  const rowHeights: number[] = [];
  let totalYPoints = 0;
  
  for (let r = 0; r < safeRows; r++) {
    const multiplier = rules.rows[r] || 1;
    const baseStep = gridAreaY / safeRows;
    for (let i = 0; i < multiplier; i++) {
      rowHeights.push(baseStep / multiplier);
    }
    totalYPoints += multiplier;
  }
  totalYPoints += 1;

  // Generate Vertices
  const vertices: Vertex[] = [];
  let vertexId = 0;
  let currentY = GRID_MARGIN;

  for (let r = 0; r < totalYPoints; r++) {
    let currentX = GRID_MARGIN;
    let y = currentY;
    if (r > 0) y = currentY + rowHeights[r - 1];

    for (let c = 0; c < totalXPoints; c++) {
      let x = currentX;
      if (c > 0) x = currentX + colWidths[c - 1];

      vertices.push({
        x, y, originalX: x, originalY: y, id: vertexId++
      });
      if (c < colWidths.length) currentX = x;
    }
    if (r < rowHeights.length) currentY = y;
  }

  // Generate Cells
  const cells: Cell[] = [];
  const actualRows = totalYPoints - 1;
  const actualCols = totalXPoints - 1;
  let cellId = 0;

  for (let r = 0; r < actualRows; r++) {
    for (let c = 0; c < actualCols; c++) {
      const tl = r * totalXPoints + c;
      const tr = r * totalXPoints + c + 1;
      const br = (r + 1) * totalXPoints + c + 1;
      const bl = (r + 1) * totalXPoints + c;

      cells.push({
        id: cellId++,
        v_indices: [tl, tr, br, bl],
        color: null,
        isFilled: false
      });
    }
  }

  return { vertices, cells };
}

// Ray Casting Algorithm for point in polygon
export function isPointInPolygon(point: Point, vs: Point[]): boolean {
  if (vs.length < 3) return false;
  
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;

    let intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getCellCenter(cell: Cell, vertices: Vertex[]): Point {
  const v0 = vertices[cell.v_indices[0]];
  const v1 = vertices[cell.v_indices[1]];
  const v2 = vertices[cell.v_indices[2]];
  const v3 = vertices[cell.v_indices[3]];

  return {
    x: (v0.x + v1.x + v2.x + v3.x) / 4,
    y: (v0.y + v1.y + v2.y + v3.y) / 4
  };
}

export function getDisplacementColor(cell: Cell, vertices: Vertex[], scale: number): string {
  let totalDisp = 0;
  for (const vid of cell.v_indices) {
    const v = vertices[vid];
    const dx = v.x - v.originalX;
    const dy = v.y - v.originalY;
    totalDisp += Math.sqrt(dx * dx + dy * dy);
  }
  const avgDisp = totalDisp / 4;
  
  // Map displacement to 0-255 brightness.
  // Sensitivity factor to make displacement visible.
  const intensity = Math.min(255, Math.floor(avgDisp * scale * 200)); 
  const hex = intensity.toString(16).padStart(2, '0');
  
  return `#${hex}${hex}${hex}`;
}