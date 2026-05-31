import { describe, expect, it } from "vitest";
import {
  buildMessageConversationNotificationUrl,
  buildNotificationsInboxUrl,
  buildOwnerProfileNotificationUrl,
} from "../notification_urls";

describe("notification URL helpers", () => {
  it("links owner notifications to the actual profile route", () => {
    expect(buildOwnerProfileNotificationUrl("octocat", "https://stackmatch.dev")).toBe(
      "https://stackmatch.dev/octocat"
    );
  });

  it("encodes owner profile route segments", () => {
    expect(buildOwnerProfileNotificationUrl("octo cat", "https://stackmatch.dev")).toBe(
      "https://stackmatch.dev/octo%20cat"
    );
  });

  it("links digest emails to the notifications inbox", () => {
    expect(buildNotificationsInboxUrl("https://stackmatch.dev")).toBe(
      "https://stackmatch.dev/notifications"
    );
  });

  it("links message notifications to the conversation route", () => {
    expect(buildMessageConversationNotificationUrl("conv_123", "https://stackmatch.dev")).toBe(
      "https://stackmatch.dev/messages/conv_123"
    );
  });

  it("uses the site config URL when no base URL is configured", () => {
    expect(buildNotificationsInboxUrl()).toBe("https://stackmatch.dev/notifications");
  });
});
