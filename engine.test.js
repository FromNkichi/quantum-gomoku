import test from "node:test";
import assert from "node:assert/strict";
import { createSolvedBoard, moveTile, shuffleBoard, isSolved } from "./engine.js";

const SIZE = 4;

function countZero(board) {
  return board.reduce((total, value) => (value === 0 ? total + 1 : total), 0);
}

test("createSolvedBoard builds a canonical puzzle", () => {
  const board = createSolvedBoard(SIZE);
  assert.equal(board.length, SIZE * SIZE);
  assert.equal(board[0], 1);
  assert.equal(board[SIZE * SIZE - 2], SIZE * SIZE - 1);
  assert.equal(board.at(-1), 0);
  assert.equal(countZero(board), 1);
});

test("moveTile swaps adjacent tiles but leaves other tiles untouched", () => {
  const board = createSolvedBoard(SIZE);
  const moved = moveTile(board, SIZE * SIZE - 2, SIZE); // swap last number with empty
  assert.equal(moved.at(-1), SIZE * SIZE - 1);
  assert.equal(moved.at(-2), 0);
  const untouched = moveTile(board, 0, SIZE);
  assert.deepEqual(untouched, board);
});

test("shuffleBoard keeps the puzzle valid and produces different arrangements", () => {
  const solved = createSolvedBoard(SIZE);
  const shuffled = shuffleBoard(solved, { size: SIZE, shuffleMoves: 40 });
  assert.equal(shuffled.length, solved.length);
  assert.equal(countZero(shuffled), 1);
  assert.notDeepEqual(shuffled, solved);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), [...solved].sort((a, b) => a - b));
});

test("isSolved detects the win condition", () => {
  const board = createSolvedBoard(SIZE);
  assert.ok(isSolved(board));
  const shuffled = shuffleBoard(board, { size: SIZE, shuffleMoves: 5 });
  assert.ok(!isSolved(shuffled));
});
