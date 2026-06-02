import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { getWebAlert } from "@/lib/feedback/alert-registry";
import { SyncAlerts } from "../sync-alerts";

function renderSyncAlerts(overrides: Partial<ComponentProps<typeof SyncAlerts>> = {}) {
  const onRetryIndexing = vi.fn();
  const view = render(
    <SyncAlerts
      owner="octocat"
      isOwnerViewer
      syncAlertState={{ status: "idle", repoCount: 0, pendingRepoCount: 0 }}
      hasOnlySyncErrors={false}
      hasStalePublicStack={false}
      firstSyncError={undefined}
      isRetryingIndex={false}
      onRetryIndexing={onRetryIndexing}
      {...overrides}
    />
  );
  return { onRetryIndexing, ...view };
}

describe("SyncAlerts", () => {
  it("distinguishes queued indexing from active scanning", () => {
    const queuedAlert = getWebAlert("profile.sync.queued");
    const activeAlert = getWebAlert("profile.sync.active");

    renderSyncAlerts({
      syncAlertState: {
        status: "queued",
        repoCount: 1,
        pendingRepoCount: 1,
        nextRepoName: "hello-world",
      },
    });

    expect(screen.getByText(queuedAlert.title)).toBeInTheDocument();
    expect(screen.getByText(/waiting to start, beginning with hello-world/i)).toBeInTheDocument();
    expect(screen.queryByText(activeAlert.title)).not.toBeInTheDocument();
  });

  it("shows active sync progress when a repo is scanning", () => {
    const activeAlert = getWebAlert("profile.sync.active");

    renderSyncAlerts({
      syncAlertState: {
        status: "active",
        repoCount: 2,
        pendingRepoCount: 1,
        activeRepoName: "octo-repo",
        stageLabel: "Fetching commits...",
      },
    });

    expect(screen.getByText(activeAlert.title)).toBeInTheDocument();
    expect(screen.getByText(/Scanning octo-repo for @octocat/i)).toBeInTheDocument();
    expect(screen.getByText(/1 queued next/i)).toBeInTheDocument();
  });

  it("shows stalled indexing and lets owners retry", () => {
    const stalledAlert = getWebAlert("profile.sync.stalled");
    const { onRetryIndexing } = renderSyncAlerts({
      syncAlertState: {
        status: "stalled",
        repoCount: 1,
        pendingRepoCount: 1,
        stalledRepoName: "stuck-repo",
      },
    });

    expect(screen.getByText(stalledAlert.title)).toBeInTheDocument();
    expect(screen.getByText(/stuck-repo is the oldest queued item/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry indexing/i }));

    expect(onRetryIndexing).toHaveBeenCalledTimes(1);
  });

  it("shows failed indexing and lets owners retry", () => {
    const failedAlert = getWebAlert("profile.sync.failed");
    const { onRetryIndexing } = renderSyncAlerts({
      hasOnlySyncErrors: true,
      firstSyncError: "GitHub token invalid",
    });

    expect(screen.getByText(failedAlert.title)).toBeInTheDocument();
    expect(screen.getByText(/GitHub token invalid/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry indexing/i }));

    expect(onRetryIndexing).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "active",
      {
        syncAlertState: {
          status: "active" as const,
          repoCount: 1,
          pendingRepoCount: 0,
          activeRepoName: "octo-repo",
          stageLabel: "Fetching commits...",
        },
      },
      getWebAlert("profile.sync.active").title,
    ],
    [
      "queued",
      {
        syncAlertState: {
          status: "queued" as const,
          repoCount: 1,
          pendingRepoCount: 1,
          nextRepoName: "hello-world",
        },
      },
      getWebAlert("profile.sync.queued").title,
    ],
    [
      "stalled",
      {
        syncAlertState: {
          status: "stalled" as const,
          repoCount: 1,
          pendingRepoCount: 1,
          stalledRepoName: "stuck-repo",
        },
      },
      getWebAlert("profile.sync.stalled").title,
    ],
    [
      "failed",
      {
        hasOnlySyncErrors: true,
        firstSyncError: "GitHub token invalid",
      },
      getWebAlert("profile.sync.failed").title,
    ],
  ])("does not show %s sync alerts to public visitors", (_label, overrides, title) => {
    renderSyncAlerts({ isOwnerViewer: false, ...overrides });

    expect(screen.queryByText(title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry indexing/i })).not.toBeInTheDocument();
  });

  it("shows an owner-only stale public stack alert", () => {
    const staleAlert = getWebAlert("profile.sync.stale-public-stack");

    renderSyncAlerts({ hasStalePublicStack: true });

    expect(screen.getByText(staleAlert.title)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: staleAlert.actionLabel ?? /refresh stack/i })
    ).toBeInTheDocument();
  });

  it("does not show stale stack alert to public visitors", () => {
    const staleAlert = getWebAlert("profile.sync.stale-public-stack");

    renderSyncAlerts({ hasStalePublicStack: true, isOwnerViewer: false });

    expect(screen.queryByText(staleAlert.title)).not.toBeInTheDocument();
  });

  it("uses the existing retry handler for stale stack refresh", () => {
    const staleAlert = getWebAlert("profile.sync.stale-public-stack");
    const { onRetryIndexing } = renderSyncAlerts({ hasStalePublicStack: true });

    fireEvent.click(
      screen.getByRole("button", { name: staleAlert.actionLabel ?? /refresh stack/i })
    );

    expect(onRetryIndexing).toHaveBeenCalledTimes(1);
  });
});
