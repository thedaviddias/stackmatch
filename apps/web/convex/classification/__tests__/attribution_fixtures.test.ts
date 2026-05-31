import { describe, expect, it } from "vitest";
import { classifyPRAuthor } from "../../github/classify_prs";
import { classifyCommit } from "../bot_detector";
import { buildDetailedBreakdowns } from "../detailed_breakdown";
import {
  BREAKDOWN_FIXTURES,
  buildBreakdownCommit,
  COMMIT_CLASSIFICATION_FIXTURES,
  PR_CLASSIFICATION_FIXTURES,
} from "./fixtures/attribution_fixtures";

describe("attribution fixtures: commit classification", () => {
  for (const fixture of COMMIT_CLASSIFICATION_FIXTURES) {
    it(fixture.name, () => {
      expect(classifyCommit(fixture.commit).classification).toBe(fixture.expected);
    });
  }
});

describe("attribution fixtures: PR classification", () => {
  for (const fixture of PR_CLASSIFICATION_FIXTURES) {
    it(fixture.name, () => {
      expect(classifyPRAuthor(fixture.pr)).toBe(fixture.expected);
    });
  }
});

describe("attribution fixtures: detailed breakdown", () => {
  for (const fixture of BREAKDOWN_FIXTURES) {
    it(fixture.name, () => {
      const commits = fixture.commits.map((commit) => buildBreakdownCommit(commit));
      const { toolBreakdown, botBreakdown } = buildDetailedBreakdowns(commits as never);

      if (fixture.expectedAiKeys) {
        const keys = toolBreakdown.map((entry) => entry.key);
        for (const expectedKey of fixture.expectedAiKeys) {
          expect(keys).toContain(expectedKey);
        }
      }

      if (fixture.expectedBotKeys) {
        const keys = botBreakdown.map((entry) => entry.key);
        for (const expectedKey of fixture.expectedBotKeys) {
          expect(keys).toContain(expectedKey);
        }
      }
    });
  }
});
