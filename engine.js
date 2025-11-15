export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function spawnPickup(width, height, margin = 24) {
  if (width <= margin * 2 || height <= margin * 2) {
    throw new Error("Canvas is too small for the requested margin");
  }
  return {
    x: Math.random() * (width - margin * 2) + margin,
    y: Math.random() * (height - margin * 2) + margin,
    radius: 14,
  };
}

export function movePlayer(player, pressedKeys, speed, bounds) {
  const next = { ...player };
  if (pressedKeys.has("ArrowUp")) next.y -= speed;
  if (pressedKeys.has("ArrowDown")) next.y += speed;
  if (pressedKeys.has("ArrowLeft")) next.x -= speed;
  if (pressedKeys.has("ArrowRight")) next.x += speed;

  const maxX = bounds.width - player.size;
  const maxY = bounds.height - player.size;
  next.x = clamp(next.x, 0, maxX);
  next.y = clamp(next.y, 0, maxY);
  return next;
}

export function isColliding(player, pickup) {
  const playerCenterX = player.x + player.size / 2;
  const playerCenterY = player.y + player.size / 2;
  const dx = playerCenterX - pickup.x;
  const dy = playerCenterY - pickup.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < player.size / 2 + pickup.radius;
}
