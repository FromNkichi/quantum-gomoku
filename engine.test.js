import test from "node:test";
import assert from "node:assert/strict";
import { spawnPickup, movePlayer, isColliding } from "./engine.js";

const CANVAS = { width: 480, height: 480 };

test("spawnPickup keeps items within margins", () => {
  for (let i = 0; i < 100; i += 1) {
    const pickup = spawnPickup(CANVAS.width, CANVAS.height, 24);
    assert.ok(pickup.x >= 24 && pickup.x <= CANVAS.width - 24);
    assert.ok(pickup.y >= 24 && pickup.y <= CANVAS.height - 24);
    assert.equal(pickup.radius, 14);
  }
});

test("movePlayer applies velocity and clamps to bounds", () => {
  const player = { x: 5, y: 5, size: 32 };
  const pressedKeys = new Set(["ArrowUp", "ArrowLeft"]);
  const moved = movePlayer(player, pressedKeys, 10, CANVAS);
  assert.equal(moved.x, 0);
  assert.equal(moved.y, 0);

  const pressedToEdge = new Set(["ArrowDown", "ArrowRight"]);
  const movedToEdge = movePlayer(moved, pressedToEdge, 1000, CANVAS);
  assert.equal(movedToEdge.x, CANVAS.width - player.size);
  assert.equal(movedToEdge.y, CANVAS.height - player.size);
});

test("isColliding detects overlap between player and pickup", () => {
  const player = { x: 100, y: 100, size: 20 };
  const pickup = { x: 105, y: 105, radius: 10 };
  assert.ok(isColliding(player, pickup));

  const farPickup = { x: 400, y: 400, radius: 10 };
  assert.ok(!isColliding(player, farPickup));
});
