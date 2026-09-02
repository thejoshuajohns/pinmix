import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mixBoard, type MixInput, type MixProgress } from "../src/mix.ts";
import {
  board,
  feedItems,
  installFakePinterest,
  section,
  sectionData,
  type FakeRequest,
  type FakeRoute
} from "./fake-pinterest.ts";

const created = { id: "new", url: "/thejoshuajohns/grad-poses-shuffled/" };
const pinIds = Array.from({ length: 6 }, (_, index) => String(index + 1));
const sectionPinIds = Array.from({ length: 60 }, (_, index) => `s${index}`);
const saveOk: FakeRoute = () => ({ data: { id: "saved" } });

const routes = (save: FakeRoute): Record<string, FakeRoute> => ({
  "BoardFeedResource/get": () => ({
    data: feedItems(...pinIds),
    bookmark: "-end-"
  }),
  "BoardSectionsResource/get": () => ({ data: [] }),
  "BoardSectionPinsResource/get": () => ({ data: feedItems(...sectionPinIds) }),
  "BoardResource/create": () => ({ data: created }),
  "BoardSectionResource/create": () => ({ data: { id: "sec" } }),
  "ApiResource/create": () => ({ data: { id: "sec" } }),
  "RepinResource/create": save
});

const savesIn = (requests: FakeRequest[]) =>
  requests.filter((request) => request.resource === "RepinResource");

async function runMix(input: Partial<MixInput> = {}): Promise<{
  result: Awaited<ReturnType<typeof mixBoard>>;
  progress: MixProgress[];
}> {
  mock.timers.enable({ apis: ["setTimeout"] });

  const progress: MixProgress[] = [];
  const pending = mixBoard({
    target: { board, section: null },
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
    const requests = installFakePinterest(routes(saveOk));
    const { result, progress } = await runMix({ seed: "cozy" });
    const saves = savesIn(requests);
    const savedOrder = saves.map((request) => request.options.pin_id);

    assert.deepEqual(result, { board: created, saved: 6, total: 6 });
    assert.deepEqual([...savedOrder].sort(), pinIds);
    assert.notDeepEqual(savedOrder, pinIds);
    assert.ok(saves.every((request) => request.options.board_id === "new"));
    assert.deepEqual(progress[0], { phase: "loading", done: 6, total: 3 });
    assert.deepEqual(progress.at(-1), { phase: "saving", done: 6, total: 6 });

    const again = installFakePinterest(routes(saveOk));

    await runMix({ seed: "cozy" });

    assert.deepEqual(
      savesIn(again).map((request) => request.options.pin_id),
      savedOrder
    );
  });

  it("recreates sections and saves their shuffled pins in batches", async () => {
    const requests = installFakePinterest({
      ...routes(saveOk),
      "BoardSectionsResource/get": () => ({ data: [sectionData] })
    });
    const { result, progress } = await runMix({ seed: "cozy" });
    const batches = requests
      .filter((request) => request.resource === "ApiResource")
      .map((request) => request.options);
    const batchedIds = batches.flatMap(
      (options) => (options.data as { pins: string[] }).pins
    );
    const createSection = requests.find(
      (request) => request.resource === "BoardSectionResource"
    );

    assert.deepEqual(result, { board: created, saved: 66, total: 66 });
    assert.deepEqual(createSection?.options, {
      board_id: "new",
      name: section.title
    });
    assert.deepEqual(
      [...savesIn(requests).map((request) => request.options.pin_id)].sort(),
      pinIds
    );
    assert.ok(
      batches.every((options) => options.url === "/v3/board/sections/sec/")
    );
    assert.deepEqual(
      batches.map(
        (options) => (options.data as { pins: string[] }).pins.length
      ),
      [50, 10]
    );
    assert.deepEqual([...batchedIds].sort(), [...sectionPinIds].sort());
    assert.notDeepEqual(batchedIds, sectionPinIds);
    assert.deepEqual(progress[1], { phase: "loading", done: 66, total: 3 });
  });

  it("shuffles a single section into a plain board", async () => {
    const requests = installFakePinterest(routes(saveOk));
    const { result, progress } = await runMix({
      target: { board, section }
    });

    assert.deepEqual(result, { board: created, saved: 60, total: 60 });
    assert.equal(savesIn(requests).length, 60);
    assert.ok(
      requests.every(
        (request) =>
          request.resource !== "BoardSectionResource" &&
          request.resource !== "ApiResource"
      )
    );
    assert.deepEqual(progress[0], { phase: "loading", done: 60, total: 2 });
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
    assert.equal(savesIn(requests).length, 6 + 2 + 2);
  });

  it("stops saving when the signal aborts and keeps the partial count", async () => {
    const controller = new AbortController();
    const requests = installFakePinterest(routes(saveOk));
    const { result } = await runMix({
      signal: controller.signal,
      onProgress: ({ phase, done }) => {
        if (phase === "saving" && done === 2) {
          controller.abort();
        }
      }
    });

    assert.deepEqual(result, { board: created, saved: 2, total: 6 });
    assert.equal(savesIn(requests).length, 2);
  });

  it("refuses to shuffle an empty board", async () => {
    installFakePinterest({
      "BoardFeedResource/get": () => ({ data: [], bookmark: "-end-" }),
      "BoardSectionsResource/get": () => ({ data: [] })
    });

    await assert.rejects(runMix(), /no pins/);
  });
});
