import { CellData, GridData, PuzzleData } from './akari';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// Optimized State for DFS backtracking solver
class AkariSolverState {
  size: number;
  board: number[]; // 0: empty, 1: wall, 2..6: numbered wall 0..4, 7: bulb, 8: marked empty
  litCount: number[]; // how many bulbs illuminate this cell
  wallBulbs: number[]; // how many bulbs currently adjacent to each numbered wall
  numberedWalls: { index: number; value: number }[];
  whiteCells: Set<number>;
  unlitCount: number;

  constructor(size: number, grid: GridData) {
    this.size = size;
    const len = size * size;
    this.board = new Array(len).fill(0);
    this.litCount = new Array(len).fill(0);
    this.wallBulbs = new Array(len).fill(0);
    this.numberedWalls = [];
    this.whiteCells = new Set();
    this.unlitCount = 0;

    if (grid.length < size) return;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const cell = grid[y][x];
        if (cell.type === 'WALL') {
          if (cell.value === -1) {
             this.board[i] = 1;
          } else {
             this.board[i] = 2 + cell.value;
             this.numberedWalls.push({ index: i, value: cell.value });
          }
        } else {
          this.whiteCells.add(i);
          this.unlitCount++;
        }
      }
    }
  }

  clone(): AkariSolverState {
    const c = new AkariSolverState(this.size, [[]]); // bypass slow init
    c.board = this.board.slice();
    c.litCount = this.litCount.slice();
    c.wallBulbs = this.wallBulbs.slice();
    c.numberedWalls = this.numberedWalls.slice();
    c.whiteCells = new Set(this.whiteCells);
    c.unlitCount = this.unlitCount;
    return c;
  }

  getEmptyAdj(index: number): number[] {
    const x = index % this.size;
    const y = Math.floor(index / this.size);
    const res = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
        const ni = ny * this.size + nx;
        if (this.board[ni] === 0) res.push(ni);
      }
    }
    return res;
  }

  getPossibleIlluminators(index: number): number[] {
    // Returns indices of unlit empty cells that can illuminate `index`
    const x = index % this.size;
    const y = Math.floor(index / this.size);
    // If index itself can be a bulb
    const res = [];
    if (this.board[index] === 0 && this.litCount[index] === 0) {
      res.push(index);
    }

    for (const [dx, dy] of DIRS) {
      let nx = x + dx; let ny = y + dy;
      while (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
        const ni = ny * this.size + nx;
        const v = this.board[ni];
        if (v > 0 && v <= 6) break; // wall
        if (v === 0 && this.litCount[ni] === 0) {
          res.push(ni);
        }
        nx += dx; ny += dy;
      }
    }
    return res;
  }

  placeBulb(index: number): boolean {
    if (this.board[index] !== 0 || this.litCount[index] > 0) return false;
    this.board[index] = 7;
    
    // update lit count
    if (this.litCount[index] === 0) this.unlitCount--;
    this.litCount[index]++;

    const x = index % this.size;
    const y = Math.floor(index / this.size);

    for (const [dx, dy] of DIRS) {
      let nx = x + dx; let ny = y + dy;
      let step=0;
      while (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
        step++;
        const ni = ny * this.size + nx;
        const v = this.board[ni];
        if (v > 0 && v <= 6) {
          // adj wall
          if (step === 1 && v >= 2) {
             this.wallBulbs[ni]++;
             if (this.wallBulbs[ni] > this.board[ni] - 2) return false; // exceeded
          }
          break; // block light
        }
        if (this.litCount[ni] === 0 && (v === 0 || v === 8)) this.unlitCount--;
        this.litCount[ni]++;
        nx += dx; ny += dy;
      }
    }
    return true;
  }

  markEmpty(index: number) {
    if (this.board[index] === 0) {
      this.board[index] = 8;
    }
  }

  allWallsSatisfied(): boolean {
    for (const w of this.numberedWalls) {
      if (this.wallBulbs[w.index] !== w.value) return false;
    }
    return true;
  }
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  if (k === arr.length) return [arr.slice()];
  const head = arr[0];
  const tail = arr.slice(1);
  const include = getCombinations(tail, k - 1).map(c => [head, ...c]);
  const exclude = getCombinations(tail, k);
  return [...include, ...exclude];
}

class AkariSolver {
  solutions: number[][] = [];
  maxSolutions = 2;

  solve(state: AkariSolverState): number {
    let changed = true;
    while (changed) {
      changed = false;
      // 1. Walls
      for (const w of state.numberedWalls) {
        const required = w.value - state.wallBulbs[w.index];
        const emptyAdj = state.getEmptyAdj(w.index);
        if (required < 0 || required > emptyAdj.length) return 0;
        if (required === 0 && emptyAdj.length > 0) {
          for (const a of emptyAdj) state.markEmpty(a);
          changed = true;
        } else if (required === emptyAdj.length && required > 0) {
          for (const a of emptyAdj) {
            if (!state.placeBulb(a)) return 0;
          }
          changed = true;
        }
      }
      // 2. Unlit cells 
      // Only check cells that are completely empty
      for (const i of state.whiteCells) {
        if (state.litCount[i] === 0) {
          const possible = state.getPossibleIlluminators(i);
          if (possible.length === 0) return 0;
          if (possible.length === 1 && state.board[possible[0]] === 0) {
            if (!state.placeBulb(possible[0])) return 0;
            changed = true;
          }
        }
      }
    }

    if (state.unlitCount === 0 && state.allWallsSatisfied()) {
      this.solutions.push(state.board.slice());
      return 1;
    }

    let minOpts = 999;
    let bestBranch = null as any;

    for (const w of state.numberedWalls) {
      if (state.wallBulbs[w.index] < w.value) {
        const req = w.value - state.wallBulbs[w.index];
        const emptyAdj = state.getEmptyAdj(w.index);
        const opts = getCombinations(emptyAdj, req).length;
        if (opts < minOpts) {
          minOpts = opts;
          bestBranch = { type: 'wall', index: w.index, req, emptyAdj };
        }
      }
    }

    for (const i of state.whiteCells) {
       if (state.litCount[i] === 0) {
         const possible = state.getPossibleIlluminators(i);
         if (possible.length < minOpts) {
            minOpts = possible.length;
            bestBranch = { type: 'cell', possible };
         }
       }
    }

    if (!bestBranch) return 0;

    let sols = 0;
    if (bestBranch.type === 'wall') {
      const combs = getCombinations(bestBranch.emptyAdj, bestBranch.req);
      for (const c of combs) {
         const nextState = state.clone();
         let ok = true;
         for (const a of bestBranch.emptyAdj) {
            if (c.includes(a)) {
              if (!nextState.placeBulb(a)) { ok = false; break; }
            } else {
              nextState.markEmpty(a);
            }
         }
         if (ok) sols += this.solve(nextState);
         if (this.solutions.length >= this.maxSolutions) return sols;
      }
    } else {
      for (const p of bestBranch.possible) {
         const nextState = state.clone();
         if (nextState.placeBulb(p)) {
            sols += this.solve(nextState);
            if (this.solutions.length >= this.maxSolutions) return sols;
         }
      }
    }
    return sols;
  }
}

// ------------------------------------------

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function countAdjBulbs(board: number[], index: number, size: number) {
   let c = 0;
   const x = index % size;
   const y = Math.floor(index / size);
   for (const [dx, dy] of DIRS) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
         if (board[ny * size + nx] === 7) c++;
      }
   }
   return c;
}

export function generatePuzzle(size: number, difficulty: 'Normal' | 'Medium' | 'Hard'): PuzzleData | null {
  const maxAttempts = 100;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid: GridData = Array(size).fill(null).map(() => Array(size).fill(null).map(() => ({ type: 'EMPTY', value: -1 })));
    
    // 1. Place Walls (rotational symmetry)
    const density = 0.20 + Math.random() * 0.10;
    for (let y = 0; y <= size / 2; y++) {
      for (let x = 0; x <= size / 2; x++) {
        if (Math.random() < density) {
          const x2 = size - 1 - x;
          const y2 = size - 1 - y;
          grid[y][x].type = 'WALL';
          grid[y][x2].type = 'WALL';
          grid[y2][x].type = 'WALL';
          grid[y2][x2].type = 'WALL';
          // Prevent 2x2 blocks (simplistic check)
          if (x>0 && y>0 && grid[y-1][x].type === 'WALL' && grid[y][x-1].type === 'WALL' && grid[y-1][x-1].type === 'WALL') {
             grid[y][x].type = 'EMPTY';
             grid[y2][x2].type = 'EMPTY';
          }
        }
      }
    }

    // Ensure puzzle has no isolated 1-cell gaps that are impossible
    // For now we'll just let the solver reject unsolvables.

    // 2. Find a valid full board placement (No numbered walls yet)
    let solver = new AkariSolver();
    let state = new AkariSolverState(size, grid);
    solver.maxSolutions = 1; // we just need 1 valid configuration
    
    // Adding randomness to the solver branching to get different puzzles
    // We can't easily alter the DFS deterministic order without rewriting it, 
    // but the wall placement is random enough.
    const res = solver.solve(state);
    if (res === 0) continue; // Unsolvable layout

    const solvedBoard = solver.solutions[0];
    const solutionSet = new Set<string>();
    
    // 3. Mark all walls with their adjacent bulb count
    const cluedGrid: GridData = Array(size).fill(null).map((_, y) => Array(size).fill(null).map((_, x) => ({ ...grid[y][x] })));
    const allWalls: {x: number, y:number}[] = [];

    for (let i = 0; i < size * size; i++) {
       if (solvedBoard[i] === 7) {
          solutionSet.add(`${i % size},${Math.floor(i / size)}`);
       } else if (solvedBoard[i] >= 1 && solvedBoard[i] <= 6) {
          const x = i % size;
          const y = Math.floor(i / size);
          cluedGrid[y][x].value = countAdjBulbs(solvedBoard, i, size);
          allWalls.push({x, y});
       }
    }

    // 4. Verify unique solution with all clues present
    let checkSolver = new AkariSolver();
    checkSolver.maxSolutions = 2;
    if (checkSolver.solve(new AkariSolverState(size, cluedGrid)) !== 1) {
       continue; // Layout is structurally ambiguous even with all clues
    }

    // 5. Shrink clues
    // Shuffle walls to remove clues randomly
    shuffle(allWalls);

    // Target clue percentage of all cells: Hard ~5%, Medium ~10%, Normal ~15%
    const totalCells = size * size;
    const targetDensity = difficulty === 'Hard' ? 0.04 : difficulty === 'Medium' ? 0.10 : 0.16;
    const targetClues = Math.max(1, Math.floor(totalCells * targetDensity));
    
    let currentClues = allWalls.length;

    for (const w of allWalls) {
        if (difficulty !== 'Hard' && currentClues <= targetClues) break;
        
        const savedVal = cluedGrid[w.y][w.x].value;
        cluedGrid[w.y][w.x].value = -1;
        
        let s = new AkariSolver();
        s.maxSolutions = 2;
        const count = s.solve(new AkariSolverState(size, cluedGrid));
        
        if (count !== 1) {
           cluedGrid[w.y][w.x].value = savedVal; // must keep this clue
        } else {
           currentClues--;
        }
    }

    // 6. Final verification just in case
    let finalS = new AkariSolver();
    finalS.maxSolutions = 2;
    if (finalS.solve(new AkariSolverState(size, cluedGrid)) === 1) {
       return {
          width: size,
          height: size,
          grid: cluedGrid,
          solution: solutionSet
       };
    }
  }
  return null; // Should rarely happen, UI can retry
}
