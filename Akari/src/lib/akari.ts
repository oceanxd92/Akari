export type CellType = 'EMPTY' | 'WALL';

export interface CellData {
  type: CellType;
  value: number; // -1 for no number, 0-4 for numbered walls
}

export type GridData = CellData[][];

export interface PlacementState {
  bulbs: Set<string>; // 'x,y'
  marks: Set<string>; // 'x,y' mark as empty
}

export interface PuzzleDefinition {
  width: number;
  height: number;
  grid: GridData;
}

export interface PuzzleData extends PuzzleDefinition {
  solution: Set<string>;
}

// Validation logic for current play state
export interface ValidationResult {
  isSolved: boolean;
  conflictingBulbs: Set<string>; // 'x,y' of bulbs illuminating each other
  unsatisfiedWalls: Set<string>; // 'x,y' of walls with wrong adjacent bulb count
  unlitCells: Set<string>; // 'x,y' of white cells not illuminated
  illuminatedCells: Set<string>; // 'x,y' of all illuminated cells
}

export function validatePuzzle(puzzle: PuzzleDefinition, bulbs: Set<string>): ValidationResult {
  const { width, height, grid } = puzzle;
  const conflictingBulbs = new Set<string>();
  const unsatisfiedWalls = new Set<string>();
  const unlitCells = new Set<string>();
  const illuminatedCells = new Set<string>();

  const bulbArr = Array.from(bulbs).map(s => {
    const [x, y] = s.split(',').map(Number);
    return { x, y, key: s };
  });

  // Calculate illuminated cells and find conflicts
  const litBy = new Map<string, string[]>(); // cell key -> array of bulb keys illuminating it

  for (const b of bulbArr) {
    illuminatedCells.add(b.key);
    if (!litBy.has(b.key)) litBy.set(b.key, []);
    litBy.get(b.key)!.push(b.key);

    // up
    for (let y = b.y - 1; y >= 0; y--) {
      if (grid[y][b.x].type === 'WALL') break;
      const k = `${b.x},${y}`;
      illuminatedCells.add(k);
      if (!litBy.has(k)) litBy.set(k, []);
      litBy.get(k)!.push(b.key);
    }
    // down
    for (let y = b.y + 1; y < height; y++) {
      if (grid[y][b.x].type === 'WALL') break;
      const k = `${b.x},${y}`;
      illuminatedCells.add(k);
      if (!litBy.has(k)) litBy.set(k, []);
      litBy.get(k)!.push(b.key);
    }
    // left
    for (let x = b.x - 1; x >= 0; x--) {
      if (grid[b.y][x].type === 'WALL') break;
      const k = `${x},${b.y}`;
      illuminatedCells.add(k);
      if (!litBy.has(k)) litBy.set(k, []);
      litBy.get(k)!.push(b.key);
    }
    // right
    for (let x = b.x + 1; x < width; x++) {
      if (grid[b.y][x].type === 'WALL') break;
      const k = `${x},${b.y}`;
      illuminatedCells.add(k);
      if (!litBy.has(k)) litBy.set(k, []);
      litBy.get(k)!.push(b.key);
    }
  }

  // Check conflicts (cell has more than 1 bulb illuminating it AND it's a bulb itself)
  for (const b of bulbArr) {
    const lighters = litBy.get(b.key) || [];
    if (lighters.length > 1) {
      conflictingBulbs.add(b.key);
      for (const bb of lighters) conflictingBulbs.add(bb);
    }
  }

  // Check walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].type === 'WALL') {
        const val = grid[y][x].value;
        if (val >= 0 && val <= 4) {
          let adjBulbs = 0;
          if (bulbs.has(`${x},${y-1}`)) adjBulbs++;
          if (bulbs.has(`${x},${y+1}`)) adjBulbs++;
          if (bulbs.has(`${x-1},${y}`)) adjBulbs++;
          if (bulbs.has(`${x+1},${y}`)) adjBulbs++;
          
          if (adjBulbs !== val) {
            unsatisfiedWalls.add(`${x},${y}`);
          }
        }
      } else {
        // EMPTY
        if (!illuminatedCells.has(`${x},${y}`)) {
          unlitCells.add(`${x},${y}`);
        }
      }
    }
  }

  const isSolved = conflictingBulbs.size === 0 && unsatisfiedWalls.size === 0 && unlitCells.size === 0;

  return {
    isSolved,
    conflictingBulbs,
    unsatisfiedWalls,
    unlitCells,
    illuminatedCells
  };
}
