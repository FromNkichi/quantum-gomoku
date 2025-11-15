import { spawnPickup, movePlayer, isColliding } from "./engine.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const startButton = document.getElementById("start-button");
const scoreLabel = document.getElementById("score");
const highScoreLabel = document.getElementById("high-score");

const state = {
  running: false,
  score: 0,
  highScore: Number(localStorage.getItem("codex-high-score")) || 0,
  timer: 0,
  timeLimit: 60,
  player: { x: 220, y: 220, size: 32, speed: 4 },
  pickup: spawnPickup(canvas.width, canvas.height),
  pressedKeys: new Set(),
};

let lastTimestamp = 0;
let animationId = 0;

function resetGame() {
  state.score = 0;
  state.timer = 0;
  state.player.x = canvas.width / 2 - state.player.size / 2;
  state.player.y = canvas.height / 2 - state.player.size / 2;
  state.pickup = spawnPickup(canvas.width, canvas.height);
  scoreLabel.textContent = state.score;
  state.running = true;
}

function update(delta) {
  if (!state.running) return;
  state.timer += delta;

  if (state.timer >= state.timeLimit) {
    state.running = false;
    cancelAnimationFrame(animationId);
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem("codex-high-score", state.highScore);
      highScoreLabel.textContent = state.highScore;
    }
    startButton.textContent = "もう一度";
    return;
  }

  const moved = movePlayer(
    state.player,
    state.pressedKeys,
    state.player.speed,
    { width: canvas.width, height: canvas.height }
  );
  state.player.x = moved.x;
  state.player.y = moved.y;

  if (isColliding(state.player, state.pickup)) {
    state.score += 10;
    scoreLabel.textContent = state.score;
    state.pickup = spawnPickup(canvas.width, canvas.height);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(state.player.x, state.player.y, state.player.size, state.player.size);

  ctx.beginPath();
  ctx.arc(state.pickup.x, state.pickup.y, state.pickup.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#f97316";
  ctx.shadowColor = "#fb923c";
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  drawTimer();
}

function drawTimer() {
  const progress = Math.min(state.timer / state.timeLimit, 1);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, canvas.height - 12, canvas.width, 12);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(0, canvas.height - 12, canvas.width * (1 - progress), 12);
}

function loop(timestamp) {
  const delta = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  update(delta);
  render();

  animationId = requestAnimationFrame(loop);
}

function init() {
  highScoreLabel.textContent = state.highScore;
  render();
}

startButton.addEventListener("click", () => {
  resetGame();
  startButton.textContent = "プレイ中...";
  lastTimestamp = performance.now();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
});

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    state.pressedKeys.add(event.key);
  }
});

window.addEventListener("keyup", (event) => {
  state.pressedKeys.delete(event.key);
});

init();
