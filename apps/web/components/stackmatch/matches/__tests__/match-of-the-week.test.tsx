import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Stackmate } from "../../stackmate-grid";
import { WeeklyPickCard } from "../match-of-the-week";

vi.mock("@/components/ui/link", () => ({
  LinkCustom: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function makeMatch(overrides: Partial<Stackmate> = {}): Stackmate {
  return {
    owner: "octocat",
    avatarUrl: "https://github.com/octocat.png",
    jaccard: 0.72,
    sharedPackageCount: 8,
    publicRepoCount: 12,
    totalStars: 42,
    profile: {
      name: "Octo Cat",
      avatarUrl: "https://github.com/octocat.png",
      followers: 10,
      isClaimed: true,
      stackScore: 88,
      topStacks: [
        "react",
        "next",
        "tailwindcss",
        "zod",
        "drizzle-orm",
        "@radix-ui/react-tooltip",
        "graphql",
      ],
    },
    ...overrides,
  };
}

describe("WeeklyPickCard", () => {
  it("limits top stack badges and shows responsive hidden counts", () => {
    render(<WeeklyPickCard match={makeMatch()} />);

    expect(screen.getByText("Weekly Pick")).toBeInTheDocument();

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("tailwindcss")).toHaveClass("hidden");
    expect(screen.queryByText("zod")).not.toBeInTheDocument();
    expect(screen.getByText("+5")).toHaveClass("sm:hidden");
    expect(screen.getByText("+4")).toHaveClass("hidden", "sm:inline-flex");
  });

  it("hides low-signal top stack badges and excludes them from overflow counts", () => {
    render(
      <WeeklyPickCard
        match={makeMatch({
          profile: {
            name: "Octo Cat",
            avatarUrl: "https://github.com/octocat.png",
            followers: 10,
            isClaimed: true,
            stackScore: 88,
            topStacks: [
              "react",
              "husky",
              "next",
              "@commitlint/config-conventional",
              "@biomejs/biome",
              "tailwindcss",
              "zod",
            ],
          },
        })}
      />
    );

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("tailwindcss")).toHaveClass("hidden");
    expect(screen.queryByText("husky")).not.toBeInTheDocument();
    expect(screen.queryByText("@commitlint/config-conventional")).not.toBeInTheDocument();
    expect(screen.queryByText("@biomejs/biome")).not.toBeInTheDocument();
    expect(screen.queryByText("zod")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveClass("sm:hidden");
    expect(screen.getByText("+1")).toHaveClass("hidden", "sm:inline-flex");
  });

  it("omits stack chips when every package is low signal", () => {
    render(
      <WeeklyPickCard
        match={makeMatch({
          profile: {
            name: "Octo Cat",
            avatarUrl: "https://github.com/octocat.png",
            followers: 10,
            isClaimed: true,
            stackScore: 88,
            topStacks: ["husky", "biome", "@commitlint/cli"],
          },
        })}
      />
    );

    expect(screen.queryByText("husky")).not.toBeInTheDocument();
    expect(screen.queryByText("biome")).not.toBeInTheDocument();
    expect(screen.queryByText("@commitlint/cli")).not.toBeInTheDocument();
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });
});
