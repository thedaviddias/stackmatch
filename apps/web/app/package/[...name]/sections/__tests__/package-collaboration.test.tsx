import { ROUTES } from "@stackmatch/config";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PackageCollaboration } from "../package-collaboration";

afterEach(() => {
  cleanup();
});

describe("PackageCollaboration", () => {
  it("links package repo usage rows to repository dashboard pages", () => {
    render(
      <PackageCollaboration
        topReposUsingPackage={[
          {
            owner: "thedaviddias",
            name: "llms-txt-hub",
            fullName: "thedaviddias/llms-txt-hub",
            stars: 847,
            pushedAt: 1_779_999_000_000,
          },
        ]}
        relatedPreview={[]}
        activeOwners30d={1}
        totalOwnerCount={2}
      />
    );

    const repoLink = screen.getByRole("link", {
      name: "View thedaviddias/llms-txt-hub repository analysis",
    });

    expect(repoLink).toHaveAttribute("href", "/thedaviddias/llms-txt-hub");
    expect(repoLink).not.toHaveAttribute("href", "/thedaviddias");
  });

  it("links companion confidence rows to package pages", () => {
    render(
      <PackageCollaboration
        topReposUsingPackage={[]}
        relatedPreview={[
          {
            packageName: "@radix-ui/react-dialog",
            coOccurrenceCount: 12,
            liftScore: 10,
          },
        ]}
        activeOwners30d={1}
        totalOwnerCount={2}
      />
    );

    const packageLink = screen.getByRole("link", {
      name: "View @radix-ui/react-dialog package analysis",
    });

    expect(packageLink).toHaveAttribute("href", ROUTES.package("@radix-ui/react-dialog"));
  });
});
