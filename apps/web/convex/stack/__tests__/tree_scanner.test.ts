import { describe, expect, it } from "vitest";
import { buildPackageManifestFingerprint, selectDependencyManifestPaths } from "../tree_scanner";

describe("selectDependencyManifestPaths", () => {
  it("selects root and nested package.json and requirements.txt files sorted by depth", () => {
    const tree = [
      { path: "packages/z/package.json", type: "blob" },
      { path: "apps/web/package.json", type: "blob" },
      { path: "services/api/requirements.txt", type: "blob" },
      { path: "package.json", type: "blob" },
      { path: "requirements.txt", type: "blob" },
      { path: "README.md", type: "blob" },
    ];

    expect(selectDependencyManifestPaths(tree)).toEqual([
      "package.json",
      "requirements.txt",
      "apps/web/package.json",
      "packages/z/package.json",
      "services/api/requirements.txt",
    ]);
  });

  it("ignores non-blob nodes and non-package files", () => {
    const tree = [
      { path: "apps/web", type: "tree" },
      { path: "pnpm-workspace.yaml", type: "blob" },
      { path: "apps/web/package.json", type: "blob" },
      { path: "apps/web/requirements-dev.txt", type: "blob" },
    ];

    expect(selectDependencyManifestPaths(tree)).toEqual(["apps/web/package.json"]);
  });

  it("respects max manifest limit", () => {
    const tree = [
      { path: "package.json", type: "blob" },
      { path: "requirements.txt", type: "blob" },
      { path: "a/package.json", type: "blob" },
      { path: "b/package.json", type: "blob" },
    ];

    expect(selectDependencyManifestPaths(tree, 2)).toEqual(["package.json", "requirements.txt"]);
  });
});

describe("buildPackageManifestFingerprint", () => {
  it("is deterministic for equivalent trees regardless of node order", () => {
    const a = [
      { path: "apps/web/package.json", type: "blob", sha: "111" },
      { path: "package.json", type: "blob", sha: "000" },
      { path: "README.md", type: "blob", sha: "zzz" },
    ];
    const b = [
      { path: "README.md", type: "blob", sha: "zzz" },
      { path: "package.json", type: "blob", sha: "000" },
      { path: "apps/web/package.json", type: "blob", sha: "111" },
    ];

    expect(buildPackageManifestFingerprint(a)).toBe(buildPackageManifestFingerprint(b));
  });

  it("changes when package manifest sha changes", () => {
    const base = [
      { path: "package.json", type: "blob", sha: "000" },
      { path: "apps/web/package.json", type: "blob", sha: "111" },
      { path: "requirements.txt", type: "blob", sha: "222" },
    ];
    const changed = [
      { path: "package.json", type: "blob", sha: "000" },
      { path: "apps/web/package.json", type: "blob", sha: "222" },
      { path: "requirements.txt", type: "blob", sha: "222" },
    ];
    const changedRequirements = [
      { path: "package.json", type: "blob", sha: "000" },
      { path: "apps/web/package.json", type: "blob", sha: "111" },
      { path: "requirements.txt", type: "blob", sha: "333" },
    ];

    expect(buildPackageManifestFingerprint(base)).not.toBe(
      buildPackageManifestFingerprint(changed)
    );
    expect(buildPackageManifestFingerprint(base)).not.toBe(
      buildPackageManifestFingerprint(changedRequirements)
    );
  });

  it("returns null when a selected manifest is missing sha", () => {
    const tree = [
      { path: "package.json", type: "blob" },
      { path: "apps/web/package.json", type: "blob", sha: "111" },
    ];

    expect(buildPackageManifestFingerprint(tree)).toBeNull();
  });

  it("ignores non-manifest files", () => {
    const tree = [
      { path: "package.json", type: "blob", sha: "000" },
      { path: "README.md", type: "blob", sha: "abc" },
      { path: "notes/package-lock.json", type: "blob", sha: "def" },
    ];

    expect(buildPackageManifestFingerprint(tree)).toBeTruthy();
  });
});
