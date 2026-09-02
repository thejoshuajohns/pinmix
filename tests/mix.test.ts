import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mixBoard, type MixInput, type MixProgress } from "../src/mix.ts";
import {
  board,
  feedItems,
  installFakePinterest,
  type FakeRoute
} from "./fake-pinterest.ts";

const created = { id: "new", url: "/thejoshuajohns/grad-poses-shuffled/" };
const pinIds = Array.from({ length: 6 }, (_, index) => String(index + 1));

const routes = (save: FakeRoute): Record<string, FakeRoute> => ({
  "BoardFeedResource/get": () => ({
    data: feedItems(...pinIds),
    bookmark: "-end-"
  }),
  "BoardResource/create": () => ({ data: created }),
  "RepinResource/create": save
});

async function runMix(input: Partial<MixInput> = {}): Promise<{
  result: Awaited<ReturnType<typeof mixBoard>>;
  progress: MixProgress[];
}> {
  mock.timers.enable({ apis: ["setTimeout"] });

  const progress: MixProgress[] = [];
  const pending = mixBoard({
    board,
    name: "grad poses shuffled",
    seed: "",
    signal: new AbortController().signal,
    onProgress: (update) => progress.push(update),
    ...input
  });
  let settled = false;

  pending.finally(() => (settled = true)).catch(() => undefined);

  while (!settled) {
    await new Promise((resolve) => setImmediate(resolve));
    mock.timers.runAll();
  }

  mock.timers.reset();

  return { result: await pending, progress };
}

describe("mixBoard", () => {
  it("saves every pin into a fresh board in a seeded order", async () => {
    const requests = installFakePinterest(
      routes(() => ({ data: { id: "saved" } }))
    );
    const { result, progress } = await runMix({ seed: "cozy" });
    const saves = requests.filter(
      (request) => request.resource === "RepinResource"
    );
    const savedOrder = saves.map((request) => request.options.pin_id);

    assert.deepEqual(result, { board: created, saved: 6, total: 6 });
    assert.deepEqual([...savedOrder].sort(), pinIds);
    assert.notDeepEqual(savedOrder, pinIds);
    assert.ok(saves.every((request) => request.options.board_id === "new"));
    assert.deepEqual(progress[0], { phase: "loading", done: 6, total: 3 });
    assert.deepEqual(progress.at(-1), { phase: "saving", done: 6, total: 6 });

    const again = installFakePinterest(
      routes(() => ({ data: { id: "saved" } }))
    );

    await runMix({ seed: "cozy" });

    assert.deepEqual(
      again
        .filter((request) => request.resource === "RepinResource")
        .map((request) => request.options.pin_id),
      savedOrder
    );
  });

  it("retries a failed save and counts the ones that never make it", async () => {
    const attempts: Record<string, number> = {};
    const requests = installFakePinterest(
      routes((options) => {
        const pinId = String(options.pin_id);
        attempts[pinId] = (attempts[pinId] ?? 0) + 1;

        if (pinId === "2" && attempts[pinId] < 3) {
          return { status: 429 };
        }

        return pinId === "5" ? { status: 500 } : { data: { id: "saved" } };
      })
    );
    const { result } = await runMix();

    assert.deepEqual(result, { board: created, saved: 5, total: 6 });
    assert.equal(attempts["2"], 3);
    assert.equal(attempts["5"], 3);
    assert.equal(
      requests.filter((request) => request.resource === "RepinResource").length,
      6 + 2 + 2
    );
  });

  it("stops saving when the signal aborts and keeps the partial count", async () => {
    const controller = new AbortController();
    const requests = installFakePinterest(
      routes(() => ({ data: { id: "saved" } }))
    );
    const { result } = await runMix({
      signal: controller.signal,
      onProgress: ({ phase, done }) => {
        if (phase === "saving" && done === 2) {
          controller.abort();
        }
      }
    });

    assert.deepEqual(result, { board: created, saved: 2, total: 6 });
    assert.equal(
      requests.filter((request) => request.resource === "RepinResource").length,
      2
    );
  });

  it("refuses to shuffle an empty board", async () => {
    installFakePinterest({
      "BoardFeedResource/get": () => ({ data: [], bookmark: "-end-" })
    });

    await assert.rejects(runMix(), /no pins/);
  });
});
