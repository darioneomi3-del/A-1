import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import MeshCanvas from './components/MeshCanvas';
import useHistory from './hooks/useHistory';
import { EditorMode, GridConfig, EditorState, SVG_WIDTH, SVG_HEIGHT, GRID_MARGIN } from './types';
import { generateGrid, parseSubdivisionRules, isPointInPolygon, getCellCenter } from './utils/geometry';

// Initial State
// Calculate rows to maintain square aspect ratio
const gridRatio = (SVG_HEIGHT - 2 * GRID_MARGIN) / (SVG_WIDTH - 2 * GRID_MARGIN);
const initialCols = 10;
const initialRows = Math.round(initialCols * gridRatio);

const INITIAL_CONFIG: GridConfig = {
  baseCols: initialCols,
  baseRows: initialRows,
  ruleString: 'C1:4,R3:2'
};

const initialRules = parseSubdivisionRules(INITIAL_CONFIG.ruleString, INITIAL_CONFIG.baseCols, INITIAL_CONFIG.baseRows);
const initialGrid = generateGrid(INITIAL_CONFIG.baseCols, INITIAL_CONFIG.baseRows, initialRules);

const INITIAL_STATE: EditorState = {
  vertices: initialGrid.vertices,
  cells: initialGrid.cells,
  boundaryPoints: [],
  gridConfig: INITIAL_CONFIG
};

function App() {
  const { state, pushState, undo, redo, canUndo, canRedo } = useHistory<EditorState>(INITIAL_STATE);
  
  // UI State
  const [mode, setMode] = useState<EditorMode>('UV');
  const [activeColor, setActiveColor] = useState<string>('#888888');
  const [displacementScale, setDisplacementScale] = useState<number>(0.1);
  const [gridConfig, setGridConfig] = useState<GridConfig>(INITIAL_CONFIG);
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  // Pen & Canvas State
  const [isPenDrawing, setIsPenDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<{x: number, y: number}[]>([]);
  const [zoom, setZoom] = useState(1);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keyboard Shortcuts & Wheel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) redo();
        } else {
          if (canUndo) undo();
        }
      }
    };
    
    // Zoom handling
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        setZoom(prev => {
          const delta = -e.deltaY * zoomSensitivity * prev; 
          const newZoom = Math.max(0.1, Math.min(5, prev + delta));
          return newZoom;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [undo, redo, canUndo, canRedo]);

  // Actions
  const handleRegenerateGrid = () => {
    // Sanitize inputs to prevent NaN or invalid dimensions
    const safeCols = Math.max(1, isNaN(gridConfig.baseCols) ? 1 : gridConfig.baseCols);
    const safeRows = Math.max(1, isNaN(gridConfig.baseRows) ? 1 : gridConfig.baseRows);
    
    // Create sanitized config to push to state
    const safeConfig = { ...gridConfig, baseCols: safeCols, baseRows: safeRows };

    const rules = parseSubdivisionRules(safeConfig.ruleString, safeCols, safeRows);
    const { vertices, cells } = generateGrid(safeCols, safeRows, rules);
    
    pushState({
      vertices,
      cells,
      boundaryPoints: state.boundaryPoints,
      gridConfig: safeConfig
    });
  };

  const handleResetPositions = () => {
    const newVertices = state.vertices.map(v => ({
      ...v,
      x: v.originalX,
      y: v.originalY
    }));
    pushState({ ...state, vertices: newVertices });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
         setBgImage(evt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Local State Sync
  const [localVertices, setLocalVertices] = useState(state.vertices);
  const [localBoundary, setLocalBoundary] = useState(state.boundaryPoints);

  useEffect(() => {
    setLocalVertices(state.vertices);
    setLocalBoundary(state.boundaryPoints);
    setGridConfig(state.gridConfig);
  }, [state]);

  const onVertexDrag = (id: number, x: number, y: number, isFinished: boolean) => {
    const newVerts = localVertices.map(v => v.id === id ? { ...v, x, y } : v);
    setLocalVertices(newVerts);
    if (isFinished) {
      pushState({ ...state, vertices: newVerts, boundaryPoints: localBoundary });
    }
  };

  const onBoundaryDrag = (index: number, x: number, y: number, isFinished: boolean) => {
    const newBoundary = [...localBoundary];
    if (newBoundary[index]) {
      newBoundary[index] = { x, y };
      setLocalBoundary(newBoundary);
      if (isFinished) {
        pushState({ ...state, vertices: localVertices, boundaryPoints: newBoundary });
      }
    }
  };

  const handleCellClick = (id: number) => {
    const cellIndex = state.cells.findIndex(c => c.id === id);
    if (cellIndex === -1) return;

    if (state.boundaryPoints.length >= 3) {
      const cell = state.cells[cellIndex];
      const center = getCellCenter(cell, localVertices);
      if (!isPointInPolygon(center, state.boundaryPoints)) {
        alert("Cannot paint outside the mask boundary.");
        return;
      }
    }

    const newCells = [...state.cells];
    const cell = newCells[cellIndex];
    
    if (cell.isFilled && cell.color === activeColor) {
      newCells[cellIndex] = { ...cell, isFilled: false, color: null };
    } else {
      newCells[cellIndex] = { ...cell, isFilled: true, color: activeColor };
    }

    pushState({ ...state, vertices: localVertices, boundaryPoints: localBoundary, cells: newCells });
  };

  const handleTogglePen = () => {
    setIsPenDrawing(!isPenDrawing);
    if (!isPenDrawing) setDrawingPoints([]);
  };

  const handleCanvasClick = (x: number, y: number) => {
    if (isPenDrawing) {
      setDrawingPoints([...drawingPoints, { x, y }]);
    }
  };

  const handleFinishPen = () => {
    if (drawingPoints.length < 3) {
      alert("Need at least 3 points for a shape.");
      return;
    }
    setIsPenDrawing(false);
    pushState({ ...state, boundaryPoints: drawingPoints });
    setDrawingPoints([]);
  };

  const handleClearMask = () => {
    pushState({ ...state, boundaryPoints: [] });
  };

  const handleExport = (format: 'json' | 'png') => {
    if (format === 'json') {
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mesh-data.json';
      a.click();
    } else {
      const svgEl = canvasRef.current?.querySelector('svg');
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          // Export high res
          canvas.width = SVG_WIDTH * 2;
          canvas.height = SVG_HEIGHT * 2;
          ctx?.drawImage(img, 0, 0, SVG_WIDTH * 2, SVG_HEIGHT * 2);
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = 'mesh.png';
          a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-gray-800 bg-gray-50">
      
      <Sidebar 
        mode={mode} setMode={setMode}
        gridConfig={gridConfig} setGridConfig={setGridConfig}
        onRegenerateGrid={handleRegenerateGrid}
        onResetGridPositions={handleResetPositions}
        displacementScale={displacementScale} setDisplacementScale={setDisplacementScale}
        activeColor={activeColor} setActiveColor={setActiveColor}
        isPenDrawing={isPenDrawing}
        onTogglePen={handleTogglePen}
        onFinishPen={handleFinishPen}
        onCancelPen={() => { setIsPenDrawing(false); setDrawingPoints([]); }}
        onClearMask={handleClearMask}
        hasMask={state.boundaryPoints.length > 0}
        onExport={handleExport}
        onUploadImage={handleImageUpload}
      />

      <div className="flex-1 flex flex-col relative h-full overflow-hidden">
        
        {/* Top Bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
           <div>
              <h1 className="text-xl font-bold text-gray-900">Workspace</h1>
              <p className="text-xs text-gray-500">
                {mode === 'UV' ? 'Edit Mode' : 'View Mode'} 
                <span className="mx-2">|</span> 
                {Math.round(zoom * 100)}%
              </p>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex gap-2">
                 <button 
                    onClick={undo} disabled={!canUndo}
                    className="p-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-40 transition text-gray-700"
                    title="Undo (Ctrl+Z)"
                 >
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                 </button>
                 <button 
                    onClick={redo} disabled={!canRedo}
                    className="p-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-40 transition text-gray-700"
                    title="Redo (Ctrl+Shift+Z)"
                 >
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                 </button>
              </div>
           </div>
        </div>

        {/* Scrollable Canvas Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-gray-100 relative cursor-default"
          // Adding a pattern to the scroll background to differentiate it from the canvas
          style={{
             backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
             backgroundSize: '20px 20px'
          }}
        >
           <div className="min-w-full min-h-full flex items-center justify-center p-20">
              
              {/* Scalable Container */}
              <div 
                 className="relative"
                 style={{ 
                   width: SVG_WIDTH * zoom, 
                   height: SVG_HEIGHT * zoom,
                   flexShrink: 0
                 }}
              >
                  <div 
                    id="svg-container"
                    className="absolute top-0 left-0 bg-white shadow-2xl origin-top-left"
                    style={{
                      width: SVG_WIDTH,
                      height: SVG_HEIGHT,
                      transform: `scale(${zoom})`
                    }}
                  >
                     {/* Background Image Layer */}
                     {bgImage && (
                        <div id="background-image" className="absolute inset-0 z-0">
                           <img 
                             src={bgImage} 
                             alt="Reference" 
                             className="w-full h-full object-contain select-none pointer-events-none opacity-90"
                           />
                        </div>
                     )}

                     {/* Grid Layer */}
                     <div className="absolute inset-0 z-10">
                        <MeshCanvas 
                            vertices={localVertices}
                            cells={state.cells}
                            boundaryPoints={isPenDrawing ? drawingPoints : localBoundary}
                            mode={mode}
                            activeColor={activeColor}
                            displacementScale={displacementScale}
                            isPenDrawing={isPenDrawing}
                            drawingPoints={drawingPoints}
                            onVertexMove={onVertexDrag}
                            onBoundaryMove={onBoundaryDrag}
                            onCellClick={handleCellClick}
                            onCanvasClick={handleCanvasClick}
                            canvasRef={canvasRef}
                            hasBackgroundImage={!!bgImage}
                        />
                     </div>
                  </div>
              </div>
           </div>
        </div>

        {/* Zoom Floating Panel */}
        <div className="absolute bottom-6 right-6 flex flex-col bg-white rounded-lg shadow-lg border border-gray-200 p-2 gap-2 z-20">
          <button 
            onClick={() => setZoom(z => Math.min(5, z + 0.1))}
            className="p-2 hover:bg-gray-100 rounded text-gray-600"
            title="Zoom In"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          
          <div className="relative h-32 w-8 flex justify-center">
             <input 
                type="range" 
                min="0.1" max="5" step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="absolute w-32 h-8 -rotate-90 top-12 -left-12 origin-center accent-blue-600 cursor-pointer"
             />
          </div>

          <button 
            onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}
            className="p-2 hover:bg-gray-100 rounded text-gray-600"
            title="Zoom Out"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          
          <button 
            onClick={() => setZoom(1)}
            className="text-xs font-bold text-gray-500 hover:text-blue-600 py-1 border-t border-gray-100"
          >
            {Math.round(zoom * 100)}%
          </button>
        </div>

      </div>
    </div>
  );
}

export default App;