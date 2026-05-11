import { generatePuzzle } from '../lib/generator';

self.onmessage = (e: MessageEvent) => {
  const { size, difficulty, id } = e.data;
  try {
     const puzzle = generatePuzzle(size, difficulty);
     if (puzzle) {
       // Convert Sets to arrays for postMessage
       const msg = {
          id,
          puzzle: {
             ...puzzle,
             solution: Array.from(puzzle.solution)
          }
       };
       self.postMessage(msg);
     } else {
       self.postMessage({ id, error: 'Failed to generate puzzle. Max attempts reached.' });
     }
  } catch (error) {
     self.postMessage({ id, error: String(error) });
  }
};
