import { describe, expect, it } from "vitest";
import { buildPackageSignalAuditReport, classifyPackageSignal } from "../package_signal_audit";

describe("package signal audit", () => {
  it("classifies hard-noise, low-signal, and normal npm packages", () => {
    expect(classifyPackageSignal("@types/react")).toBe("hardNoise");
    expect(classifyPackageSignal("lefthook")).toBe("lowSignal");
    expect(classifyPackageSignal("@commitlint/cli")).toBe("lowSignal");
    expect(classifyPackageSignal("@changesets/cli")).toBe("lowSignal");
    expect(classifyPackageSignal("react-dom")).toBe("normal");
    expect(classifyPackageSignal("@radix-ui/react-tooltip")).toBe("normal");
  });

  it("suggests low-signal review for common devDependency-heavy packages", () => {
    const report = buildPackageSignalAuditReport([
      {
        packageName: "candidate-tool",
        ownerCount: 8,
        repoCount: 10,
        depCount: 1,
        devDepCount: 9,
      },
      {
        packageName: "runtime-lib",
        ownerCount: 8,
        repoCount: 10,
        depCount: 8,
        devDepCount: 2,
      },
    ]);

    expect(report[0]).toMatchObject({
      packageName: "candidate-tool",
      currentClassification: "normal",
      suggestedClassification: "lowSignal",
    });
    expect(report[1]).toMatchObject({
      packageName: "runtime-lib",
      currentClassification: "normal",
      suggestedClassification: "normal",
    });
  });
});
