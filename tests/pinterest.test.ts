import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addSectionPins,
  createBoard,
  createSection,
  fetchBoardPinIds,
  fetchSectionPinIds,
  getBoard,
  getSections,
  getTarget,
  savePin
} from "../src/pinterest.ts";
import {
  board,
  boardPath,
  feedItems,
  installFakePinterest,
  section,
  sectionData,
  type FakeRoute
} from "./fake-pinterest.ts";

const boardData = {
  id: board.id,
  name: board.name,
  url: boardPath,
  pin_count: 3,
  section_count: 0,
  privacy: "public"
};
const boardRoute: FakeRoute = () => ({ data: boardData });
const sectionsRoute: FakeRoute = () => ({ data: [sectionData] });

describe("getBoard", () => {
  it("loads the board by username and slug", async () => {
    const requests = installFakePinterest({ "BoardResource/get": boardRoute });

    assert.deepEqual(
      await getBoard({ username: "thejoshuajohns", slug: "grad-poses" }),
      board
    );
    assert.deepEqual(requests[0].options, {
      username: "thejoshuajohns",
      slug: "grad-poses",
      field_set_key: "detailed"
    });
    assert.equal(
      requests[0].headers["x-pinterest-pws-handler"],
      "www/[username]/[slug].js"
    );
  });

  it("treats anything that is not secret as public", async () => {
    installFakePinterest({
      "BoardResource/get": () => ({
        data: { ...boardData, privacy: "protected" }
      })
    });

    const loaded = await getBoard({ username: "x", slug: "y" });

    assert.equal(loaded.privacy, "public");
  });

  it("prefers pinterest's detailed error message", async () => {
    installFakePinterest({
      "BoardResource/get": () => ({
        status: 404,
        error: { message: "Invalid parameters.", message_detail: "no board" }
      })
    });

    await assert.rejects(
      getBoard({ username: "nobody", slug: "nothing" }),
      /^Error: no board$/
    );
  });
});

describe("getSections", () => {
  it("lists the sections of a board", async () => {
    const requests = installFakePinterest({
      "BoardSectionsResource/get": sectionsRoute
    });

    assert.deepEqual(await getSections(board), [section]);
    assert.deepEqual(requests[0].options, { board_id: board.id });
  });
});

describe("getTarget", () => {
  it("returns just the board for a board url", async () => {
    const requests = installFakePinterest({ "BoardResource/get": boardRoute });

    assert.deepEqual(
      await getTarget({ username: "thejoshuajohns", slug: "grad-poses" }),
      { board, section: null }
    );
    assert.equal(requests.length, 1);
  });

  it("finds the section matching the url slug", async () => {
    installFakePinterest({
      "BoardResource/get": boardRoute,
      "BoardSectionsResource/get": sectionsRoute
    });

    assert.deepEqual(
      await getTarget({
        username: "thejoshuajohns",
        slug: "grad-poses",
        section: "day-one"
      }),
      { board, section }
    );
  });

  it("fails when the section slug is unknown", async () => {
    installFakePinterest({
      "BoardResource/get": boardRoute,
      "BoardSectionsResource/get": sectionsRoute
    });

    await assert.rejects(
      getTarget({
        username: "thejoshuajohns",
        slug: "grad-poses",
        section: "nope"
      }),
      /no section called nope/
    );
  });
});

describe("fetchBoardPinIds", () => {
  it("walks every page with bookmarks and drops repeats and non pins", async () => {
    const pages: Record<string, { data: unknown; bookmark: string }> = {
      first: {
        data: [...feedItems("1", "2"), { id: "x", type: "story" }],
        bookmark: "page2"
      },
      page2: { data: feedItems("2", "3"), bookmark: "-end-" }
    };
    const counts: number[] = [];
    const requests = installFakePinterest({
      "BoardFeedResource/get": (options) =>
        pages[
          String((options.bookmarks as string[] | undefined)?.[0] ?? "first")
        ]
    });

    assert.deepEqual(
      await fetchBoardPinIds(board, (count) => counts.push(count)),
      ["1", "2", "3"]
    );
    assert.deepEqual(counts, [2, 3]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.bookmarks, undefined);
    assert.equal(requests[0].options.filter_section_pins, true);
    assert.deepEqual(requests[1].options.bookmarks, ["page2"]);
  });

  it("stops when a page comes back empty", async () => {
    const requests = installFakePinterest({
      "BoardFeedResource/get": (options) =>
        options.bookmarks
          ? { data: [], bookmark: "more" }
          : { data: feedItems("1"), bookmark: "more" }
    });

    assert.deepEqual(await fetchBoardPinIds(board, () => undefined), ["1"]);
    assert.equal(requests.length, 2);
  });
});

describe("fetchSectionPinIds", () => {
  it("reads section pins in pages of at most 50", async () => {
    const requests = installFakePinterest({
      "BoardSectionPinsResource/get": () => ({ data: feedItems("1", "2") })
    });

    assert.deepEqual(await fetchSectionPinIds(section, () => undefined), [
      "1",
      "2"
    ]);
    assert.equal(requests[0].options.section_id, section.id);
    assert.equal(requests[0].options.page_size, 50);
  });
});

describe("createBoard", () => {
  it("posts a form body with the csrf token", async () => {
    const requests = installFakePinterest({
      "BoardResource/create": () => ({
        data: { id: "new", url: "/thejoshuajohns/grad-poses-shuffled/" }
      })
    });

    assert.deepEqual(await createBoard("grad poses shuffled", "secret"), {
      id: "new",
      url: "/thejoshuajohns/grad-poses-shuffled/"
    });
    assert.equal(requests[0].headers["x-csrftoken"], "token123");
    assert.equal(
      requests[0].headers["content-type"],
      "application/x-www-form-urlencoded"
    );
    assert.deepEqual(requests[0].options, {
      name: "grad poses shuffled",
      privacy: "secret",
      description: ""
    });
  });
});

describe("createSection", () => {
  it("creates a titled section and builds its url", async () => {
    const requests = installFakePinterest({
      "BoardSectionResource/create": () => ({
        data: { id: "sec", slug: "day-one-shuffled" }
      })
    });

    assert.deepEqual(await createSection(board, "day one shuffled"), {
      id: "sec",
      url: `${boardPath}day-one-shuffled/`
    });
    assert.deepEqual(requests[0].options, {
      board_id: board.id,
      name: "day one shuffled"
    });
  });
});

describe("addSectionPins", () => {
  it("adds a whole list to a section through the v3 proxy", async () => {
    const requests = installFakePinterest({
      "ApiResource/create": () => ({ data: { id: "sec", pin_count: 2 } })
    });

    await addSectionPins(["1", "2"], "sec");

    assert.deepEqual(requests[0].options, {
      url: "/v3/board/sections/sec/",
      data: { pins: ["1", "2"] }
    });
    assert.equal(requests[0].headers["x-csrftoken"], "token123");
  });
});

describe("savePin", () => {
  it("repins into the target board and returns the copy's id", async () => {
    const requests = installFakePinterest({
      "RepinResource/create": () => ({ data: { id: "saved" } })
    });

    assert.equal(await savePin("1", "new"), "saved");
    assert.deepEqual(requests[0].options, {
      board_id: "new",
      pin_id: "1",
      is_buyable_pin: false
    });
  });

  it("fails with the status when pinterest gives no message", async () => {
    installFakePinterest({
      "RepinResource/create": () => ({ status: 429 })
    });

    await assert.rejects(
      savePin("1", "new"),
      /RepinResource create failed \(429\)/
    );
  });
});
