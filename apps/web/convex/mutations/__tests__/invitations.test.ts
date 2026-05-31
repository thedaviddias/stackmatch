import { describe, expect, it } from "vitest";
import {
  isAnnouncementEligible,
  isInvitationReusable,
  selectReusableInvitation,
  validateRedemption,
} from "../invitations";

describe("validateRedemption", () => {
  const now = 1000;

  it("returns success for a valid non-expired token", () => {
    const invite = { email: "test@example.com", expiresAt: 2000 };
    const result = validateRedemption(invite, now);
    expect(result).toEqual({ success: true, email: "test@example.com" });
  });

  it("returns error for an expired token", () => {
    const invite = { email: "test@example.com", expiresAt: 500 };
    const result = validateRedemption(invite, now);
    expect(result).toEqual({ success: false, reason: "expired_token" });
  });

  it("returns error for an already-used token", () => {
    const invite = { email: "test@example.com", expiresAt: 2000, usedAt: 900 };
    const result = validateRedemption(invite, now);
    expect(result).toEqual({ success: false, reason: "used_token" });
  });

  it("returns error if invite is null", () => {
    const result = validateRedemption(null, now);
    expect(result).toEqual({ success: false, reason: "invalid_token" });
  });
});

describe("invite resend helpers", () => {
  const now = 10_000;

  it("treats waitlist users as eligible only when announcement was sent", () => {
    expect(isAnnouncementEligible(null)).toBe(false);
    expect(isAnnouncementEligible({ announcementStatus: "pending", githubHandle: undefined })).toBe(
      false
    );
    expect(isAnnouncementEligible({ announcementStatus: "sent", githubHandle: "octocat" })).toBe(
      true
    );
  });

  it("reuses unexpired unused invitation tokens", () => {
    const reusable = {
      token: "inv_ABC12345",
      expiresAt: now + 1000,
      usedAt: undefined,
    };
    expect(isInvitationReusable(reusable, now)).toBe(true);

    const selected = selectReusableInvitation(
      [{ token: "inv_used", expiresAt: now + 1000, usedAt: now - 100 }, reusable],
      now
    );
    expect(selected).toEqual(reusable);
  });

  it("returns null when all invitations are used or expired", () => {
    const selected = selectReusableInvitation(
      [
        { token: "inv_used", expiresAt: now + 1000, usedAt: now - 1 },
        { token: "inv_expired", expiresAt: now - 1, usedAt: undefined },
      ],
      now
    );
    expect(selected).toBeNull();
  });
});
