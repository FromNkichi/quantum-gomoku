export const DEFAULT_BOARD_SIZE = 11;

export function createEmptyBoard(size = DEFAULT_BOARD_SIZE) {
  if (!Number.isInteger(size) || size < 5) {
    throw new Error("Board size must be an integer of at least 5");
  }
  return Array.from({ length: size * size }, () => null);
}

export function placeStone(board, index, player, probability) {
  if (!board || !Array.isArray(board)) {
    throw new Error("Board must be an array");
  }
  if (index < 0 || index >= board.length) {
    throw new Error("Index out of bounds");
  }
  if (board[index]) {
    throw new Error("Cell is already occupied");
  }
  if (probability < 0 || probability > 1) {
    throw new Error("Probability must be between 0 and 1");
  }
  const next = board.slice();
  next[index] = { player, probability };
  return next;
}

export function hasFiveInRow(cells, size, color) {
  const directions = [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
  ];

  const getCell = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return null;
    return cells[y * size + x];
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (getCell(x, y) !== color) continue;
      for (const { dx, dy } of directions) {
        let count = 1;
        for (let step = 1; step < 5; step += 1) {
          if (getCell(x + dx * step, y + dy * step) === color) {
            count += 1;
          } else {
            break;
          }
        }
        if (count >= 5) {
          return true;
        }
      }
    }
  }
  return false;
}

export function determineWinner(cells, size) {
  const blackWin = hasFiveInRow(cells, size, "black");
  const whiteWin = hasFiveInRow(cells, size, "white");
  if (blackWin && whiteWin) return "both";
  if (blackWin) return "black";
  if (whiteWin) return "white";
  return null;
}

export function collapseBoard(board, size, rng = Math.random) {
  const collapsed = board.map((cell) => {
    if (!cell) return null;
    const chance = Math.min(Math.max(cell.probability, 0), 1);
    const roll = rng();
    const resolved = roll < chance ? "black" : "white";
    return resolved;
  });
  const winner = determineWinner(collapsed, size);
  return { collapsed, winner };
}
