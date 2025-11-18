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
const MOBILE_BREAKPOINT = 640;
const MOBILE_BROWSER_UI_OFFSET = 120;
const MAX_OBSERVATIONS = 5;
const OBSERVATION_SIMULATION_COUNT = 400;

const elements = {
  board: document.getElementById("board"),
  boardCanvas: document.getElementById("board-canvas"),
  boardWrapper: document.querySelector(".board-wrapper"),
  playerPanels: document.querySelectorAll("[data-player-panel]"),
  playerSummaries: document.querySelectorAll("[data-player-color]"),
  playerOdds: document.querySelectorAll("[data-player-odds]"),
  observeButtons: document.querySelectorAll('[data-action="observe"]'),
  skipButtons: document.querySelectorAll('[data-action="skip"]'),
};

const OBSERVE_LABEL = "観測する";
const RETURN_LABEL = "量子盤面にもどる";

const boardCtx = elements.boardCanvas?.getContext("2d");
const mobileMediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
const canvasState = {
  size: 0,
  padding: 0,
  gridStep: 0,
  dpr: window.devicePixelRatio || 1,
};
let hoverCellIndex = null;

function getPlayerFromElement(element) {
  if (!element) return null;
  return element.closest("[data-player-panel]")?.dataset.playerPanel || null;
}

function hasObservationChance(player) {
  return state.observationsRemaining[player] > 0;
}

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
  observationsRemaining: {
    black: MAX_OBSERVATIONS,
    white: MAX_OBSERVATIONS,
  },
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
  state.observationsRemaining.black = MAX_OBSERVATIONS;
  state.observationsRemaining.white = MAX_OBSERVATIONS;
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

function getViewportHeight() {
  if (window.visualViewport && typeof window.visualViewport.height === "number") {
    return window.visualViewport.height;
  }
  return window.innerHeight;
}

function updateMobileLayout() {
  const root = document.documentElement;
  if (!root) return;
  if (!mobileMediaQuery.matches) {
    root.style.removeProperty("--mobile-board-size");
    root.style.removeProperty("--mobile-panel-height");
    return;
  }
  const viewportWidth = Math.min(
    window.innerWidth,
    document.documentElement.clientWidth || window.innerWidth,
  );
  const viewportHeight = getViewportHeight();
  const usableHeight = Math.max(viewportHeight - MOBILE_BROWSER_UI_OFFSET, 320);
  const boardSize = Math.min(viewportWidth, usableHeight);
  const remainingHeight = Math.max(usableHeight - boardSize, 0);
  const panelHeight = remainingHeight > 0 ? remainingHeight / 2 : Math.min(boardSize * 0.45, 220);
  root.style.setProperty("--mobile-board-size", `${boardSize}px`);
  root.style.setProperty("--mobile-panel-height", `${panelHeight}px`);
}

function initializeResponsiveLayout() {
  updateMobileLayout();
  window.addEventListener("resize", updateMobileLayout);
  window.addEventListener("orientationchange", updateMobileLayout);
  if (typeof mobileMediaQuery.addEventListener === "function") {
    mobileMediaQuery.addEventListener("change", updateMobileLayout);
  } else if (typeof mobileMediaQuery.addListener === "function") {
    mobileMediaQuery.addListener(updateMobileLayout);
  }
}

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
  if (!hasObservationChance(observer)) {
    render();
    return;
  }
  state.observationsRemaining[observer] = Math.max(
    0,
    state.observationsRemaining[observer] - 1,
  );
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

function updatePlayerPanels() {
  elements.playerPanels.forEach((panel) => {
    const player = panel.dataset.playerPanel;
    if (!player) return;
    const isCurrentPlayer = !state.gameOver && state.currentPlayer === player;
    panel.classList.toggle("is-active", isCurrentPlayer);
    panel.classList.toggle("is-inactive", !isCurrentPlayer);
    const observeButton = panel.querySelector('[data-action="observe"]');
    if (observeButton) {
      const canReturn = state.viewingObservation && isCurrentPlayer && !state.gameOver;
      const canObserve =
        state.awaitingDecision &&
        !state.gameOver &&
        !state.viewingObservation &&
        isCurrentPlayer &&
        hasObservationChance(player);
      observeButton.disabled = !(canReturn || canObserve);
      observeButton.textContent = canReturn ? RETURN_LABEL : OBSERVE_LABEL;
    }
    const skipButton = panel.querySelector('[data-action="skip"]');
    if (skipButton) {
      const skipDisabled =
        !state.awaitingDecision || state.gameOver || state.viewingObservation || !isCurrentPlayer;
      skipButton.disabled = skipDisabled;
    }
  });
}

function renderStatus() {
  const estimationBoard = getEstimationBoard();
  const odds = estimationBoard
    ? estimateObservationOdds(estimationBoard, BOARD_SIZE)
    : null;
  elements.playerSummaries.forEach((summary) => {
    const color = summary.dataset.playerColor;
    if (!color) return;
    const label = color === "white" ? "白プレイヤー" : "黒プレイヤー";
    let detail = "";
    if (state.gameOver) {
      detail = state.winner === color ? "勝利" : "終了";
    } else if (state.viewingObservation) {
      detail = "観測結果表示中";
    } else {
      const nextProbability = Math.round(getNextProbability(color) * 100);
      detail = `次${nextProbability}%`;
    }
    const remaining = state.observationsRemaining[color];
    summary.textContent = `${label}: ${detail}（観測残り${remaining}回）`;
  });
  updatePlayerOdds(odds);
  updatePlayerPanels();
}

function getEstimationBoard() {
  if (state.gameOver) return null;
  if (state.viewingObservation) {
    return state.previousQuantumBoard && hasQuantumCells(state.previousQuantumBoard)
      ? state.previousQuantumBoard
      : null;
  }
  return hasQuantumCells(state.board) ? state.board : null;
}

function hasQuantumCells(board) {
  return board.some((cell) => cell && typeof cell !== "string");
}

function estimateObservationOdds(board, size, samples = OBSERVATION_SIMULATION_COUNT) {
  if (!board || !samples) return null;
  const wins = { black: 0, white: 0 };
  for (let i = 0; i < samples; i += 1) {
    const { winner } = collapseBoard(board, size);
    if (winner === "black") {
      wins.black += 1;
    } else if (winner === "white") {
      wins.white += 1;
    } else if (winner === "both") {
      wins.black += 1;
      wins.white += 1;
    }
  }
  return {
    black: wins.black / samples,
    white: wins.white / samples,
  };
}

function updatePlayerOdds(odds) {
  const baseLabel = "今観測した場合の五目率";
  elements.playerOdds.forEach((element) => {
    const color = element.dataset.playerOdds;
    if (!color) return;
    if (odds && typeof odds[color] === "number") {
      element.textContent = `${baseLabel}: ${Math.round(odds[color] * 100)}%`;
    } else {
      element.textContent = `${baseLabel}: --%`;
    }
  });
}

function handlePrimaryAction(event) {
  const player = getPlayerFromElement(event.currentTarget);
  if (!player || player !== state.currentPlayer) return;
  if (state.viewingObservation && !state.gameOver) {
    revertBoard();
    return;
  }
  observeBoard();
}

function handleSkipAction(event) {
  const player = getPlayerFromElement(event.currentTarget);
  if (!player || player !== state.currentPlayer) return;
  skipObservation();
}

elements.boardCanvas.addEventListener("click", handleBoardClick);
elements.boardCanvas.addEventListener("pointermove", handleBoardPointerMove);
elements.boardCanvas.addEventListener("pointerleave", handleBoardPointerLeave);
elements.observeButtons.forEach((button) =>
  button.addEventListener("click", handlePrimaryAction),
);
elements.skipButtons.forEach((button) => button.addEventListener("click", handleSkipAction));

initializeResponsiveLayout();
initializeBoardCanvas();
defaultState();
