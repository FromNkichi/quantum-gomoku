import { createSolvedBoard, shuffleBoard, moveTile, isSolved } from "./engine.js";

const GRID_SIZE = 4;
const boardElement = document.getElementById("puzzle-board");
const startButton = document.getElementById("start-button");
const movesLabel = document.getElementById("moves");
const timerLabel = document.getElementById("timer");
const bestLabel = document.getElementById("best");
const messageElement = document.getElementById("message");

const STORAGE_KEY = "codex-puzzle-best";

const state = {
  board: createSolvedBoard(GRID_SIZE),
  running: false,
  moves: 0,
  elapsed: 0,
  timerId: null,
  best: Number(localStorage.getItem(STORAGE_KEY)) || null,
};

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function boardsAreEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function renderBoard() {
  boardElement.innerHTML = "";
  state.board.forEach((value, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = value === 0 ? "tile tile--empty" : "tile";
    tile.dataset.index = String(index);
    tile.textContent = value === 0 ? "" : String(value);
    tile.setAttribute("aria-label", value === 0 ? "空白" : `${value} のピース`);
    tile.setAttribute("role", "gridcell");
    tile.disabled = value === 0 || !state.running;
    tile.setAttribute("aria-disabled", tile.disabled ? "true" : "false");
    boardElement.appendChild(tile);
  });
}

function updateHud() {
  movesLabel.textContent = String(state.moves);
  timerLabel.textContent = formatTime(state.elapsed);
  bestLabel.textContent = state.best === null ? "―" : String(state.best);
}

function startTimer() {
  stopTimer();
  state.timerId = setInterval(() => {
    state.elapsed += 1;
    timerLabel.textContent = formatTime(state.elapsed);
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function createPuzzle() {
  let puzzle = shuffleBoard(createSolvedBoard(GRID_SIZE));
  while (isSolved(puzzle)) {
    puzzle = shuffleBoard(createSolvedBoard(GRID_SIZE));
  }
  return puzzle;
}

function startGame() {
  state.board = createPuzzle();
  state.running = true;
  state.moves = 0;
  state.elapsed = 0;
  messageElement.textContent = "空白マスの隣のピースをタップして順番に並べましょう。";
  startButton.textContent = "リセット";
  renderBoard();
  updateHud();
  startTimer();
}

function finishGame() {
  state.running = false;
  stopTimer();
  messageElement.textContent = `クリア！${state.moves} 手で ${formatTime(
    state.elapsed
  )} でした。`;
  if (state.best === null || state.moves < state.best) {
    state.best = state.moves;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }
  renderBoard();
  updateHud();
  startButton.textContent = "もう一度挑戦";
}

function handleTileClick(event) {
  if (!state.running) return;
  const target = event.target.closest(".tile");
  if (!target || target.classList.contains("tile--empty")) return;
  const index = Number(target.dataset.index);
  const nextBoard = moveTile(state.board, index, GRID_SIZE);
  if (boardsAreEqual(nextBoard, state.board)) {
    return;
  }
  state.board = nextBoard;
  state.moves += 1;
  renderBoard();
  updateHud();
  if (isSolved(state.board)) {
    finishGame();
  }
}

function init() {
  renderBoard();
  updateHud();
  messageElement.textContent = "START ボタンで 15 パズルに挑戦！";
}

startButton.addEventListener("click", startGame);
boardElement.addEventListener("click", handleTileClick);

init();
