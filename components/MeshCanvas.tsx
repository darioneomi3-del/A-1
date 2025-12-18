import React, { useRef, useState, useMemo } from 'react';
import { Vertex, Cell, Point, SVG_WIDTH, SVG_HEIGHT, EditorMode } from '../types';
import { getDisplacementColor, isPointInPolygon, getCellCenter } from '../utils/geometry';

interface MeshCanvasProps {
  vertices: Vertex[];
  cells: Cell[];
  boundaryPoints: Point[];
  mode: EditorMode;
  activeColor: string;
  displacementScale: number;
  isPenDrawing: boolean;
  drawingPoints: Point[];
  onVertexMove: (id: number, x: number, y: number, isFinished: boolean) => void;
  onBoundaryMove: (index: number, x: number, y: number, isFinished: boolean) => void;
  onCellClick: (id: number) => void;
  onCanvasClick: (x: number, y: number) => void;
  canvasRef: React.RefObject<HTMLDivElement>;
  hasBackgroundImage: boolean;
}

const MeshCanvas: React.FC<MeshCanvasProps> = ({
  vertices, cells, boundaryPoints,
  mode, activeColor, displacementScale,
  isPenDrawing, drawingPoints,
  onVertexMove, onBoundaryMove, onCellClick, onCanvasClick,
  canvasRef,
  hasBackgroundImage
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Drag State
  const [dragState, setDragState] = useState<{
    type: 'vertex' | 'boundary';
    id: number;
    startX: number;
    startY: number;
    initialItemX: number;
    initialItemY: number;
    constraint: 'x' | 'y' | null;
  } | null>(null);

  // Convert client coordinates to SVG coordinates
  // Note: getBoundingClientRect returns the SCALED size on screen.
  // We map that back to the SVG internal coordinate system (SVG_WIDTH x SVG_HEIGHT).
  const getSvgPoint = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;
    return {
      x: Math.max(0, Math.min(SVG_WIDTH, (clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(SVG_HEIGHT, (clientY - rect.top) * scaleY))
    };
  };

  const handlePointerDown = (e: React.PointerEvent, type: 'vertex' | 'boundary', id: number, currentX: number, currentY: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialItemX: currentX,
      initialItemY: currentY,
      constraint: null
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    
    let constraint = dragState.constraint;
    if (e.altKey && !constraint && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
       constraint = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
       setDragState(prev => prev ? { ...prev, constraint } : null);
    }

    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_WIDTH / rect.width;
    const scaleY = SVG_HEIGHT / rect.height;

    let svgDx = dx * scaleX;
    let svgDy = dy * scaleY;

    if (constraint === 'x') svgDy = 0;
    if (constraint === 'y') svgDx = 0;

    const newX = Math.max(0, Math.min(SVG_WIDTH, dragState.initialItemX + svgDx));
    const newY = Math.max(0, Math.min(SVG_HEIGHT, dragState.initialItemY + svgDy));

    if (dragState.type === 'vertex') {
      onVertexMove(dragState.id, newX, newY, false);
    } else {
      onBoundaryMove(dragState.id, newX, newY, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
       e.currentTarget.releasePointerCapture(e.pointerId);
       if (dragState.type === 'vertex') {
          const v = vertices.find(v => v.id === dragState.id);
          if (v) onVertexMove(dragState.id, v.x, v.y, true);
       } else {
          const p = boundaryPoints[dragState.id];
          if (p) onBoundaryMove(dragState.id, p.x, p.y, true);
       }
       setDragState(null);
    }
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    if (dragState) return;
    const { x, y } = getSvgPoint(e.clientX, e.clientY);
    onCanvasClick(x, y);
  };

  const renderedCells = useMemo(() => {
    return cells.map(cell => {
      const vs = cell.v_indices.map(id => vertices[id]);
      const pointsStr = vs.map(v => `${v.x},${v.y}`).join(' ');
      
      let fill = 'transparent';
      let stroke = '#cccccc';
      let strokeWidth = 1;

      let isVisible = true;
      if (boundaryPoints.length >= 3) {
         const center = getCellCenter(cell, vertices);
         if (!isPointInPolygon(center, boundaryPoints)) {
           isVisible = false;
         }
      }

      if (mode === 'UV') {
        if (cell.isFilled && isVisible) {
           fill = cell.color || activeColor;
        }
      } else if (mode === 'DISPLACEMENT') {
        fill = getDisplacementColor(cell, vertices, displacementScale);
        stroke = '#999999';
      }

      if (mode === 'UV' && !isVisible && cell.isFilled) {
          fill = 'transparent'; 
      }

      return (
        <polygon
          key={cell.id}
          points={pointsStr}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          className={`transition-colors duration-75 ${mode === 'UV' ? 'cursor-pointer hover:opacity-80' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (mode === 'UV' && !isPenDrawing) onCellClick(cell.id);
          }}
          pointerEvents={isPenDrawing ? 'none' : 'auto'}
        />
      );
    });
  }, [cells, vertices, mode, boundaryPoints, activeColor, displacementScale, isPenDrawing, onCellClick]);

  const boundaryPathStr = useMemo(() => {
    const points = isPenDrawing ? drawingPoints : boundaryPoints;
    if (points.length === 0) return '';
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return isPenDrawing ? d : `${d} Z`;
  }, [boundaryPoints, drawingPoints, isPenDrawing]);

  return (
    <div 
      ref={canvasRef}
      className={`w-full h-full relative select-none ${isPenDrawing ? 'cursor-crosshair' : ''}`}
    >
       <svg 
         ref={svgRef}
         viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} 
         className="w-full h-full block touch-none"
         onClick={handleSvgClick}
         onPointerMove={handlePointerMove}
         onPointerUp={handlePointerUp}
         onPointerLeave={handlePointerUp}
         preserveAspectRatio="xMidYMid meet"
       >
         <defs>
            <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
            </pattern>
         </defs>

         {/* Layer 1: Background - Only show if no background image is present */}
         {!hasBackgroundImage && (
           <g id="layer-background">
              <rect width="100%" height="100%" fill="url(#grid-bg)" />
           </g>
         )}

         {/* Layer 2: Grid Mesh */}
         <g id="grid-layer">
           {renderedCells}
         </g>

         {/* Layer 3: Overlay (Mask/Pen) */}
         <g id="layer-overlay" pointerEvents="none">
            <path 
              d={boundaryPathStr} 
              fill={isPenDrawing ? 'none' : 'rgba(34, 197, 94, 0.05)'} 
              stroke={isPenDrawing ? '#2563eb' : '#22c55e'} 
              strokeWidth="3" 
              strokeDasharray={isPenDrawing ? "0" : "5,5"}
            />
            {isPenDrawing && drawingPoints.map((p, i) => (
               <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2" />
            ))}
         </g>

         {/* Layer 4: Controls (Vertices) */}
         <g id="layer-controls">
           {!isPenDrawing && vertices.map(v => (
             <circle
               key={v.id}
               cx={v.x}
               cy={v.y}
               r={dragState?.id === v.id && dragState.type === 'vertex' ? 6 : 4}
               fill={dragState?.id === v.id && dragState.type === 'vertex' ? '#6b7280' : '#c9caca'}
               stroke="#333"
               strokeWidth="0.5"
               className="cursor-move transition-all hover:fill-gray-500"
               onPointerDown={(e) => handlePointerDown(e, 'vertex', v.id, v.x, v.y)}
             />
           ))}

           {!isPenDrawing && mode === 'UV' && boundaryPoints.map((p, i) => (
             <circle
               key={`b-${i}`}
               cx={p.x}
               cy={p.y}
               r={dragState?.id === i && dragState.type === 'boundary' ? 7 : 5}
               fill={dragState?.id === i && dragState.type === 'boundary' ? '#10b981' : '#22c55e'}
               stroke="#fff"
               strokeWidth="1.5"
               className="cursor-grab active:cursor-grabbing hover:fill-green-600 transition-all"
               onPointerDown={(e) => handlePointerDown(e, 'boundary', i, p.x, p.y)}
             />
           ))}
         </g>

       </svg>
    </div>
  );
};

export default React.memo(MeshCanvas);