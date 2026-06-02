import {
  FEED_EVENT_TYPE_JOINED,
  FEED_EVENT_TYPE_MATCHED,
  FEED_EVENT_TYPE_STACK_SCANNED,
  FEED_EVENT_TYPE_STARRED,
} from "@stackmatch/constants/feed";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "../activity-feed";

const mocks = vi.hoisted(() => ({
  feedItems: [] as unknown[],
  followingOwners: [] as string[],
  hiddenFeedCount: 0,
  viewerOwner: "viewer",
  hideFeedEvent: vi.fn(),
  toggleFollow: vi.fn(),
  unhideFeedEvents: vi.fn(),
}));

vi.mock("@/data/api", () => ({
  api: {
    auth: {
      getMyGitHubLogin: "getMyGitHubLogin",
    },
    mutations: {
      feed_events: {
        hideMyFeedEvent: "hideMyFeedEvent",
        unhideAllMyFeedEvents: "unhideAllMyFeedEvents",
      },
      follows: {
        toggleFollow: "toggleFollow",
      },
    },
    queries: {
      feed: {
        getGlobalFeed: "getGlobalFeed",
        getMyHiddenFeedCount: "getMyHiddenFeedCount",
        getPersonalFeed: "getPersonalFeed",
      },
      follows: {
        getMyFollowingList: "getMyFollowingList",
      },
    },
  },
}));

vi.mock("@/data/react", () => ({
  useMutation: (mutation: string) => {
    if (mutation === "hideMyFeedEvent") return mocks.hideFeedEvent;
    if (mutation === "unhideAllMyFeedEvents") return mocks.unhideFeedEvents;
    return mocks.toggleFollow;
  },
  useQuery: (query: string) => {
    if (query === "getPersonalFeed" || query === "getGlobalFeed") return mocks.feedItems;
    if (query === "getMyGitHubLogin") return mocks.viewerOwner;
    if (query === "getMyFollowingList") return mocks.followingOwners;
    if (query === "getMyHiddenFeedCount") return mocks.hiddenFeedCount;
    return undefined;
  },
}));

vi.mock("@/components/ui/display/profile-elements", () => ({
  DropdownMenu: ({ trigger }: { trigger: ReactNode }) => (
    <button type="button" aria-label="Feed item actions">
      {trigger}
    </button>
  ),
}));

vi.mock("@/components/ui/display/time-ago", () => ({
  TimeAgo: () => "now",
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const NOW = 1_800_000_000_000;

function feedEvent(id: string, event: Record<string, unknown>) {
  return {
    _id: id,
    actorOwner: "alice",
    actorName: "Alice",
    createdAt: NOW,
    ...event,
  };
}

beforeEach(() => {
  mocks.feedItems = [
    feedEvent("feedEvents_1", {
      type: FEED_EVENT_TYPE_STARRED,
      targetOwner: "bob",
      targetName: "Bob",
    }),
    feedEvent("feedEvents_2", {
      type: FEED_EVENT_TYPE_MATCHED,
      targetOwner: "carol",
      targetName: "Carol",
    }),
    feedEvent("feedEvents_3", {
      type: FEED_EVENT_TYPE_STACK_SCANNED,
      metadata: {
        repoCount: 2,
        packageCount: 15,
        manifestCount: 3,
      },
    }),
    feedEvent("feedEvents_4", {
      actorOwner: "dana",
      actorName: "Dana",
      type: FEED_EVENT_TYPE_JOINED,
    }),
  ];
  mocks.followingOwners = ["alice", "dana"];
  mocks.hiddenFeedCount = 0;
  mocks.viewerOwner = "viewer";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActivityFeed", () => {
  it("renders expanded feed event types and filters stack scan cards", async () => {
    const user = userEvent.setup();
    render(<ActivityFeed mode="personal" />);

    expect(screen.getByRole("button", { name: "Stars" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matches" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scans" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Joined" })).toBeInTheDocument();

    expect(screen.getByText("starred")).toBeInTheDocument();
    expect(screen.getByText("matched with")).toBeInTheDocument();
    expect(screen.getByText("updated their stack")).toBeInTheDocument();
    expect(screen.getByText("joined StackMatch")).toBeInTheDocument();
    expect(screen.getByText("2 repos, 15 packages, 3 manifests")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Scans" }));

    expect(screen.getByText("updated their stack")).toBeInTheDocument();
    expect(screen.getByText("2 repos, 15 packages, 3 manifests")).toBeInTheDocument();
    expect(screen.queryByText("starred")).not.toBeInTheDocument();
    expect(screen.queryByText("matched with")).not.toBeInTheDocument();
  });
});
