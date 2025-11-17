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
  render();
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
  if (state.gameOver || state.awaitingDecision) return;
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
  if (!state.awaitingDecision || state.gameOver) return;
  const { collapsed, winner } = collapseBoard(state.board, BOARD_SIZE);
  if (winner) {
    state.board = collapsed;
    state.gameOver = true;
    state.winner = winner;
    if (winner === "both") {
      addLog("観測の結果、両者同時に五目が揃った！引き分けです。");
    } else {
      addLog(`観測の結果、${describePlayer(winner)}の勝利！`);
    }
    state.awaitingDecision = false;
  } else {
    addLog("観測したが五目は現れなかった。盤面は元に戻る。");
    switchTurn();
  }
  render();
}

function skipObservation() {
  if (!state.awaitingDecision || state.gameOver) return;
  addLog("観測せずに次のプレイヤーへターンを渡す。");
  switchTurn();
  render();
}

function resetGame() {
  defaultState();
}

function render() {
  renderBoard();
  renderStatus();
  renderLog();
}

function renderBoard() {
  elements.board.innerHTML = "";
  state.board.forEach((cell, index) => {
    const button = document.createElement("button");
    button.className = "cell";
    button.dataset.index = index;
    if (!cell) {
      button.textContent = "";
    } else if (typeof cell === "string") {
      button.classList.add("collapsed", cell);
      button.setAttribute("aria-label", `${describePlayer(cell)}の確定石`);
    } else {
      button.classList.add(cell.player);
      button.textContent = `${Math.round(cell.probability * 100)}%`;
      button.setAttribute(
        "aria-label",
        `${describePlayer(cell.player)}の${Math.round(cell.probability * 100)}%石`
      );
    }
    if (state.gameOver || state.awaitingDecision) {
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
  } else {
    const player = describePlayer(state.currentPlayer);
    const probability = Math.round(getNextProbability(state.currentPlayer) * 100);
    elements.status.textContent = `${player}の番です。`; 
    elements.stoneInfo.textContent = `次に置ける石: ${probability}%で黒になります。`;
    elements.decisionInfo.textContent = state.awaitingDecision
      ? "観測するか、そのままターンを渡すか選んでください。"
      : "空いているマスを選んで石を置いてください。";
  }
  elements.observeButton.disabled = !state.awaitingDecision || state.gameOver;
  elements.skipButton.disabled = !state.awaitingDecision || state.gameOver;
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

defaultState();
