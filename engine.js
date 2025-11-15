const DEFAULT_SIZE = 4;

export function createSolvedBoard(size = DEFAULT_SIZE) {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error("size must be an integer greater than 1");
  }
  const total = size * size;
  return Array.from({ length: total }, (_, index) =>
    index === total - 1 ? 0 : index + 1
  );
}

function getSizeFromBoard(board) {
  const size = Math.sqrt(board.length);
  if (!Number.isInteger(size)) {
    throw new Error("Board must represent a square puzzle");
  }
  return size;
}

function getEmptyIndex(board) {
  const emptyIndex = board.indexOf(0);
  if (emptyIndex === -1) {
    throw new Error("Board does not contain an empty tile");
  }
  return emptyIndex;
}

function getAdjacentIndices(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const adjacent = [];
  if (row > 0) adjacent.push(index - size);
  if (row < size - 1) adjacent.push(index + size);
  if (col > 0) adjacent.push(index - 1);
  if (col < size - 1) adjacent.push(index + 1);
  return adjacent;
}

export function moveTile(board, tileIndex, size = getSizeFromBoard(board)) {
  const emptyIndex = getEmptyIndex(board);
  const movableTargets = getAdjacentIndices(emptyIndex, size);
  if (!movableTargets.includes(tileIndex)) {
    return board.slice();
  }
  const next = board.slice();
  [next[emptyIndex], next[tileIndex]] = [next[tileIndex], next[emptyIndex]];
  return next;
}

export function shuffleBoard(
  board,
  { size = getSizeFromBoard(board), shuffleMoves = size * size * 8 } = {}
) {
  let shuffled = board.slice();
  let previousEmpty = -1;
  for (let i = 0; i < shuffleMoves; i += 1) {
    const emptyIndex = getEmptyIndex(shuffled);
    const options = getAdjacentIndices(emptyIndex, size).filter(
      (index) => index !== previousEmpty
    );
    const target = options[Math.floor(Math.random() * options.length)];
    shuffled = moveTile(shuffled, target, size);
    previousEmpty = emptyIndex;
  }
  return shuffled;
}

export function isSolved(board) {
  const total = board.length;
  return board.every((value, index) =>
    index === total - 1 ? value === 0 : value === index + 1
  );
}
