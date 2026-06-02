import { ROUTES } from "@stackmatch/config";
import { describe, expect, it } from "vitest";

import { resolveNotificationActionTarget } from "../navigation";

describe("resolveNotificationActionTarget", () => {
  it("converts same-origin absolute URLs to internal paths", () => {
    expect(
      resolveNotificationActionTarget(
        "http://stackmatch-web.localhost:1355/octocat?tab=stars#top",
        "http://stackmatch-web.localhost:1355"
      )
    ).toBe("/octocat?tab=stars#top");
  });

  it("converts siteConfig URLs to internal paths when running locally", () => {
    expect(
      resolveNotificationActionTarget(
        "https://stackmatch.dev/octocat",
        "http://stackmatch-web.localhost:1355"
      )
    ).toBe("/octocat");
  });

  it("keeps relative paths internal", () => {
    expect(resolveNotificationActionTarget("messages/conv_123", "https://stackmatch.dev")).toBe(
      "/messages/conv_123"
    );
    expect(resolveNotificationActionTarget("/notifications", "https://stackmatch.dev")).toBe(
      "/notifications"
    );
  });

  it("keeps external http URLs as same-tab external targets", () => {
    expect(
      resolveNotificationActionTarget("https://example.com/path", "https://stackmatch.dev")
    ).toBe("https://example.com/path");
  });

  it("falls back for missing, invalid, or unsupported URLs", () => {
    expect(resolveNotificationActionTarget(undefined, "https://stackmatch.dev")).toBe(
      ROUTES.notifications
    );
    expect(
      resolveNotificationActionTarget("mailto:hello@stackmatch.dev", "https://stackmatch.dev")
    ).toBe(ROUTES.notifications);
    expect(resolveNotificationActionTarget("//example.com/path", "https://stackmatch.dev")).toBe(
      ROUTES.notifications
    );
  });
});
