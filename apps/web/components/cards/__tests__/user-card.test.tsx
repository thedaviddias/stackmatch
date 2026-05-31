import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { UserCard } from "../user-card";

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

function renderUserCard(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("UserCard", () => {
  it("shows the stack score by default", () => {
    const { container } = renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        power={88}
      />
    );

    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveClass("bg-card");
    expect(container.querySelector("a")).toHaveClass("text-foreground");
  });

  it("shows zero as a valid stack score and only falls back for missing power", () => {
    const { rerender } = renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        power={0}
      />
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <UserCard
          owner="octocat"
          avatarUrl="https://github.com/octocat.png"
          displayName="Octo Cat"
          repoCount={12}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses the supplied metric instead of the stack score", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        power={88}
        metric={{
          label: "Joined",
          value: "Feb '24",
          icon: CalendarDays,
        }}
      />
    );

    expect(screen.getByText("Joined")).toBeInTheDocument();
    expect(screen.getByText("Feb '24")).toBeInTheDocument();
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    expect(screen.queryByText("88%")).not.toBeInTheDocument();
  });

  it("shows scanning as an inline footer status without replacing the score", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        isSyncing
        power={88}
      />
    );

    const scanningStatus = screen.getByText(/Scanning/);

    expect(scanningStatus).toBeInTheDocument();
    expect(scanningStatus.closest("span")).toHaveClass("inline-flex");
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("limits top stack badges by default and shows responsive hidden counts", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        topStacks={["react", "next", "tailwindcss", "zod", "drizzle-orm", "svelte"]}
      />
    );

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("tailwindcss").parentElement).toHaveClass("hidden");
    expect(screen.queryByText("zod")).not.toBeInTheDocument();
    expect(screen.getByText("+4")).toHaveClass("sm:hidden");
    expect(screen.getByText("+3")).toHaveClass("hidden", "sm:inline-flex");
  });

  it("hides low-signal top stack badges and excludes them from overflow counts", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        topStacks={[
          "react",
          "husky",
          "next",
          "@commitlint/config-conventional",
          "@biomejs/biome",
          "tailwindcss",
          "zod",
        ]}
      />
    );

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("tailwindcss").parentElement).toHaveClass("hidden");
    expect(screen.queryByText("husky")).not.toBeInTheDocument();
    expect(screen.queryByText("@commitlint/config-conventional")).not.toBeInTheDocument();
    expect(screen.queryByText("@biomejs/biome")).not.toBeInTheDocument();
    expect(screen.queryByText("zod")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveClass("sm:hidden");
    expect(screen.getByText("+1")).toHaveClass("hidden", "sm:inline-flex");
  });

  it("omits the top stack row when every package is low signal", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        topStacks={["husky", "biome", "@commitlint/cli"]}
      />
    );

    expect(screen.queryByText("Top Stack")).not.toBeInTheDocument();
    expect(screen.queryByText("husky")).not.toBeInTheDocument();
    expect(screen.queryByText("biome")).not.toBeInTheDocument();
    expect(screen.queryByText("@commitlint/cli")).not.toBeInTheDocument();
  });

  it("respects explicit top stack badge limits", () => {
    renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        topStacks={["react", "next", "tailwindcss", "zod", "drizzle-orm", "svelte"]}
        topStackLimit={5}
        mobileTopStackLimit={5}
      />
    );

    expect(screen.getByText("drizzle-orm")).toBeInTheDocument();
    expect(screen.queryByText("svelte")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("shows claimed and indexed profile status badges when provided", () => {
    const { rerender } = renderUserCard(
      <UserCard
        owner="octocat"
        avatarUrl="https://github.com/octocat.png"
        displayName="Octo Cat"
        repoCount={12}
        profileStatus="claimed"
      />
    );

    expect(screen.getByText("Claimed")).toBeInTheDocument();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <UserCard
          owner="indexed"
          avatarUrl="https://github.com/indexed.png"
          displayName="Indexed User"
          repoCount={8}
          profileStatus="indexed"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Indexed")).toBeInTheDocument();
  });

  it("shows missing stack data as a neutral claimed-profile state", () => {
    const { rerender } = renderUserCard(
      <UserCard
        owner="claimed"
        avatarUrl="https://github.com/claimed.png"
        displayName="Claimed User"
        repoCount={0}
        profileStatus="claimed"
        stackDataStatus="missing"
      />
    );

    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.getByText("No stack data yet")).toBeInTheDocument();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <UserCard
          owner="indexed"
          avatarUrl="https://github.com/indexed.png"
          displayName="Indexed User"
          repoCount={8}
          profileStatus="indexed"
        />
      </QueryClientProvider>
    );

    expect(screen.getByText("Indexed")).toBeInTheDocument();
    expect(screen.queryByText("No stack data yet")).not.toBeInTheDocument();
  });
});
