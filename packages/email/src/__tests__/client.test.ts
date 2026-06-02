import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../client";
import { EMAIL_DEFAULTS } from "../keys";

const resendMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: resendMocks.send,
    };
  },
}));

describe("sendEmail", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resendMocks.send.mockReset();
  });

  it("uses a monitored default sender", () => {
    expect(EMAIL_DEFAULTS.from).toBe("Stackmatch <hello@mail.stackmatch.dev>");
    expect(EMAIL_DEFAULTS.replyTo).toBe("hello@stackmatch.dev");
    expect(EMAIL_DEFAULTS.from).not.toMatch(/no[-_.\s]?reply/i);
    expect(EMAIL_DEFAULTS.replyTo).not.toMatch(/no[-_.\s]?reply/i);
  });

  it("rejects no-reply from overrides before sending", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      from: "Stackmatch <no-reply@mail.stackmatch.dev>",
      react: createElement("div", null, "Hello"),
    });

    expect(result).toEqual({
      success: false,
      error: "Email from address must not use a no-reply mailbox.",
    });
    expect(resendMocks.send).not.toHaveBeenCalled();
  });

  it("rejects noreply reply-to overrides before sending", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      replyTo: "noreply@stackmatch.dev",
      react: createElement("div", null, "Hello"),
    });

    expect(result).toEqual({
      success: false,
      error: "Email replyTo address must not use a no-reply mailbox.",
    });
    expect(resendMocks.send).not.toHaveBeenCalled();
  });

  it("passes monitored defaults to Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-api-key");
    resendMocks.send.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      react: createElement("div", null, "Hello"),
    });

    expect(result).toEqual({ success: true, id: "email_123" });
    expect(resendMocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: EMAIL_DEFAULTS.from,
        replyTo: EMAIL_DEFAULTS.replyTo,
      })
    );
  });
});
