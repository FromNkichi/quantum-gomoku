import {
  DEFAULT_BOARD_SIZE,
  createEmptyBoard,
  placeStone,
  collapseBoard,
} from "./engine.js";

const BOARD_SIZE = DEFAULT_BOARD_SIZE;
const STONE_CYCLES = {
  black: [0.9, 0.7],
  white: [0.1, 0.3],
};
const BOARD_PADDING_RATIO = 0.085;

const elements = {
  board: document.getElementById("board"),
  boardCanvas: document.getElementById("board-canvas"),
  statuses: document.querySelectorAll("[data-status]"),
  stoneInfos: document.querySelectorAll("[data-stone-info]"),
  decisionInfos: document.querySelectorAll("[data-decision-info]"),
  observeButtons: document.querySelectorAll('[data-action="observe"]'),
  skipButtons: document.querySelectorAll('[data-action="skip"]'),
  resetButtons: document.querySelectorAll('[data-action="reset"]'),
  backButtons: document.querySelectorAll('[data-action="back"]'),
};

const boardCtx = elements.boardCanvas?.getContext("2d");
const canvasState = {
  size: 0,
  padding: 0,
  gridStep: 0,
  dpr: window.devicePixelRatio || 1,
};
let hoverCellIndex = null;

const state = {
  board: createEmptyBoard(BOARD_SIZE),
  currentPlayer: "black",
  stoneIndex: { black: 0, white: 0 },
  awaitingDecision: false,
  gameOver: false,
  winner: null,
  observerWin: false,
  previousQuantumBoard: null,
  viewingObservation: false,
  pendingTurnSwitch: false,
};

function defaultState() {
  state.board = createEmptyBoard(BOARD_SIZE);
  state.currentPlayer = "black";
  state.stoneIndex.black = 0;
  state.stoneIndex.white = 0;
  state.awaitingDecision = false;
  state.gameOver = false;
  state.winner = null;
  state.observerWin = false;
  state.previousQuantumBoard = null;
  state.viewingObservation = false;
  state.pendingTurnSwitch = false;
  render();
}

function cloneBoard(board) {
  return board.map((cell) => {
    if (!cell) return null;
    if (typeof cell === "string") return cell;
    return { ...cell };
  });
}

function clampProbability(value) {
  return Math.min(Math.max(value, 0), 1);
}

function blendStoneColor(probability) {
  const p = clampProbability(probability);
  const white = { r: 243, g: 234, b: 204 };
  const black = { r: 26, g: 21, b: 18 };
  const mixChannel = (channel) =>
    Math.round(white[channel] * (1 - p) + black[channel] * p);
  const rgb = `rgb(${mixChannel("r")}, ${mixChannel("g")}, ${mixChannel("b")})`;
  const textColor = p > 0.65 ? "#f9f9f9" : "#1f1409";
  return { fill: rgb, text: textColor };
}

function getNextProbability(player) {
  const list = STONE_CYCLES[player];
  const index = state.stoneIndex[player] % list.length;
  return list[index];
}

function cycleStone(player) {
  state.stoneIndex[player] = (state.stoneIndex[player] + 1) % STONE_CYCLES[player].length;
}

function describePlayer(player) {
  return player === "black" ? "黒" : "白";
}

function addLog() {}

function canInteractWithBoard() {
  return !(state.gameOver || state.awaitingDecision || state.viewingObservation);
}

function getCanvasPoint(event) {
  if (!elements.boardCanvas) return null;
  const rect = elements.boardCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return { x, y };
}

function locateCellIndex(point) {
  if (!point || !canvasState.size) return null;
  const { padding, gridStep } = canvasState;
  const relativeX = point.x - padding;
  const relativeY = point.y - padding;
  const column = Math.round(relativeX / gridStep);
  const row = Math.round(relativeY / gridStep);
  if (column < 0 || column >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) {
    return null;
  }
  const targetX = padding + column * gridStep;
  const targetY = padding + row * gridStep;
  const tolerance = gridStep * 0.4;
  if (Math.abs(targetX - point.x) > tolerance || Math.abs(targetY - point.y) > tolerance) {
    return null;
  }
  return row * BOARD_SIZE + column;
}

function getCellFromEvent(event) {
  const point = getCanvasPoint(event);
  return locateCellIndex(point);
}

function setHoverCell(index) {
  if (hoverCellIndex === index) return;
  hoverCellIndex = index;
  drawBoardCanvas();
}

function handleBoardClick(event) {
  if (!canInteractWithBoard()) return;
  const idx = getCellFromEvent(event);
  if (idx === null || state.board[idx]) return;
  const probability = getNextProbability(state.currentPlayer);
  state.board = placeStone(state.board, idx, state.currentPlayer, probability);
  state.awaitingDecision = true;
  addLog(`${describePlayer(state.currentPlayer)}が${Math.round(probability * 100)}%の石を置いた。`);
  render();
}

function handleBoardPointerMove(event) {
  if (!canInteractWithBoard()) {
    setHoverCell(null);
    return;
  }
  const idx = getCellFromEvent(event);
  if (idx === null || state.board[idx]) {
    setHoverCell(null);
    return;
  }
  setHoverCell(idx);
}

function handleBoardPointerLeave() {
  setHoverCell(null);
}

function switchTurn() {
  cycleStone(state.currentPlayer);
  state.currentPlayer = state.currentPlayer === "black" ? "white" : "black";
  state.awaitingDecision = false;
}

function observeBoard() {
  if (!state.awaitingDecision || state.gameOver || state.viewingObservation) return;
  state.previousQuantumBoard = cloneBoard(state.board);
  const observer = state.currentPlayer;
  const { collapsed, winner } = collapseBoard(state.board, BOARD_SIZE);
  state.board = collapsed;
  state.awaitingDecision = false;
  let resolvedWinner = winner;
  state.observerWin = winner === "both";
  if (state.observerWin) {
    resolvedWinner = observer;
  }
  state.viewingObservation = !resolvedWinner;
  state.pendingTurnSwitch = !resolvedWinner;
  if (resolvedWinner) {
    state.previousQuantumBoard = null;
    state.gameOver = true;
    state.winner = resolvedWinner;
    if (state.observerWin) {
      addLog(
        `観測の結果、黒と白が同時に五目が揃った！観測していた${describePlayer(
          observer
        )}の勝利！`
      );
    } else {
      addLog(`観測の結果、${describePlayer(resolvedWinner)}の勝利！`);
    }
  } else {
    addLog("観測結果を盤面に描画しました。" + " 五目はまだ現れていません。もどるで続行してください。");
  }
  render();
}

function skipObservation() {
  if (!state.awaitingDecision || state.gameOver || state.viewingObservation) return;
  addLog("観測せずに次のプレイヤーへターンを渡す。");
  switchTurn();
  render();
}

function resetGame() {
  defaultState();
}

function revertBoard() {
  if (!state.viewingObservation || state.gameOver) return;
  if (state.previousQuantumBoard) {
    state.board = cloneBoard(state.previousQuantumBoard);
  }
  state.viewingObservation = false;
  state.previousQuantumBoard = null;
  if (state.pendingTurnSwitch) {
    switchTurn();
    addLog(`${describePlayer(state.currentPlayer)}の番に戻った。`);
  }
  state.pendingTurnSwitch = false;
  render();
}

function updateCanvasMetrics() {
  if (!elements.boardCanvas) return;
  const rect = elements.boardCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const size = Math.min(rect.width, rect.height);
  const dpr = window.devicePixelRatio || 1;
  elements.boardCanvas.width = size * dpr;
  elements.boardCanvas.height = size * dpr;
  canvasState.size = size;
  canvasState.dpr = dpr;
  canvasState.padding = size * BOARD_PADDING_RATIO;
  canvasState.gridStep = (size - canvasState.padding * 2) / (BOARD_SIZE - 1);
}

function getStoneRadius() {
  if (!canvasState.gridStep) return 0;
  return Math.min(canvasState.gridStep * 0.36, canvasState.size * 0.045);
}

function getCellCenter(index) {
  const column = index % BOARD_SIZE;
  const row = Math.floor(index / BOARD_SIZE);
  const x = canvasState.padding + column * canvasState.gridStep;
  const y = canvasState.padding + row * canvasState.gridStep;
  return { x, y };
}

function drawBoardCanvas() {
  if (!boardCtx || !canvasState.size) return;
  const { dpr } = canvasState;
  boardCtx.save();
  boardCtx.clearRect(0, 0, elements.boardCanvas.width, elements.boardCanvas.height);
  boardCtx.scale(dpr, dpr);
  drawBoardBackground(boardCtx);
  drawGridLines(boardCtx);
  drawStarPoints(boardCtx);
  drawStones(boardCtx);
  if (
    hoverCellIndex !== null &&
    canInteractWithBoard() &&
    !state.board[hoverCellIndex]
  ) {
    drawHoverIndicator(boardCtx);
  }
  boardCtx.restore();
}

function drawBoardBackground(ctx) {
  const { size, padding } = canvasState;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#f9e5b9");
  gradient.addColorStop(1, "#cfa262");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#f8e0ac";
  ctx.fillRect(padding, padding, size - padding * 2, size - padding * 2);
}

function drawGridLines(ctx) {
  const { padding, gridStep, size } = canvasState;
  const start = padding;
  const end = size - padding;
  ctx.strokeStyle = "rgba(71, 45, 16, 0.85)";
  ctx.lineWidth = Math.max(1.25, gridStep * 0.05);
  ctx.lineCap = "round";
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const offset = start + i * gridStep;
    ctx.beginPath();
    ctx.moveTo(start, offset);
    ctx.lineTo(end, offset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset, start);
    ctx.lineTo(offset, end);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(77, 50, 13, 0.9)";
  ctx.lineWidth = Math.max(2, gridStep * 0.08);
  ctx.strokeRect(start, start, end - start, end - start);
}

function getStarPointCoordinates() {
  if (BOARD_SIZE < 7) return [];
  const margin = BOARD_SIZE >= 13 ? 3 : 2;
  const coords = [];
  const corners = [margin, BOARD_SIZE - 1 - margin];
  corners.forEach((x) => {
    corners.forEach((y) => {
      coords.push({ x, y });
    });
  });
  if (BOARD_SIZE % 2 === 1) {
    const center = Math.floor(BOARD_SIZE / 2);
    coords.push({ x: center, y: center });
  }
  return coords;
}

function drawStarPoints(ctx) {
  const { padding, gridStep } = canvasState;
  const starRadius = Math.max(2.5, gridStep * 0.08);
  ctx.fillStyle = "rgba(66, 41, 13, 0.8)";
  getStarPointCoordinates().forEach(({ x, y }) => {
    const cx = padding + x * gridStep;
    const cy = padding + y * gridStep;
    ctx.beginPath();
    ctx.arc(cx, cy, starRadius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawHoverIndicator(ctx) {
  if (hoverCellIndex === null) return;
  const { x, y } = getCellCenter(hoverCellIndex);
  const radius = getStoneRadius() * 0.95;
  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = Math.max(1, radius * 0.25);
  ctx.strokeStyle = "rgba(66, 41, 13, 0.7)";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStones(ctx) {
  const radius = getStoneRadius();
  if (!radius) return;
  state.board.forEach((cell, index) => {
    if (!cell) return;
    const center = getCellCenter(index);
    if (typeof cell === "string") {
      drawResolvedStone(ctx, center, radius, cell);
    } else {
      drawProbabilityStone(ctx, center, radius, cell);
    }
  });
}

function drawProbabilityStone(ctx, center, radius, cell) {
  const probability = clampProbability(cell.probability);
  const tone = blendStoneColor(probability);
  drawCircle(ctx, center.x, center.y, radius, tone.fill, "rgba(24, 17, 8, 0.35)");
  ctx.fillStyle = tone.text;
  ctx.font = `700 ${Math.min(radius * 0.85, 18)}px "Noto Sans JP", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(probability * 100)}`, center.x, center.y + 0.5);
}

function drawResolvedStone(ctx, center, radius, color) {
  const lightOffset = radius * 0.35;
  const gradient = ctx.createRadialGradient(
    center.x - lightOffset,
    center.y - lightOffset,
    radius * 0.1,
    center.x,
    center.y,
    radius
  );
  if (color === "black") {
    gradient.addColorStop(0, "#5b5b5b");
    gradient.addColorStop(1, "#050505");
  } else {
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, "#d5d0c1");
  }
  drawCircle(ctx, center.x, center.y, radius, gradient, "rgba(24, 17, 8, 0.4)");
  if (color === "white") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.ellipse(
      center.x - radius * 0.3,
      center.y - radius * 0.3,
      radius * 0.35,
      radius * 0.25,
      -Math.PI / 4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawCircle(ctx, x, y, radius, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.stroke();
  }
}

function initializeBoardCanvas() {
  if (!elements.boardCanvas || !boardCtx) return;
  const resize = () => {
    updateCanvasMetrics();
    drawBoardCanvas();
  };
  resize();
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(resize);
    observer.observe(elements.board);
  }
}

function render() {
  renderBoard();
  renderStatus();
}

function renderBoard() {
  elements.board.classList.toggle("observation-view", state.viewingObservation);
  if (!canInteractWithBoard()) {
    hoverCellIndex = null;
  }
  drawBoardCanvas();
}

function updateText(nodes, text) {
  nodes.forEach((node) => {
    node.textContent = text;
  });
}

function toggleButtons(buttons, disabled) {
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function renderStatus() {
  if (state.gameOver) {
    if (state.observerWin) {
      updateText(
        elements.statuses,
        `${describePlayer(state.winner)}が観測者として勝利しました。黒と白が同時に五目を達成しました。`
      );
    } else {
      updateText(
        elements.statuses,
        `${describePlayer(state.winner)}の勝利！もう一度遊ぶにはリセットしてください。`
      );
    }
    updateText(elements.stoneInfos, "ゲーム終了");
    updateText(elements.decisionInfos, "");
  } else if (state.viewingObservation) {
    updateText(elements.statuses, "観測結果を表示中です。");
    updateText(elements.stoneInfos, "石は確率に従って黒と白に確定しています。");
    updateText(elements.decisionInfos, "盤面を確認したら「もどる」で量子盤面に戻ってください。");
  } else {
    const player = describePlayer(state.currentPlayer);
    const probability = Math.round(getNextProbability(state.currentPlayer) * 100);
    updateText(elements.statuses, `${player}の番です。`);
    updateText(elements.stoneInfos, `次に置ける石: ${probability}%で黒になります。`);
    updateText(
      elements.decisionInfos,
      state.awaitingDecision
        ? "観測するか、そのままターンを渡すか選んでください。"
        : "空いているマスを選んで石を置いてください。"
    );
  }
  const observationDisabled = !state.awaitingDecision || state.gameOver || state.viewingObservation;
  toggleButtons(elements.observeButtons, observationDisabled);
  toggleButtons(elements.skipButtons, observationDisabled);
  toggleButtons(elements.backButtons, !(state.viewingObservation && !state.gameOver));
}

elements.boardCanvas.addEventListener("click", handleBoardClick);
elements.boardCanvas.addEventListener("pointermove", handleBoardPointerMove);
elements.boardCanvas.addEventListener("pointerleave", handleBoardPointerLeave);
elements.observeButtons.forEach((button) => button.addEventListener("click", observeBoard));
elements.skipButtons.forEach((button) => button.addEventListener("click", skipObservation));
elements.resetButtons.forEach((button) => button.addEventListener("click", resetGame));
elements.backButtons.forEach((button) => button.addEventListener("click", revertBoard));

initializeBoardCanvas();
defaultState();
