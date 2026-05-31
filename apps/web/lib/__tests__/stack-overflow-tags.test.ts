import { describe, expect, it } from "vitest";
import { __private, resolveStackOverflowTag } from "../server/package-data/stack-overflow-tags";

describe("resolveStackOverflowTag", () => {
  it("uses overrides for known aliases", () => {
    expect(resolveStackOverflowTag("react")).toBe("reactjs");
    expect(resolveStackOverflowTag("next")).toBe("next.js");
  });

  it("normalizes scoped package names by stripping scope and symbols", () => {
    expect(resolveStackOverflowTag("@types/react")).toBe("reactjs");
    expect(resolveStackOverflowTag("@acme/super_pkg!")).toBe("superpkg");
  });

  it("falls back to normalized package name when no override exists", () => {
    expect(resolveStackOverflowTag("@scope/date-fns")).toBe("date-fns");
    expect(__private.normalizePackageName("@scope/@bad-name")).toBe("bad-name");
  });
});
