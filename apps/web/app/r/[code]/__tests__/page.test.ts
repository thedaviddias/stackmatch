import { describe, expect, it, vi } from "vitest";
import ReferralPage, { generateMetadata } from "../page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url}` });
  }),
}));

describe("/r/[code] page", () => {
  it("returns retired noindex metadata for legacy referral links", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ code: "ALPHA1" }),
    });

    expect(metadata.title).toBe("stackmatch.dev");
    expect(metadata.alternates?.canonical?.toString()).toContain("/r/ALPHA1");
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it("redirects legacy referral links to the retired path", async () => {
    await expect(ReferralPage({ params: Promise.resolve({ code: "ALPHA1" }) })).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    const { redirect } = await import("next/navigation");
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
