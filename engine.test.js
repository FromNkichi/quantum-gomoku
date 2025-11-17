import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyBoard,
  placeStone,
  hasFiveInRow,
  collapseBoard,
} from "./engine.js";

const SIZE = 7;

const makeBoard = () => createEmptyBoard(SIZE);

function mockRng(sequence) {
  let index = 0;
  return () => {
    const value = sequence[index % sequence.length];
    index += 1;
    return value;
  };
}

test("createEmptyBoard produces a square grid filled with null", () => {
  const board = createEmptyBoard(6);
  assert.equal(board.length, 36);
  assert.ok(board.every((cell) => cell === null));
});

test("placeStone inserts a probabilistic stone without mutating the original", () => {
  const board = makeBoard();
  const updated = placeStone(board, 10, "black", 0.9);
  assert.equal(board[10], null);
  assert.deepEqual(updated[10], { player: "black", probability: 0.9 });
});

test("hasFiveInRow detects consecutive stones", () => {
  const cells = Array(SIZE * SIZE).fill(null);
  for (let i = 0; i < 5; i += 1) {
    cells[2 * SIZE + i] = "black";
  }
  assert.ok(hasFiveInRow(cells, SIZE, "black"));
  assert.ok(!hasFiveInRow(cells, SIZE, "white"));
});

test("collapseBoard resolves stones and announces the winner", () => {
  let board = makeBoard();
  const startRow = 3;
  for (let i = 0; i < 5; i += 1) {
    board = placeStone(board, startRow * SIZE + i, "black", 0.9);
  }
  board = placeStone(board, 0, "white", 0.1);
  const rng = mockRng([0.5, 0.02, 0.01, 0.04, 0.03, 0.02]);
  const { collapsed, winner } = collapseBoard(board, SIZE, rng);
  assert.equal(winner, "black");
  const row = collapsed.slice(startRow * SIZE, startRow * SIZE + 5);
  assert.deepEqual(row, Array(5).fill("black"));
});
