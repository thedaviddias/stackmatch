import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClaimProfileBanner } from "../claim-profile-banner";

vi.mock("@/lib/auth/login-url", () => ({
  buildLoginUrlForCurrentLocation: () => "/login?returnTo=%2Foctocat",
}));

describe("ClaimProfileBanner", () => {
  it("renders a developer claim CTA", () => {
    render(<ClaimProfileBanner owner="octocat" ownerType="developer" />);

    expect(screen.getByText("Is this you, @octocat?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /claim profile/i }).getAttribute("href")).toContain(
      "/login"
    );
  });

  it("renders an organization verification CTA", () => {
    render(<ClaimProfileBanner owner="stackmatch-labs" ownerType="organization" />);

    expect(screen.getByText("Manage @stackmatch-labs?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /verify organization/i })).toHaveAttribute(
      "href",
      "/api/github-app/install"
    );
  });
});
