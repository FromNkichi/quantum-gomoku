import { spawnPickup, movePlayer, isColliding, clamp } from "./engine.js";

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
const touchInput = {
  active: false,
  pointerId: null,
  x: null,
  y: null,
  ripple: null,
};

function resetGame() {
  state.score = 0;
  state.timer = 0;
  state.player.x = canvas.width / 2 - state.player.size / 2;
  state.player.y = canvas.height / 2 - state.player.size / 2;
  state.pickup = spawnPickup(canvas.width, canvas.height);
  scoreLabel.textContent = state.score;
  resetTouchControl();
  state.running = true;
}

function update(delta) {
  if (!state.running) return;
  state.timer += delta;
  updateTouchRipple(delta);

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

  if (touchInput.active && touchInput.x !== null && touchInput.y !== null) {
    setPlayerToTouch(touchInput.x, touchInput.y);
  } else {
    const moved = movePlayer(
      state.player,
      state.pressedKeys,
      state.player.speed,
      { width: canvas.width, height: canvas.height }
    );
    state.player.x = moved.x;
    state.player.y = moved.y;
  }

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
  renderTouchFeedback();
}

function drawTimer() {
  const progress = Math.min(state.timer / state.timeLimit, 1);
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, canvas.height - 12, canvas.width, 12);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(0, canvas.height - 12, canvas.width * (1 - progress), 12);
}

function renderTouchFeedback() {
  if (!touchInput.ripple) return;
  const { x, y, progress } = touchInput.ripple;
  const radius = 12 + progress * 40;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0, 1 - progress)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function updateTouchRipple(delta) {
  if (!touchInput.ripple) return;
  touchInput.ripple.progress += delta * 3;
  if (touchInput.ripple.progress >= 1) {
    touchInput.ripple = null;
  }
}

function setPlayerToTouch(targetX, targetY) {
  const half = state.player.size / 2;
  state.player.x = clamp(targetX - half, 0, canvas.width - state.player.size);
  state.player.y = clamp(targetY - half, 0, canvas.height - state.player.size);
}

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function startTouchControl(event) {
  event.preventDefault();
  if (!state.running) {
    startButton.click();
  }
  const point = getCanvasPoint(event);
  touchInput.active = true;
  touchInput.pointerId = event.pointerId;
  touchInput.x = point.x;
  touchInput.y = point.y;
  touchInput.ripple = { x: point.x, y: point.y, progress: 0 };
  setPlayerToTouch(point.x, point.y);
  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(event.pointerId);
  }
}

function moveTouchControl(event) {
  if (!touchInput.active || touchInput.pointerId !== event.pointerId) return;
  event.preventDefault();
  const point = getCanvasPoint(event);
  touchInput.x = point.x;
  touchInput.y = point.y;
  setPlayerToTouch(point.x, point.y);
}

function endTouchControl(event) {
  if (touchInput.pointerId !== event.pointerId) return;
  event.preventDefault();
  if (
    canvas.releasePointerCapture &&
    canvas.hasPointerCapture &&
    canvas.hasPointerCapture(event.pointerId)
  ) {
    canvas.releasePointerCapture(event.pointerId);
  }
  resetTouchControl();
}

function resetTouchControl() {
  touchInput.active = false;
  touchInput.pointerId = null;
  touchInput.x = null;
  touchInput.y = null;
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

canvas.addEventListener("pointerdown", startTouchControl);
canvas.addEventListener("pointermove", moveTouchControl);
canvas.addEventListener("pointerup", endTouchControl);
canvas.addEventListener("pointerleave", endTouchControl);
canvas.addEventListener("pointercancel", endTouchControl);
window.addEventListener("blur", () => {
  state.pressedKeys.clear();
  resetTouchControl();
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
