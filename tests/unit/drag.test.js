import { test } from "node:test";
import assert from "node:assert/strict";
import { scrollSpeed } from "../../src/drag.js";

// A 900 px screen with the strip's top edge at 780: the up zone is [0, 64), the down zone [716, 780).
const STRIP = 780;

test("scrollSpeed: 0 in the middle, at the zone borders and over the strip", () => {
  for (const y of [64, 300, 715, STRIP, STRIP + 40, 899]) assert.equal(scrollSpeed(y, STRIP), 0, `y ${y}`);
  assert.equal(scrollSpeed(716, STRIP), 1);
});

test("scrollSpeed: negative near the top, faster nearer the edge", () => {
  assert.ok(scrollSpeed(63, STRIP) < 0);
  assert.ok(scrollSpeed(10, STRIP) < scrollSpeed(50, STRIP));
  assert.equal(scrollSpeed(0, STRIP), -18);
});

test("scrollSpeed: positive in the 64 px above the strip, faster nearer the strip", () => {
  assert.ok(scrollSpeed(716, STRIP) > 0);
  assert.ok(scrollSpeed(770, STRIP) > scrollSpeed(730, STRIP));
  assert.equal(scrollSpeed(STRIP - 0.5, STRIP), 18);
});

test("scrollSpeed: capped, also with the pointer past the screen top", () => {
  assert.equal(scrollSpeed(-200, STRIP), -18);
  assert.equal(scrollSpeed(-5, STRIP, 64, 10), -10);
  for (let y = -50; y < 1000; y += 7) assert.ok(Math.abs(scrollSpeed(y, STRIP)) <= 18, `y ${y}`);
});

test("scrollSpeed: never a fraction, so every step moves the page", () => {
  for (const y of [1, 33, 63, 717, 749, 779]) assert.ok(Number.isInteger(scrollSpeed(y, STRIP)) && scrollSpeed(y, STRIP) !== 0, `y ${y}`);
});

// BUG-020: a tall strip on a short screen. The strip always wins; below 128 px the two zones split the space above it.
const sweep = (top, from = -100, to = 200) => Array.from({ length: (to - from) * 2 }, (_, i) => from + i / 2).map((y) => [y, scrollSpeed(y, top)]);

test("scrollSpeed: over the strip it is always 0, whatever the strip's height", () => {
  for (const top of [780, 300, 127, 100, 64, 50, 8]) for (const [y, v] of sweep(top)) if (y >= top) assert.equal(v, 0, `top ${top} y ${y}`);
  assert.ok(scrollSpeed(30, 50) >= 0); // the reviewer's case: was -10 when the strip started above 64 px
  assert.equal(scrollSpeed(60, 50), 0);
});

test("scrollSpeed: stripTop 100 splits into [0, 50) up and [50, 100) down, each from 1 to the cap", () => {
  assert.equal(scrollSpeed(0, 100), -18);
  assert.equal(scrollSpeed(49.5, 100), -1);
  assert.equal(scrollSpeed(50, 100), 1);
  assert.equal(scrollSpeed(99.5, 100), 18);
  assert.ok(scrollSpeed(20, 100) < scrollSpeed(40, 100) && scrollSpeed(60, 100) < scrollSpeed(90, 100));
});

test("scrollSpeed: stripTop 50 and 8 split the same way, every value an integer within the cap", () => {
  for (const top of [50, 8]) {
    const half = top / 2;
    for (const [y, v] of sweep(top, 0, top)) {
      assert.ok(Number.isInteger(v) && Math.abs(v) >= 1 && Math.abs(v) <= 18, `top ${top} y ${y} v ${v}`);
      assert.equal(Math.sign(v), y < half ? -1 : 1, `top ${top} y ${y}`);
    }
    assert.equal(scrollSpeed(0, top), -18);
  }
});

test("scrollSpeed: a strip taller than the screen (stripTop -60, or 0) leaves no zone at all", () => {
  for (const top of [-60, 0]) for (const [y, v] of sweep(top)) assert.equal(v, 0, `top ${top} y ${y}`);
});
