import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  mix,
  type MixInput,
  type MixProgress,
  type MixResult
} from "../src/mix.ts";
import {
  board,
  boardPath,
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
const saveOk: FakeRoute = (options) => ({
  data: { id: `copy-${options.pin_id}` }
});

const routes = (save: FakeRoute): Record<string, FakeRoute> => ({
  "BoardFeedResource/get": () => ({
    data: feedItems(...pinIds),
    bookmark: "-end-"
  }),
  "BoardSectionsResource/get": () => ({ data: [] }),
  "BoardSectionPinsResource/get": () => ({ data: feedItems(...sectionPinIds) }),
  "BoardResource/create": () => ({ data: created }),
  "BoardSectionResource/create": () => ({
    data: { id: "sec", slug: "shuffled" }
  }),
  "ApiResource/create": () => ({ data: { id: "sec" } }),
  "RepinResource/create": save
});

const savesIn = (requests: FakeRequest[]) =>
  requests.filter((request) => request.resource === "RepinResource");

const batchesIn = (requests: FakeRequest[]) =>
  requests
    .filter((request) => request.resource === "ApiResource")
    .map((request) => request.options.data as { pins: string[] });

async function runMix(
  input: Partial<MixInput> = {}
): Promise<{ result: MixResult; progress: MixProgress[] }> {
  mock.timers.enable({ apis: ["setTimeout"] });

  const progress: MixProgress[] = [];
  const pending = mix({
    target: { board, section: null },
    name: "grad poses shuffled",
    seed: "",
    keepSections: true,
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

describe("mix on a board", () => {
  it("saves every pin into a fresh board in a seeded order", async () => {
    const requests = installFakePinterest(routes(saveOk));
    const { result, progress } = await runMix({ seed: "cozy" });
    const saves = savesIn(requests);
    const savedOrder = saves.map((request) => request.options.pin_id);

    assert.deepEqual(result, { url: created.url, saved: 6, total: 6 });
    assert.deepEqual([...savedOrder].sort(), pinIds);
    assert.notDeepEqual(savedOrder, pinIds);
    assert.ok(saves.every((request) => request.options.board_id === "new"));
    assert.equal(requests[0].resource, "BoardResource");
    assert.equal(requests[0].action, "create");
    assert.deepEqual(progress[0], { phase: "creating", done: 0, total: 3 });
    assert.deepEqual(progress[1], { phase: "loading", done: 6, total: 3 });
    assert.deepEqual(progress.at(-1), { phase: "saving", done: 6, total: 6 });

    const again = installFakePinterest(routes(saveOk));

    await runMix({ seed: "cozy" });

    assert.deepEqual(
      savesIn(again).map((request) => request.options.pin_id),
      savedOrder
    );
  });

  it("recreates sections and adds their shuffled pins in batches", async () => {
    const requests = installFakePinterest({
      ...routes(saveOk),
      "BoardSectionsResource/get": () => ({ data: [sectionData] })
    });
    const { result, progress } = await runMix({ seed: "cozy" });
    const batches = batchesIn(requests);
    const batchedIds = batches.flatMap((batch) => batch.pins);
    const createSection = requests.find(
      (request) => request.resource === "BoardSectionResource"
    );

    assert.deepEqual(result, { url: created.url, saved: 66, total: 66 });
    assert.deepEqual(createSection?.options, {
      board_id: "new",
      name: section.title
    });
    assert.deepEqual(
      [...savesIn(requests).map((request) => request.options.pin_id)].sort(),
      pinIds
    );
    assert.deepEqual(
      batches.map((batch) => batch.pins.length),
      [50, 10]
    );
    assert.deepEqual([...batchedIds].sort(), [...sectionPinIds].sort());
    assert.notDeepEqual(batchedIds, sectionPinIds);
    assert.deepEqual(progress[2], { phase: "loading", done: 66, total: 3 });
  });

  it("mixes section pins into the board when sections are not kept", async () => {
    const requests = installFakePinterest({
      ...routes(saveOk),
      "BoardSectionsResource/get": () => ({ data: [sectionData] })
    });
    const { result } = await runMix({ keepSections: false });
    const savedIds = savesIn(requests).map((request) => request.options.pin_id);

    assert.deepEqual(result, { url: created.url, saved: 66, total: 66 });
    assert.deepEqual(
      [...savedIds].sort(),
      [...pinIds, ...sectionPinIds].sort()
    );
    assert.ok(
      requests.every(
        (request) =>
          request.resource !== "BoardSectionResource" &&
          request.resource !== "ApiResource"
      )
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

        return pinId === "5" ? { status: 500 } : saveOk(options);
      })
    );
    const { result } = await runMix();

    assert.deepEqual(result, { url: created.url, saved: 5, total: 6 });
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

    assert.deepEqual(result, { url: created.url, saved: 2, total: 6 });
    assert.equal(savesIn(requests).length, 2);
  });

  it("refuses an empty board before touching pinterest", async () => {
    const requests = installFakePinterest(routes(saveOk));

    await assert.rejects(
      runMix({ target: { board: { ...board, pinCount: 0 }, section: null } }),
      /this board has no pins/
    );
    assert.equal(requests.length, 0);
  });

  it("gives back the new board when stopped while loading", async () => {
    const controller = new AbortController();
    const requests = installFakePinterest({
      ...routes(saveOk),
      "BoardFeedResource/get": () => {
        controller.abort();
        return { data: feedItems(...pinIds), bookmark: "-end-" };
      }
    });
    const { result } = await runMix({ signal: controller.signal });

    assert.deepEqual(result, { url: created.url, saved: 0, total: 0 });
    assert.equal(savesIn(requests).length, 0);
  });
});

describe("mix on a section", () => {
  it("copies the pins into a new section on the same board", async () => {
    const requests = installFakePinterest(routes(saveOk));
    const { result, progress } = await runMix({
      target: { board, section },
      name: "day one shuffled"
    });
    const saves = savesIn(requests);
    const savedIds = saves.map((request) => request.options.pin_id);
    const batches = batchesIn(requests);

    assert.deepEqual(result, {
      url: `${boardPath}shuffled/`,
      saved: 60,
      total: 60
    });
    assert.ok(saves.every((request) => request.options.board_id === board.id));
    assert.deepEqual([...savedIds].sort(), [...sectionPinIds].sort());
    assert.notDeepEqual(savedIds, sectionPinIds);
    assert.deepEqual(
      batches.flatMap((batch) => batch.pins),
      savedIds.map((pinId) => `copy-${pinId}`)
    );
    assert.deepEqual(
      batches.map((batch) => batch.pins.length),
      [50, 10]
    );
    assert.ok(
      requests.every((request) => request.resource !== "BoardResource")
    );
    assert.deepEqual(progress[0], { phase: "creating", done: 0, total: 2 });
    assert.deepEqual(progress[1], { phase: "loading", done: 60, total: 2 });
  });

  it("still files the copies made before a stop", async () => {
    const controller = new AbortController();
    const requests = installFakePinterest(routes(saveOk));
    const { result } = await runMix({
      target: { board, section },
      signal: controller.signal,
      onProgress: ({ phase, done }) => {
        if (phase === "saving" && done === 3) {
          controller.abort();
        }
      }
    });

    assert.deepEqual(result, {
      url: `${boardPath}shuffled/`,
      saved: 3,
      total: 60
    });
    assert.deepEqual(
      batchesIn(requests).map((batch) => batch.pins.length),
      [3]
    );
  });
});
