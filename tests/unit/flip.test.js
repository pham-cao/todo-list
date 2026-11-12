import { test } from "node:test";
import assert from "node:assert/strict";
import { leafCount } from "../../src/flip.js";

// The module touches no DOM at import time, so it loads in Node.

test("leafCount gives 0 for no move and 1, 2, 3 for 1, 2, 3 days", () => {
  assert.deepEqual([0, 1, 2, 3].map(leafCount), [0, 1, 2, 3]);
});

test("leafCount caps at 3 leaves for longer moves", () => {
  assert.deepEqual([4, 30, 1000].map(leafCount), [3, 3, 3]);
});

test("leafCount ignores the sign of a backward move", () => {
  assert.deepEqual([-1, -2, -5].map(leafCount), [1, 2, 3]);
});

test("leafCount gives 0 for null from an invalid key, without throwing", () => {
  assert.equal(leafCount(null), 0);
});
