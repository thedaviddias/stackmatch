import { describe, expect, it } from "vitest";
import { openSourceProjects } from "../projects";

describe("openSourceProjects", () => {
  it("contains at least 1 project", () => {
    expect(openSourceProjects.length).toBeGreaterThanOrEqual(1);
  });

  it("each project has required fields", () => {
    for (const project of openSourceProjects) {
      expect(project.name).toBeTruthy();
      expect(project.description).toBeTruthy();
      expect(project.url).toMatch(/^https:\/\/github\.com\//);
    }
  });

  it("projects with siteUrl have valid URLs", () => {
    for (const project of openSourceProjects) {
      if (project.siteUrl) {
        expect(project.siteUrl).toMatch(/^https:\/\//);
      }
    }
  });
});
