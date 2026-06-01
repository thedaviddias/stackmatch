import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "../session-provider";

const mocks = vi.hoisted(() => ({
  useAuthSession: vi.fn(),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: mocks.useAuthSession,
  },
}));

function SessionProbe() {
  const { session, isPending } = useSession();

  return (
    <div>
      <span data-testid="session-name">{session?.user.name ?? "none"}</span>
      <span data-testid="session-pending">{String(isPending)}</span>
    </div>
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    mocks.useAuthSession.mockReturnValue({ data: null, isPending: false, error: null });
  });

  it("uses the server session while the client session is still undefined and pending", () => {
    mocks.useAuthSession.mockReturnValue({ data: undefined, isPending: true, error: null });

    render(
      <SessionProvider
        initialSession={{
          user: {
            id: "user_123",
            name: "David Dias",
            email: null,
            image: null,
          },
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByTestId("session-name")).toHaveTextContent("David Dias");
    expect(screen.getByTestId("session-pending")).toHaveTextContent("false");
  });

  it("keeps loading state when no server session is available", () => {
    mocks.useAuthSession.mockReturnValue({ data: undefined, isPending: true, error: null });

    render(
      <SessionProvider initialSession={null}>
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByTestId("session-name")).toHaveTextContent("none");
    expect(screen.getByTestId("session-pending")).toHaveTextContent("true");
  });

  it("prefers the resolved client session over the server snapshot", () => {
    mocks.useAuthSession.mockReturnValue({
      data: { user: { id: "user_456", name: "Octocat", email: null, image: null } },
      isPending: false,
      error: null,
    });

    render(
      <SessionProvider
        initialSession={{
          user: {
            id: "user_123",
            name: "David Dias",
            email: null,
            image: null,
          },
        }}
      >
        <SessionProbe />
      </SessionProvider>
    );

    expect(screen.getByTestId("session-name")).toHaveTextContent("Octocat");
    expect(screen.getByTestId("session-pending")).toHaveTextContent("false");
  });
});
