import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBoardPath } from "../src/board-page.ts";

describe("parseBoardPath", () => {
  it("reads the username and slug from a board url", () => {
    assert.deepEqual(parseBoardPath("/thejoshuajohns/grad-poses/"), {
      username: "thejoshuajohns",
      slug: "grad-poses"
    });
  });

  it("ignores pages that are not boards", () => {
    for (const pathname of [
      "/",
      "/thejoshuajohns/",
      "/pin/767511961543969865/",
      "/search/pins/",
      "/ideas/graduation/",
      "/thejoshuajohns/_saved/",
      "/thejoshuajohns/grad-poses/day-one/"
    ]) {
      assert.equal(parseBoardPath(pathname), null, pathname);
    }
  });
});
