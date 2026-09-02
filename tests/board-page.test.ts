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

  it("reads the section slug from a section url", () => {
    assert.deepEqual(parseBoardPath("/thejoshuajohns/grad-poses/day-one/"), {
      username: "thejoshuajohns",
      slug: "grad-poses",
      section: "day-one"
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
      "/thejoshuajohns/grad-poses/_tools/",
      "/thejoshuajohns/grad-poses/day-one/extra/"
    ]) {
      assert.equal(parseBoardPath(pathname), null, pathname);
    }
  });
});
