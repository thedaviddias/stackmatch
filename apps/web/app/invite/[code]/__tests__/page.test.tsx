import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import InvitePage from "../page";

vi.mock("../invite-redirect", () => ({
  InviteRedirect: ({ code }: { code: string }) => <div data-invite-code={code} />,
}));

vi.mock("@/components/layout/background-orbs", () => ({
  BackgroundOrbs: () => null,
}));

describe("InvitePage", () => {
  it("renders the referral invite redemption client flow", async () => {
    const result = await InvitePage({
      params: Promise.resolve({ code: "ALPHA1" }),
    });

    const markup = renderToStaticMarkup(result);
    expect(markup).toContain('data-invite-code="ALPHA1"');
  });
});
