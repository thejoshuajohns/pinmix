import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomFor, shuffle } from "../src/shuffle.ts";

const items = Array.from({ length: 50 }, (_, index) => `pin-${index}`);

describe("shuffle", () => {
  it("keeps every item exactly once", () => {
    const shuffled = shuffle(items, Math.random);

    assert.notEqual(shuffled, items);
    assert.deepEqual([...shuffled].sort(), [...items].sort());
  });

  it("repeats the same order for the same seed", () => {
    const first = shuffle(items, randomFor("cozy"));
    const second = shuffle(items, randomFor("cozy"));

    assert.deepEqual(first, second);
    assert.notDeepEqual(first, items);
  });

  it("changes the order for a different seed", () => {
    assert.notDeepEqual(
      shuffle(items, randomFor("cozy")),
      shuffle(items, randomFor("loud"))
    );
  });

  it("falls back to Math.random without a seed", () => {
    assert.equal(randomFor(""), Math.random);
  });
});
