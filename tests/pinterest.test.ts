import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createBoard,
  fetchBoardPinIds,
  getBoard,
  savePin
} from "../src/pinterest.ts";
import {
  board,
  boardPath,
  feedItems,
  installFakePinterest
} from "./fake-pinterest.ts";

describe("getBoard", () => {
  it("loads the board by username and slug", async () => {
    const requests = installFakePinterest({
      "BoardResource/get": () => ({
        data: {
          id: board.id,
          name: board.name,
          url: boardPath,
          pin_count: 3,
          privacy: "public"
        }
      })
    });

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
        data: {
          id: "1",
          name: "x",
          url: "/x/y/",
          pin_count: 0,
          privacy: "protected"
        }
      })
    });

    const loaded = await getBoard({ username: "x", slug: "y" });

    assert.equal(loaded.privacy, "public");
  });

  it("surfaces pinterest's error message", async () => {
    installFakePinterest({
      "BoardResource/get": () => ({
        status: 404,
        error: { message: "Board not found." }
      })
    });

    await assert.rejects(
      getBoard({ username: "nobody", slug: "nothing" }),
      /Board not found\./
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
    assert.equal(requests[0].options.filter_section_pins, false);
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

describe("savePin", () => {
  it("repins into the target board", async () => {
    const requests = installFakePinterest({
      "RepinResource/create": () => ({ data: { id: "saved" } })
    });

    await savePin("1", "new");

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
