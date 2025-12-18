import React from 'react';
import { EditorMode, GridConfig, DEFAULT_COLORS, SVG_WIDTH, SVG_HEIGHT, GRID_MARGIN } from '../types';

interface SidebarProps {
  mode: EditorMode;
  setMode: (m: EditorMode) => void;
  gridConfig: GridConfig;
  setGridConfig: (c: GridConfig) => void;
  onRegenerateGrid: () => void;
  onResetGridPositions: () => void;
  displacementScale: number;
  setDisplacementScale: (v: number) => void;
  activeColor: string;
  setActiveColor: (c: string) => void;
  isPenDrawing: boolean;
  onTogglePen: () => void;
  onFinishPen: () => void;
  onCancelPen: () => void;
  onClearMask: () => void;
  hasMask: boolean;
  onExport: (format: 'json' | 'png') => void;
  onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  mode, setMode,
  gridConfig, setGridConfig,
  onRegenerateGrid, onResetGridPositions,
  displacementScale, setDisplacementScale,
  activeColor, setActiveColor,
  isPenDrawing, onTogglePen, onFinishPen, onCancelPen, onClearMask, hasMask,
  onExport,
  onUploadImage
}) => {
  
  const handleConfigChange = (key: keyof GridConfig, value: string | number) => {
    const newConfig = { ...gridConfig, [key]: value };
    
    // Automatically adjust rows if columns change to keep cells approximately square
    if (key === 'baseCols') {
        const cols = typeof value === 'number' ? value : parseInt(value as string);
        if (!isNaN(cols) && cols > 0) {
            const gridRatio = (SVG_HEIGHT - 2 * GRID_MARGIN) / (SVG_WIDTH - 2 * GRID_MARGIN);
            newConfig.baseRows = Math.round(cols * gridRatio);
        }
    }
    
    setGridConfig(newConfig);
  };

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shadow-xl z-20">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">Mesh Editor</h2>
        <p className="text-sm text-gray-500 mt-1">Procedural UV & Displacement</p>
      </div>

      <div className="p-4 space-y-6 flex-1">
        
        {/* Mode Selection */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <label className="text-xs font-bold uppercase text-blue-800 mb-2 block tracking-wider">Visualization Mode</label>
          <div className="flex gap-2">
            <button 
              onClick={() => { if (!isPenDrawing) setMode('UV'); }}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${mode === 'UV' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
              disabled={isPenDrawing}
            >
              UV Paint
            </button>
            <button 
              onClick={() => { if (!isPenDrawing) setMode('DISPLACEMENT'); }}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${mode === 'DISPLACEMENT' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border'}`}
              disabled={isPenDrawing}
            >
              Displace
            </button>
          </div>
          
          {mode === 'DISPLACEMENT' && (
             <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
               <label className="text-xs font-semibold text-gray-600 flex justify-between">
                 Sensitivity <span>{displacementScale.toFixed(2)}</span>
               </label>
               <input 
                  type="range" min="0.01" max="0.3" step="0.01"
                  value={displacementScale}
                  onChange={(e) => setDisplacementScale(parseFloat(e.target.value))}
                  className="w-full mt-1 accent-blue-600 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
               />
             </div>
          )}
        </div>

        {/* Background Image */}
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
          <label className="text-xs font-bold uppercase text-orange-800 mb-2 block tracking-wider">Background</label>
          <div className="relative">
             <input 
                type="file" 
                accept="image/*"
                onChange={onUploadImage}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600"
             />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Upload an image to trace or reference.</p>
        </div>

        {/* Grid Controls */}
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <label className="text-xs font-bold uppercase text-red-800 mb-2 block tracking-wider">Grid Structure</label>
          
          <div className="flex gap-3 mb-3">
             <div className="flex-1">
               <label className="text-xs font-semibold text-gray-600 block mb-1">Cols (X)</label>
               <input 
                  type="number" min="2" max="50"
                  value={gridConfig.baseCols}
                  onChange={(e) => handleConfigChange('baseCols', parseInt(e.target.value))}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
               />
             </div>
             <div className="flex-1">
               <label className="text-xs font-semibold text-gray-600 block mb-1">Rows (Y)</label>
               <input 
                  type="number" min="2" max="100"
                  value={gridConfig.baseRows}
                  onChange={(e) => handleConfigChange('baseRows', parseInt(e.target.value))}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none"
               />
             </div>
          </div>
          
          <div className="mb-3">
             <label className="text-xs font-semibold text-gray-600 block mb-1">Rules (e.g. C1:4, R3:2)</label>
             <input 
                type="text"
                value={gridConfig.ruleString}
                onChange={(e) => handleConfigChange('ruleString', e.target.value)}
                placeholder="C[idx]:[mult], R[idx]:[mult]"
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-red-500 outline-none font-mono"
             />
             <p className="text-[10px] text-gray-500 mt-1">Index starts at 0. 'C' for Col, 'R' for Row.</p>
          </div>

          <button 
            onClick={onRegenerateGrid}
            className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium transition shadow-sm mb-2"
          >
            Regenerate Mesh
          </button>
          <button 
            onClick={onResetGridPositions}
            className="w-full py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded text-sm font-medium transition"
          >
            Reset Deformation
          </button>
        </div>

        {/* Tools */}
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
           <label className="text-xs font-bold uppercase text-purple-800 mb-2 block tracking-wider">Masking Tool</label>
           
           {!isPenDrawing ? (
             <div className="space-y-2">
                <button 
                  onClick={onTogglePen}
                  disabled={mode === 'DISPLACEMENT'}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition border ${mode === 'DISPLACEMENT' ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white hover:bg-purple-100 border-purple-200 text-purple-700'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
                  {hasMask ? 'Redraw Boundary' : 'Draw Boundary'}
                </button>
                {hasMask && (
                  <button 
                    onClick={onClearMask}
                    className="w-full py-2 text-xs text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition"
                  >
                    Clear Mask
                  </button>
                )}
             </div>
           ) : (
             <div className="flex gap-2">
                <button onClick={onFinishPen} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded text-xs font-bold shadow-sm">Finish</button>
                <button onClick={onCancelPen} className="flex-1 bg-white border border-red-200 text-red-500 hover:bg-red-50 py-2 rounded text-xs font-bold">Cancel</button>
             </div>
           )}
           {isPenDrawing && <p className="text-[10px] text-purple-700 mt-2 text-center">Click on canvas to add points.</p>}
        </div>

        {/* Palette */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
           <label className="text-xs font-bold uppercase text-gray-700 mb-2 block tracking-wider">Palette (UV)</label>
           <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setActiveColor(c)}
                  className={`w-8 h-8 rounded shadow-sm transition-transform hover:scale-110 border-2 ${activeColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select color ${c}`}
                />
              ))}
              <div 
                 className={`w-8 h-8 rounded shadow-sm overflow-hidden border-2 relative transition-transform hover:scale-110 flex items-center justify-center bg-white ${!DEFAULT_COLORS.includes(activeColor) ? 'border-gray-800 scale-110' : 'border-gray-300'}`}
                 title="Custom Color"
              >
                  {/* Colored background for the input preview */}
                  <div className="absolute inset-0" style={{ backgroundColor: activeColor }}></div>
                  
                  {/* Plus icon visible if color is default or contrasting, but usually input takes over. 
                      Let's just use the input opacity 0 trick over a div that shows current color if it's custom, 
                      or a multi-color gradient if it's not selected. 
                  */}
                  <input 
                    type="color" 
                    value={activeColor} 
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {/* Visual indicator for "Add Custom" if activeColor is one of the defaults, otherwise it shows the custom color */}
                  {DEFAULT_COLORS.includes(activeColor) && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                    </div>
                  )}
              </div>
           </div>
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 space-y-2 bg-gray-50">
         <button onClick={() => onExport('json')} className="w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded text-sm font-medium transition">Export JSON</button>
         <button onClick={() => onExport('png')} className="w-full py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded text-sm font-medium transition">Export PNG</button>
      </div>
    </div>
  );
};

export default Sidebar;