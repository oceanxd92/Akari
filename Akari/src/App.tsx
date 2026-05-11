import { useEffect, useRef, useState, useCallback } from 'react';
import { Lightbulb, Circle, RotateCcw, Play, Download, Eye, EyeOff, FileImage } from 'lucide-react';
import { cn } from './lib/utils';
import { PuzzleData, validatePuzzle, ValidationResult } from './lib/akari';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';

type Difficulty = 'Normal' | 'Medium' | 'Hard';
type GridSize = 10 | 12 | 14;

export default function App() {
  const [size, setSize] = useState<GridSize>(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('Normal');
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [bulbs, setBulbs] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker/generatorWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const { id, puzzle: generated, error } = e.data;
      if (error) {
        console.error(error);
        setIsGenerating(false);
        return;
      }
      generated.solution = new Set(generated.solution);
      setPuzzle(generated);
      setBulbs(new Set());
      setMarks(new Set());
      setShowSolution(false);
      setIsGenerating(false);
      setTimer(0);
      setIsPlaying(true);
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const generateNew = useCallback(() => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIsPlaying(false);
    workerRef.current?.postMessage({ size, difficulty, id: Date.now() });
  }, [isGenerating, size, difficulty]);

  useEffect(() => {
    generateNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPlaying && !validation?.isSolved && !showSolution) {
      timerRef.current = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPlaying, validation?.isSolved, showSolution]);

  useEffect(() => {
    if (puzzle && !showSolution) {
      setValidation(validatePuzzle(puzzle, bulbs));
    }
  }, [puzzle, bulbs, showSolution]);

  const handleCellLeftClick = (x: number, y: number) => {
    if (!isPlaying || showSolution || validation?.isSolved) return;
    const key = `${x},${y}`;
    
    setMarks(prev => {
      const nm = new Set(prev);
      nm.delete(key);
      return nm;
    });

    setBulbs(prev => {
      const nb = new Set(prev);
      if (nb.has(key)) {
        nb.delete(key);
      } else {
        nb.add(key);
      }
      return nb;
    });
  };

  const handleCellRightClick = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (!isPlaying || showSolution || validation?.isSolved) return;
    const key = `${x},${y}`;

    setBulbs(prev => {
      const nb = new Set(prev);
      nb.delete(key);
      return nb;
    });

    setMarks(prev => {
      const nm = new Set(prev);
      if (nm.has(key)) {
        nm.delete(key);
      } else {
        nm.add(key);
      }
      return nm;
    });
  };

  const resetPuzzle = () => {
    setBulbs(new Set());
    setMarks(new Set());
    setShowSolution(false);
    setTimer(0);
    setIsPlaying(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const downloadImage = async (isSolutionExport: boolean) => {
    if (!gridRef.current) return;
    try {
       const wasShowingStr = showSolution;
       if (isSolutionExport !== wasShowingStr) {
           setShowSolution(isSolutionExport);
           await new Promise(r => setTimeout(r, 100));
       }
       
       const dataUrl = await toPng(gridRef.current, {
           quality: 1,
           pixelRatio: 3,
           backgroundColor: '#fafafa',
           style: {
             margin: '0', 
             padding: '2rem',
             display: 'flex',
             justifyContent: 'center',
             alignItems: 'center'
           }
       });
       
       const link = document.createElement('a');
       link.download = `akari-${difficulty.toLowerCase()}-${size}x${size}${isSolutionExport ? '-solution' : ''}.png`;
       link.href = dataUrl;
       link.click();

       if (isSolutionExport !== wasShowingStr) {
           setShowSolution(wasShowingStr);
       }
    } catch (err) {
       console.error("Error creating image", err);
    }
  };

  const displayedBulbs = showSolution ? puzzle?.solution || new Set() : bulbs;
  const simulatedValidation = puzzle ? validatePuzzle(puzzle, displayedBulbs) : null;
  const activeValidation = showSolution ? simulatedValidation : validation;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-[#F5F5F2] text-[#1A1A1A] font-sans overflow-y-auto md:overflow-hidden selection:bg-[#E5E5E0]">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-[240px] xl:w-[280px] border-b md:border-b-0 md:border-r border-[#E5E5E0] p-8 flex flex-col gap-8 shrink-0 overflow-y-auto bg-[#F5F5F2]">
        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Game</span>
          <h1 className="text-2xl font-light tracking-tighter mb-8 flex items-center gap-2">AKARI <span className="font-bold">LIGHT UP</span></h1>
          <div className="flex flex-col gap-3">
            <button
              onClick={generateNew}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 border border-[#1A1A1A] bg-[#1A1A1A] text-[#F5F5F2] text-[13px] font-medium uppercase tracking-[0.05em] transition-all duration-200 hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'New Puzzle'}
            </button>
            <button
              onClick={resetPuzzle}
              disabled={!puzzle || isGenerating}
              className="w-full px-4 py-2.5 border border-[#E5E5E0] bg-transparent text-[#1A1A1A] opacity-80 text-[13px] font-medium uppercase tracking-[0.05em] transition-all duration-200 hover:opacity-100 disabled:opacity-50"
            >
              Reset Board
            </button>
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Difficulty</span>
          <div className="flex flex-col gap-2 mt-2">
            {(['Normal', 'Medium', 'Hard'] as Difficulty[]).map(d => (
              <label key={d} className="flex items-center gap-2 text-sm cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
                <input 
                  type="radio" 
                  name="diff"
                  value={d}
                  checked={difficulty === d}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="accent-[#1A1A1A]"
                />
                {d}
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Grid Size</span>
          <select 
            value={size} 
            onChange={(e) => setSize(Number(e.target.value) as GridSize)}
            className="w-full bg-transparent border-b border-[#1A1A1A] py-2 text-sm outline-none cursor-pointer appearance-none rounded-none focus:border-opacity-50 transition-colors"
          >
            <option value={10}>10 x 10</option>
            <option value={12}>12 x 12</option>
            <option value={14}>14 x 14</option>
          </select>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main className="flex-1 flex flex-col items-center p-6 md:p-10 shrink-0 overflow-y-auto relative bg-[#F5F5F2]">
        <div className="mb-6 md:mb-8 flex justify-between w-full max-w-[560px] items-end shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Session</span>
            <div className="font-mono text-2xl tracking-[1px] font-medium">{formatTime(timer)}</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Progress</span>
            <div className="text-sm font-medium flex items-center justify-end gap-2">
              {validation?.isSolved && !showSolution && !isGenerating ? (
                <><span className="w-2 h-2 rounded-full inline-block bg-[#10B981]"></span> Logical solve verified</>
              ) : isGenerating ? (
                <><span className="w-2 h-2 rounded-full inline-block bg-[#FCD34D] animate-pulse"></span> Generating...</>
              ) : (
                <><span className="w-2 h-2 rounded-full inline-block bg-[#1A1A1A] opacity-20"></span> Solving...</>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center w-full min-h-0 shrink-0 py-4">
          <div ref={gridRef} className="shrink-0 p-4 sm:p-6 lg:p-8 bg-[#F5F5F2]">
            {puzzle ? (
               <div 
                 className="grid border-[2px] border-[#1A1A1A] bg-[#FFFFFF] select-none"
                 style={{ gridTemplateColumns: `repeat(${puzzle.width}, minmax(0, 1fr))` }}
               >
                 {puzzle.grid.map((row, y) => row.map((cell, x) => {
                   const key = `${x},${y}`;
                   const isWall = cell.type === 'WALL';
                   const isBulb = displayedBulbs.has(key);
                   const isMark = marks.has(key) && !showSolution;
                   const isIlluminated = activeValidation?.illuminatedCells.has(key);
                   const isConflicting = isBulb && activeValidation?.conflictingBulbs.has(key);
                   const isWallUnsatisfied = isWall && cell.value !== -1 && activeValidation?.unsatisfiedWalls.has(key);
                   
                   return (
                     <div
                       key={key}
                       onClick={() => !isWall && handleCellLeftClick(x, y)}
                       onContextMenu={(e) => !isWall && handleCellRightClick(e, x, y)}
                       className={cn(
                         "w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 border-[0.5px] border-[#E5E5E0] flex items-center justify-center relative font-semibold text-lg transition-colors duration-200",
                         isWall ? "bg-[#1A1A1A] text-white !border-[#1A1A1A]" : "bg-[#FFFFFF] cursor-pointer hover:bg-neutral-50",
                         !isWall && isIlluminated && !isConflicting && !isBulb && "bg-[#FFFBEB] hover:bg-[#fff2c2]",
                         !isWall && isIlluminated && isBulb && "bg-[#FFFBEB]",
                         !isWall && isConflicting && "bg-red-50",
                       )}
                     >
                       {isWall ? (
                         cell.value !== -1 && (
                            <span className={cn(
                              "font-mono text-base md:text-lg",
                              isWallUnsatisfied ? "text-red-400" : "text-white"
                            )}>
                              {cell.value}
                            </span>
                         )
                       ) : (
                         <>
                           {isBulb && (
                              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center justify-center">
                                 <span className={cn("text-[20px] md:text-[24px] leading-none", isConflicting ? "text-red-500 animate-pulse drop-shadow-none" : "text-[#FCD34D] drop-shadow-[0_0_8px_rgba(252,211,77,0.8)]")}>
                                    ●
                                 </span>
                              </motion.div>
                           )}
                           {!isBulb && isMark && (
                             <span className="text-[24px] md:text-[28px] text-[#1A1A1A] opacity-30 leading-none -mt-1">·</span>
                           )}
                         </>
                       )}
                     </div>
                   );
                 }))}
               </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 md:mt-8 text-[10px] sm:text-[11px] text-[#1A1A1A] opacity-40 uppercase tracking-[0.15em] text-center shrink-0">
          Left Click to Place Bulb • Right Click to Mark Empty
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside className="w-full md:w-[240px] xl:w-[280px] border-t md:border-t-0 md:border-l border-[#E5E5E0] p-8 flex flex-col gap-8 shrink-0 overflow-y-auto bg-[#F5F5F2]">
        <div>
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-2 block">Analysis</span>
          <div className="text-xs leading-relaxed text-[#1A1A1A] opacity-70 min-h-[4rem]">
            {isGenerating ? (
              <span className="animate-pulse">Analyzing logic constraints...</span>
            ) : puzzle ? (
              <>Puzzle configuration optimized for {difficulty.toLowerCase()} difficulty. Contains exactly one unique solution. No guessing required.</>
            ) : (
              'No puzzle loaded.'
            )}
          </div>
        </div>

        <div className="md:mt-auto flex flex-col gap-3">
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-1 block">Tools</span>
          <button
            onClick={() => setShowSolution(!showSolution)}
            disabled={!puzzle || isGenerating}
            className="w-full px-4 py-2.5 border border-[#E5E5E0] bg-transparent text-[#1A1A1A] opacity-80 text-[13px] font-medium uppercase tracking-[0.05em] transition-all duration-200 hover:opacity-100 disabled:opacity-50"
          >
            {showSolution ? 'Hide Solution' : 'Show Solution'}
          </button>
          
          <div className="h-px bg-[#E5E5E0] my-3"></div>
          
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-1 block">Export</span>
          <button
            onClick={() => downloadImage(false)}
            disabled={!puzzle || isGenerating}
            className="w-full px-4 py-2.5 border border-[#E5E5E0] bg-transparent text-[#1A1A1A] opacity-80 text-[13px] font-medium uppercase tracking-[0.05em] transition-all duration-200 hover:opacity-100 disabled:opacity-50 flex justify-between items-center group"
          >
            <span>Puzzle PNG</span>
            <span className="group-hover:translate-y-[2px] transition-transform">↓</span>
          </button>
          <button
            onClick={() => downloadImage(true)}
            disabled={!puzzle || isGenerating}
            className="w-full px-4 py-2.5 border border-[#E5E5E0] bg-transparent text-[#1A1A1A] opacity-80 text-[13px] font-medium uppercase tracking-[0.05em] transition-all duration-200 hover:opacity-100 disabled:opacity-50 flex justify-between items-center group"
          >
            <span>Solution PNG</span>
            <span className="group-hover:translate-y-[2px] transition-transform">↓</span>
          </button>
        </div>

        <div className="mt-4 md:mt-0">
          <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-[#1A1A1A] opacity-40 mb-3 block">Rules</span>
          <div className="text-[11px] leading-relaxed text-[#1A1A1A] opacity-70 flex flex-col gap-3">
            <div className="flex gap-2">
              <span className="opacity-50">01</span>
              <span>Place bulbs to illuminate the entire grid.</span>
            </div>
            <div className="flex gap-2">
              <span className="opacity-50">02</span>
              <span>Light shines in straight lines until blocked by a wall.</span>
            </div>
            <div className="flex gap-2">
              <span className="opacity-50">03</span>
              <span>Bulbs cannot shine on each other.</span>
            </div>
            <div className="flex gap-2">
              <span className="opacity-50">04</span>
              <span>Numbered walls indicate exact adjacent bulb count.</span>
            </div>
          </div>
        </div>
      </aside>

    </div>
  );
}
