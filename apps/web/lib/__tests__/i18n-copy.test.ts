import { describe, expect, it } from "vitest";
import { getI18n } from "@/lib/re-exports/i18n";

describe("localization dictionary", () => {
  it("returns the english dictionary by default", () => {
    const i18n = getI18n();
    expect(i18n.metadata.pages.developers.title).toBe("All Developers");
    expect(i18n.navigation.docs.items.length).toBeGreaterThan(0);
  });

  it("supports typed dynamic metadata strings", () => {
    const i18n = getI18n();
    expect(i18n.metadata.pages.owner.title("vercel")).toBe("@vercel stack mates");
    expect(i18n.metadata.pages.package.title("react")).toBe("react — Package Stats");
  });

  it("supports typed dynamic feedback strings", () => {
    const i18n = getI18n();
    expect(i18n.feedback.login.matchSuccess("octocat")).toContain("@octocat");
    expect(i18n.feedback.login.starSuccess("octocat")).toBe("Starred @octocat!");
  });
});
