import { describe, expect, it } from "vitest";
import { parseMaintainedPackageManifest, parsePackageManifest } from "../package_manifest";

describe("parsePackageManifest", () => {
  it("parses dependencies and devDependencies", () => {
    const raw = JSON.stringify({
      dependencies: { react: "^19.0.0", next: "16.1.6" },
      devDependencies: { vitest: "^4.0.0" },
    });

    const result = parsePackageManifest(raw, "package.json");

    expect(result).toEqual([
      {
        packageName: "next",
        section: "dependencies",
        sourcePath: "package.json",
        versionRange: "16.1.6",
      },
      {
        packageName: "react",
        section: "dependencies",
        sourcePath: "package.json",
        versionRange: "^19.0.0",
      },
      {
        packageName: "vitest",
        section: "devDependencies",
        sourcePath: "package.json",
        versionRange: "^4.0.0",
      },
    ]);
  });

  it("returns empty array for invalid json", () => {
    expect(parsePackageManifest("{oops", "package.json")).toEqual([]);
  });

  it("normalizes package names and dedupes within the same section", () => {
    const raw = JSON.stringify({
      dependencies: {
        React: "^19.0.0",
        react: "^19.1.0",
      },
      devDependencies: {
        REACT: "^19.2.0",
      },
    });

    const result = parsePackageManifest(raw, "packages/app/package.json");

    expect(result).toEqual([
      {
        packageName: "react",
        section: "dependencies",
        sourcePath: "packages/app/package.json",
        versionRange: "^19.0.0",
      },
      {
        packageName: "react",
        section: "devDependencies",
        sourcePath: "packages/app/package.json",
        versionRange: "^19.2.0",
      },
    ]);
  });

  it("ignores non-string dependency versions", () => {
    const raw = JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        invalid: 123,
      },
    });

    expect(parsePackageManifest(raw, "package.json")).toEqual([
      {
        packageName: "react",
        section: "dependencies",
        sourcePath: "package.json",
        versionRange: "^19.0.0",
      },
    ]);
  });

  it("excludes @types/* packages from both dependencies and devDependencies", () => {
    const raw = JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        "@types/react": "^19.0.0",
        next: "^15.0.0",
        "@types/node": "^22.0.0",
      },
      devDependencies: {
        vitest: "^4.0.0",
        "@types/jest": "^29.0.0",
        "@types/mdx": "^2.0.13",
      },
    });

    const result = parsePackageManifest(raw, "package.json");
    const packageNames = result.map((e) => e.packageName);

    expect(packageNames).toContain("react");
    expect(packageNames).toContain("next");
    expect(packageNames).toContain("vitest");
    expect(packageNames).not.toContain("@types/react");
    expect(packageNames).not.toContain("@types/node");
    expect(packageNames).not.toContain("@types/jest");
    expect(packageNames).not.toContain("@types/mdx");
  });

  it("excludes @babel/* packages from both dependencies and devDependencies", () => {
    const raw = JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        "@babel/runtime": "^7.28.0",
      },
      devDependencies: {
        "@babel/core": "^7.28.0",
        "@babel/preset-env": "^7.28.0",
        "@babel/plugin-transform-runtime": "^7.28.0",
        vitest: "^4.0.0",
      },
    });

    const result = parsePackageManifest(raw, "package.json");
    const packageNames = result.map((e) => e.packageName);

    expect(packageNames).toContain("react");
    expect(packageNames).toContain("vitest");
    expect(packageNames).not.toContain("@babel/runtime");
    expect(packageNames).not.toContain("@babel/core");
    expect(packageNames).not.toContain("@babel/preset-env");
    expect(packageNames).not.toContain("@babel/plugin-transform-runtime");
  });

  it("excludes @types/* even when they are the only packages", () => {
    const raw = JSON.stringify({
      devDependencies: {
        "@types/react": "^19.0.0",
        "@types/node": "^22.0.0",
      },
    });

    expect(parsePackageManifest(raw, "package.json")).toEqual([]);
  });

  it("parses pinned and ranged Python requirements", () => {
    const raw = ["Flask==3.0.0", "google-api-python-client>=2", "requests", "NumPy~=1.26"].join(
      "\n"
    );

    expect(parsePackageManifest(raw, "requirements.txt")).toEqual([
      {
        packageName: "flask",
        section: "dependencies",
        sourcePath: "requirements.txt",
        versionRange: "==3.0.0",
      },
      {
        packageName: "google-api-python-client",
        section: "dependencies",
        sourcePath: "requirements.txt",
        versionRange: ">=2",
      },
      {
        packageName: "numpy",
        section: "dependencies",
        sourcePath: "requirements.txt",
        versionRange: "~=1.26",
      },
      {
        packageName: "requests",
        section: "dependencies",
        sourcePath: "requirements.txt",
        versionRange: "*",
      },
    ]);
  });

  it("normalizes Python requirement names and strips extras", () => {
    const raw = ["pandas[excel]>=2; python_version >= '3.11'", "Google.Auth_OAuthLib>=1.2"].join(
      "\n"
    );

    expect(parsePackageManifest(raw, "apps/api/requirements.txt")).toEqual([
      {
        packageName: "google-auth-oauthlib",
        section: "dependencies",
        sourcePath: "apps/api/requirements.txt",
        versionRange: ">=1.2",
      },
      {
        packageName: "pandas",
        section: "dependencies",
        sourcePath: "apps/api/requirements.txt",
        versionRange: ">=2; python_version >= '3.11'",
      },
    ]);
  });

  it("ignores comments, pip options, editables, urls, and local paths in requirements", () => {
    const raw = [
      "# comment",
      "",
      "flask>=3 # web framework",
      "-r base.txt",
      "--index-url https://example.com/simple",
      "-e git+https://github.com/example/project.git#egg=project",
      "git+https://github.com/example/other.git",
      "https://example.com/archive.zip",
      "./local-package",
      "../parent-package",
      "/opt/package",
      "local-pkg @ file:///opt/local-pkg",
    ].join("\n");

    expect(parsePackageManifest(raw, "requirements.txt")).toEqual([
      {
        packageName: "flask",
        section: "dependencies",
        sourcePath: "requirements.txt",
        versionRange: ">=3",
      },
    ]);
  });

  it("returns empty array for unsupported manifest files", () => {
    expect(parsePackageManifest("flask==3", "requirements-dev.txt")).toEqual([]);
  });
});

describe("parseMaintainedPackageManifest", () => {
  it("extracts and normalizes the package.json package name", () => {
    const raw = JSON.stringify({
      name: "@StackMatch/Web",
      dependencies: { react: "^19.0.0" },
    });

    expect(parseMaintainedPackageManifest(raw, "apps/web/package.json")).toEqual({
      packageName: "@stackmatch/web",
      sourcePath: "apps/web/package.json",
      confidence: "package-json-name",
    });
  });

  it("returns null when package.json has no string name", () => {
    expect(
      parseMaintainedPackageManifest(JSON.stringify({ dependencies: {} }), "package.json")
    ).toBeNull();
    expect(
      parseMaintainedPackageManifest(JSON.stringify({ name: 123 }), "package.json")
    ).toBeNull();
  });

  it("does not infer maintained packages from requirements.txt", () => {
    expect(parseMaintainedPackageManifest("flask==3", "requirements.txt")).toBeNull();
  });
});
