import { describe, expect, it } from "bun:test";
import { hasDuplicatePathSlashes } from "./request-path";

describe("hasDuplicatePathSlashes", () => {
  it("detects duplicate slashes in the request path", () => {
    expect(
      hasDuplicatePathSlashes(
        new Request("http://localhost//api/v1/session/"),
      ),
    ).toBe(true);
  });

  it("allows a normalized request path", () => {
    expect(
      hasDuplicatePathSlashes(
        new Request("http://localhost/api/v1/session/"),
      ),
    ).toBe(false);
  });
});
