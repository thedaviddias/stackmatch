import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postJson } from "@/lib/post-json";
import { CurationModal } from "../curation-modal";

vi.mock("@/data/api", () => ({
  api: {
    mutations: {
      repos: {
        toggleRepoExclusion: "toggleRepoExclusion",
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("@/lib/post-json", () => ({
  postJson: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const QUEUED_REPO_COUNT = 1;
const REPO_STAR_COUNT = 1;

describe("CurationModal", () => {
  const postJsonMock = vi.mocked(postJson);

  beforeEach(() => {
    vi.clearAllMocks();
    postJsonMock.mockResolvedValue({ queued: QUEUED_REPO_COUNT });
  });

  it("queues one public repository for the current owner", async () => {
    render(<CurationModal isOpen onClose={vi.fn()} owner="octocat" repos={[]} />);

    fireEvent.change(screen.getByLabelText("Public repository"), {
      target: { value: "hello-world" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sync repo/i }));

    await waitFor(() => {
      expect(postJsonMock).toHaveBeenCalledWith("/api/scan/user", {
        owner: "octocat",
        repos: [{ owner: "octocat", name: "hello-world" }],
      });
    });
  });

  it("does not queue a repository that is already managed", async () => {
    render(
      <CurationModal
        isOpen
        onClose={vi.fn()}
        owner="octocat"
        repos={[
          {
            repoId: "repo_1",
            name: "hello-world",
            fullName: "octocat/hello-world",
            stars: REPO_STAR_COUNT,
            isExcluded: false,
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Public repository"), {
      target: { value: "hello-world" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sync repo/i }));

    expect(postJsonMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Repository is already managed.");
  });
});
