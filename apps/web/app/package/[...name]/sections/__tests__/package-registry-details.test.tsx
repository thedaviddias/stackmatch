import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PackageRegistryDetails } from "../package-registry-details";

afterEach(() => {
  cleanup();
});

describe("PackageRegistryDetails", () => {
  it("returns no registry details when every provider is empty", () => {
    const { container } = render(
      <PackageRegistryDetails packageName="demo" npmData={{ fetchedAt: 1_779_999_000_000 }} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("NPM Stats")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub Stats")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Collective")).not.toBeInTheDocument();
  });

  it("links ecosystem signal cards to external provider package pages", () => {
    render(
      <PackageRegistryDetails
        packageName="@stackmatch/web"
        npmData={{
          fetchedAt: 1_779_999_000_000,
          jsDelivr: { hits: 1_234 },
          stackOverflow: { tag: "reactjs", questionCount: 4_567 },
          librariesIo: { rank: 89 },
        }}
      />
    );

    const jsDelivrLink = screen.getByRole("link", {
      name: "Open jsDelivr package page for @stackmatch/web",
    });
    const stackOverflowLink = screen.getByRole("link", {
      name: "Open Stack Overflow questions tagged reactjs",
    });
    const librariesIoLink = screen.getByRole("link", {
      name: "Open Libraries.io package page for @stackmatch/web",
    });

    expect(jsDelivrLink).toHaveAttribute(
      "href",
      "https://www.jsdelivr.com/package/npm/@stackmatch/web"
    );
    expect(stackOverflowLink).toHaveAttribute(
      "href",
      "https://stackoverflow.com/questions/tagged/reactjs"
    );
    expect(librariesIoLink).toHaveAttribute("href", "https://libraries.io/npm/%40stackmatch%2Fweb");

    for (const link of [jsDelivrLink, stackOverflowLink, librariesIoLink]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("hides missing provider cards instead of rendering placeholders", () => {
    render(
      <PackageRegistryDetails
        packageName="demo"
        npmData={{
          fetchedAt: 1_779_999_000_000,
          github: {
            owner: "stackmatch",
            repo: "demo",
            url: "https://github.com/stackmatch/demo",
          },
          jsDelivr: { hits: 1_234 },
          librariesIo: { rank: 89 },
        }}
      />
    );

    expect(
      screen.queryByRole("link", {
        name: /Open Stack Overflow questions tagged/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Stack Overflow")).not.toBeInTheDocument();
    expect(screen.queryByText("GitHub Stats")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Collective")).not.toBeInTheDocument();
    expect(screen.getByText("jsDelivr")).toBeInTheDocument();
  });
});
