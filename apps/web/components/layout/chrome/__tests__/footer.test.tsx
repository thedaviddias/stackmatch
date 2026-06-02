import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DesignThemeProvider } from "@/components/providers/design-theme-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Footer } from "../footer";

function renderFooter() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DesignThemeProvider>
        <Footer />
      </DesignThemeProvider>
    </ThemeProvider>
  );
}

describe("Footer", () => {
  it("uses the shared brand dot instead of the SM logo", () => {
    const { container } = renderFooter();

    expect(screen.getByText("Stackmatch").parentElement).not.toHaveTextContent("SM");
    expect(container.querySelector("[data-theme-label='brand-mark']")).not.toBeInTheDocument();

    const brandDot = container.querySelector("[data-brand-pulse-dot]");
    expect(brandDot).toHaveAttribute("aria-hidden", "true");
    expect(brandDot).toHaveClass("relative", "flex", "size-2.5", "shrink-0");
    expect(container.querySelector("[data-brand-pulse-dot-halo]")).toHaveClass(
      "animate-ping",
      "bg-th-accent-1"
    );
    expect(container.querySelector("[data-brand-pulse-dot-core]")).toHaveClass("bg-th-accent-1");
  });

  it("renders ownership and copyright without exposing email addresses", () => {
    renderFooter();

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Copyright © 2026 David Dias Digital. All rights reserved. Source code available under the MIT License."
    );
    expect(
      screen.getByRole("link", { name: "Copyright © 2026 David Dias Digital" })
    ).toHaveAttribute("href", "https://daviddias.digital");
    expect(
      screen.queryByRole("link", { name: "A David Dias Digital project" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("hello@stackmatch.dev")).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("public alpha");
  });

  it("groups product, community, company, legal, and display controls", async () => {
    renderFooter();

    const productNav = screen.getByRole("navigation", { name: "Product footer links" });
    expect(within(productNav).getByRole("link", { name: "Explore developers" })).toHaveAttribute(
      "href",
      "/developers"
    );
    expect(within(productNav).getByRole("link", { name: "Browse stacks" })).toHaveAttribute(
      "href",
      "/stacks"
    );
    expect(within(productNav).getByRole("link", { name: "Top Stackers" })).toHaveAttribute(
      "href",
      "/top-stackers"
    );
    expect(within(productNav).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");

    const communityNav = screen.getByRole("navigation", { name: "Community footer links" });
    expect(within(communityNav).getByRole("link", { name: "Source code" })).toHaveAttribute(
      "href",
      "https://github.com/thedaviddias/stackmatch"
    );

    const companyNav = screen.getByRole("navigation", { name: "Company footer links" });
    expect(within(companyNav).getByRole("link", { name: "David Dias Digital" })).toHaveAttribute(
      "href",
      "https://daviddias.digital"
    );
    expect(within(companyNav).getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact"
    );

    const legalNav = screen.getByRole("navigation", { name: "Legal footer links" });
    expect(within(legalNav).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(within(legalNav).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    expect(screen.getByRole("button", { name: "Change color theme" })).toBeInTheDocument();
    expect(await screen.findByTitle("Switch to System mode")).toBeInTheDocument();
  });
});
