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
  statuses: document.querySelectorAll("[data-status]"),
  stoneInfos: document.querySelectorAll("[data-stone-info]"),
  decisionInfos: document.querySelectorAll("[data-decision-info]"),
  observeButtons: document.querySelectorAll('[data-action="observe"]'),
  skipButtons: document.querySelectorAll('[data-action="skip"]'),
  resetButtons: document.querySelectorAll('[data-action="reset"]'),
  backButtons: document.querySelectorAll('[data-action="back"]'),
  log: document.getElementById("log"),
};

const state = {
  board: createEmptyBoard(BOARD_SIZE),
  currentPlayer: "black",
  stoneIndex: { black: 0, white: 0 },
  awaitingDecision: false,
  gameOver: false,
  winner: null,
  observerWin: false,
  log: [],
  previousQuantumBoard: null,
  viewingObservation: false,
  pendingTurnSwitch: false,
};

elements.board.style.setProperty("--board-size", BOARD_SIZE);

function defaultState() {
  state.board = createEmptyBoard(BOARD_SIZE);
  state.currentPlayer = "black";
  state.stoneIndex.black = 0;
  state.stoneIndex.white = 0;
  state.awaitingDecision = false;
  state.gameOver = false;
  state.winner = null;
  state.observerWin = false;
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
  const cell = event.target.closest(".cell");
  if (!cell || !elements.board.contains(cell)) return;
  const { index } = cell.dataset;
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
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    button.style.setProperty("--cell-x", x);
    button.style.setProperty("--cell-y", y);
    if (y === 0) button.classList.add("cell-top-edge");
    if (y === BOARD_SIZE - 1) button.classList.add("cell-bottom-edge");
    if (x === 0) button.classList.add("cell-left-edge");
    if (x === BOARD_SIZE - 1) button.classList.add("cell-right-edge");
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
      stone.textContent = `${percentage}`;
      stone.style.setProperty("--stone-fill", tone.fill);
      stone.style.setProperty("--stone-text-color", tone.text);
      button.setAttribute(
        "aria-label",
        `${describePlayer(cell.player)}の${percentage}%で黒になる石`
      );
      button.appendChild(stone);
    }
    button.classList.toggle("cell-has-stone", Boolean(cell));
    if (state.gameOver || state.awaitingDecision || state.viewingObservation) {
      button.disabled = true;
    }
    elements.board.appendChild(button);
  });
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

function renderLog() {
  elements.log.innerHTML = "";
  state.log.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    elements.log.appendChild(li);
  });
}

elements.board.addEventListener("click", handleCellClick);
elements.observeButtons.forEach((button) => button.addEventListener("click", observeBoard));
elements.skipButtons.forEach((button) => button.addEventListener("click", skipObservation));
elements.resetButtons.forEach((button) => button.addEventListener("click", resetGame));
elements.backButtons.forEach((button) => button.addEventListener("click", revertBoard));

defaultState();
