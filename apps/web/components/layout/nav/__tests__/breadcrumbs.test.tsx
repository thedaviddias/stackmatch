import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Breadcrumbs } from "../breadcrumbs";

// Mock the siteConfig used for JSON-LD
vi.mock("@/lib/re-exports/constants", () => ({
  siteConfig: { url: "https://stackmatch.dev" },
}));

afterEach(() => {
  cleanup();
});

const sampleItems = [
  { label: "Home", href: "/" },
  { label: "Docs", href: "/docs" },
  { label: "Ranks", href: "/docs/ranks" },
];

describe("Breadcrumbs accessibility", () => {
  it("should have no axe violations", async () => {
    const { container } = render(
      <main>
        <Breadcrumbs items={sampleItems} />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have a nav element with aria-label=Breadcrumb", () => {
    render(<Breadcrumbs items={sampleItems} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toBeInTheDocument();
  });

  it("should use an ordered list", () => {
    render(<Breadcrumbs items={sampleItems} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const list = within(nav).getByRole("list");
    expect(list).toBeInTheDocument();
  });

  it("should mark the last item with aria-current=page", () => {
    render(<Breadcrumbs items={sampleItems} />);
    const currentPage = screen.getByText("Ranks");
    expect(currentPage).toHaveAttribute("aria-current", "page");
  });

  it("should have aria-hidden on separator icons", () => {
    const { container } = render(<Breadcrumbs items={sampleItems} />);
    const separatorSvgs = container.querySelectorAll("svg");
    for (const svg of separatorSvgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("should render links for non-last items", () => {
    render(<Breadcrumbs items={sampleItems} />);
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Docs" })).toBeInTheDocument();
    // Last item should NOT be a link
    expect(screen.queryByRole("link", { name: "Ranks" })).not.toBeInTheDocument();
  });
});
