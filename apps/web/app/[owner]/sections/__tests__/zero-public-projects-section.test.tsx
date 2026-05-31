import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ZeroPublicProjectsSection } from "../zero-public-projects/zero-public-projects-section";

describe("ZeroPublicProjectsSection", () => {
  it("shows owner-facing project creation guidance and retry action", async () => {
    const onRetryIndexing = vi.fn();

    render(
      <ZeroPublicProjectsSection
        owner="octocat"
        isOwnerViewer
        isRetryingIndex={false}
        onRetryIndexing={onRetryIndexing}
      />
    );

    expect(screen.getByRole("heading", { name: /first public project/i })).toBeInTheDocument();
    expect(screen.getByText("Create a focused public repo")).toBeInTheDocument();
    expect(screen.getByText("Add a useful README and topics")).toBeInTheDocument();
    expect(screen.getByText("Commit real code")).toBeInTheDocument();
    expect(screen.getByText("Check again on Stackmatch")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create github project/i })).toHaveAttribute(
      "href",
      "https://github.com/new"
    );

    await userEvent.click(screen.getByRole("button", { name: /check again/i }));

    expect(onRetryIndexing).toHaveBeenCalledOnce();
  });

  it("shows retry progress without allowing duplicate checks", () => {
    render(
      <ZeroPublicProjectsSection
        owner="octocat"
        isOwnerViewer
        isRetryingIndex
        onRetryIndexing={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
  });

  it("shows a visitor placeholder without owner-only actions", () => {
    render(
      <ZeroPublicProjectsSection
        owner="octocat"
        isOwnerViewer={false}
        isRetryingIndex={false}
        onRetryIndexing={vi.fn()}
      />
    );

    expect(
      screen.getByText("@octocat has not published public projects to Stackmatch yet.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view github profile/i })).toHaveAttribute(
      "href",
      "https://github.com/octocat"
    );
    expect(screen.queryByText("Create a focused public repo")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /create github project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /check again/i })).not.toBeInTheDocument();
  });
});
