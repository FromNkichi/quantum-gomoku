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

const elements = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  stoneInfo: document.getElementById("stone-info"),
  decisionInfo: document.getElementById("decision-info"),
  observeButton: document.getElementById("observe-button"),
  skipButton: document.getElementById("skip-button"),
  resetButton: document.getElementById("reset-button"),
  backButton: document.getElementById("back-button"),
  log: document.getElementById("log"),
};

const state = {
  board: createEmptyBoard(BOARD_SIZE),
  currentPlayer: "black",
  stoneIndex: { black: 0, white: 0 },
  awaitingDecision: false,
  gameOver: false,
  winner: null,
  log: [],
  previousQuantumBoard: null,
  viewingObservation: false,
  pendingTurnSwitch: false,
};

elements.board.style.setProperty(
  "grid-template-columns",
  `repeat(${BOARD_SIZE}, 1fr)`
);

function defaultState() {
  state.board = createEmptyBoard(BOARD_SIZE);
  state.currentPlayer = "black";
  state.stoneIndex.black = 0;
  state.stoneIndex.white = 0;
  state.awaitingDecision = false;
  state.gameOver = false;
  state.winner = null;
  state.log = [];
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

function addLog(message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 6);
}

function handleCellClick(event) {
  if (state.gameOver || state.awaitingDecision || state.viewingObservation) return;
  const { index } = event.target.dataset;
  if (index === undefined) return;
  const idx = Number(index);
  if (Number.isNaN(idx) || state.board[idx]) return;
  const probability = getNextProbability(state.currentPlayer);
  state.board = placeStone(state.board, idx, state.currentPlayer, probability);
  state.awaitingDecision = true;
  addLog(`${describePlayer(state.currentPlayer)}が${Math.round(probability * 100)}%の石を置いた。`);
  render();
}

function switchTurn() {
  cycleStone(state.currentPlayer);
  state.currentPlayer = state.currentPlayer === "black" ? "white" : "black";
  state.awaitingDecision = false;
}

function observeBoard() {
  if (!state.awaitingDecision || state.gameOver || state.viewingObservation) return;
  state.previousQuantumBoard = cloneBoard(state.board);
  const { collapsed, winner } = collapseBoard(state.board, BOARD_SIZE);
  state.board = collapsed;
  state.awaitingDecision = false;
  state.viewingObservation = !winner;
  state.pendingTurnSwitch = !winner;
  if (winner) {
    state.previousQuantumBoard = null;
    state.gameOver = true;
    state.winner = winner;
    if (winner === "both") {
      addLog("観測の結果、両者同時に五目が揃った！引き分けです。");
    } else {
      addLog(`観測の結果、${describePlayer(winner)}の勝利！`);
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

function render() {
  renderBoard();
  renderStatus();
  renderLog();
}

function renderBoard() {
  elements.board.classList.toggle("observation-view", state.viewingObservation);
  elements.board.innerHTML = "";
  state.board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = index;
    if (!cell) {
      button.setAttribute("aria-label", "空の交点");
    } else if (typeof cell === "string") {
      const stone = document.createElement("span");
      stone.className = "stone";
      stone.classList.add("resolved", cell);
      button.setAttribute("aria-label", `${describePlayer(cell)}の確定石`);
      button.appendChild(stone);
    } else {
      const stone = document.createElement("span");
      stone.className = "stone";
      const probability = clampProbability(cell.probability);
      const percentage = Math.round(probability * 100);
      const tone = blendStoneColor(probability);
      stone.classList.add("probability-stone");
      stone.textContent = `${percentage}%`;
      stone.style.setProperty("--stone-fill", tone.fill);
      stone.style.setProperty("--stone-text-color", tone.text);
      button.setAttribute(
        "aria-label",
        `${describePlayer(cell.player)}の${percentage}%で黒になる石`
      );
      button.appendChild(stone);
    }
    if (state.gameOver || state.awaitingDecision || state.viewingObservation) {
      button.disabled = true;
    }
    elements.board.appendChild(button);
  });
}

function renderStatus() {
  if (state.gameOver) {
    if (state.winner === "both") {
      elements.status.textContent = "両者の石が同時に五目を達成しました。引き分けです。";
    } else {
      elements.status.textContent = `${describePlayer(state.winner)}の勝利！もう一度遊ぶにはリセットしてください。`;
    }
    elements.stoneInfo.textContent = "ゲーム終了";
    elements.decisionInfo.textContent = "";
  } else if (state.viewingObservation) {
    elements.status.textContent = "観測結果を表示中です。";
    elements.stoneInfo.textContent = "石は確率に従って黒と白に確定しています。";
    elements.decisionInfo.textContent = "盤面を確認したら「もどる」で量子盤面に戻ってください。";
  } else {
    const player = describePlayer(state.currentPlayer);
    const probability = Math.round(getNextProbability(state.currentPlayer) * 100);
    elements.status.textContent = `${player}の番です。`;
    elements.stoneInfo.textContent = `次に置ける石: ${probability}%で黒になります。`;
    elements.decisionInfo.textContent = state.awaitingDecision
      ? "観測するか、そのままターンを渡すか選んでください。"
      : "空いているマスを選んで石を置いてください。";
  }
  elements.observeButton.disabled =
    !state.awaitingDecision || state.gameOver || state.viewingObservation;
  elements.skipButton.disabled =
    !state.awaitingDecision || state.gameOver || state.viewingObservation;
  elements.backButton.disabled = !(state.viewingObservation && !state.gameOver);
}

function renderLog() {
  elements.log.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    elements.log.appendChild(li);
  });
}

elements.board.addEventListener("click", handleCellClick);
elements.observeButton.addEventListener("click", observeBoard);
elements.skipButton.addEventListener("click", skipObservation);
elements.resetButton.addEventListener("click", resetGame);
elements.backButton.addEventListener("click", revertBoard);

defaultState();
