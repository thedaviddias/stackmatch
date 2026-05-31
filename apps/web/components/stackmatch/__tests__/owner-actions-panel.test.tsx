import { INVITE_BONUS_MAX_SCORE } from "@stackmatch/constants/invite";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { OwnerActionsPanel, type OwnerActionsPanelProps } from "../owner-actions-panel";

vi.mock("../panels/curation-modal", () => ({
  CurationModal: () => null,
}));

const baseProps: OwnerActionsPanelProps = {
  repos: [],
  visibility: "public",
  publicSync: {
    state: "synced",
    isResyncing: false,
    isCoolingDown: false,
    isActionDisabled: false,
    buttonLabel: "Refresh Public",
    buttonToneClasses: "",
    tooltipContent: "Refresh public repositories.",
    chipDetail: "Synced",
    onSync: vi.fn(),
  },
  privateSync: {
    state: "idle",
    shouldShowStatus: false,
    isSyncing: false,
    isUnlinking: false,
    isDisconnectingGitHubApp: false,
    isCoolingDown: false,
    isActionDisabled: false,
    buttonLabel: "Connect Private",
    buttonToneClasses: "",
    tooltipContent: "Connect private repositories.",
    chipDetail: "Idle",
    hasGitHubAppInstallation: false,
    accessSettingsUrl: null,
    accessButtonHref: "/api/github-app/install",
    accessButtonLabel: "Connect Private Access",
    onSync: vi.fn(),
    onUnlink: vi.fn(),
    onDisconnectGitHubApp: vi.fn(),
  },
  curation: {
    isOpen: false,
    setIsOpen: vi.fn(),
  },
  invite: {
    isOpen: false,
    setIsOpen: vi.fn(),
    codes: [{ code: "ALPHA123", redeemedBy: null, redeemedAt: null }],
    isGeneratingCodes: false,
    codeError: null,
    onOpen: vi.fn(),
    ensureCodes: vi.fn(async () => undefined),
  },
  referralPoints: 0,
  onPublicPreviewOpen: vi.fn(),
  onVisibilityToggle: vi.fn(),
};

function StatefulOwnerActionsPanel({ referralPoints = 0 }: { referralPoints?: number }) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  return (
    <OwnerActionsPanel
      {...baseProps}
      referralPoints={referralPoints}
      invite={{
        ...baseProps.invite,
        isOpen: isInviteOpen,
        setIsOpen: setIsInviteOpen,
        onOpen: () => setIsInviteOpen(true),
      }}
    />
  );
}

describe("OwnerActionsPanel", () => {
  it("shows an invite nudge while referral bonus is not maxed", () => {
    render(<StatefulOwnerActionsPanel />);

    expect(screen.getAllByText("Invite stackmates")).toHaveLength(2);
    expect(
      screen.getByText("You both earn +5 Stack Score when they join with your link.")
    ).toBeInTheDocument();
  });

  it("hides the invite nudge once referral bonus is maxed", () => {
    render(<StatefulOwnerActionsPanel referralPoints={INVITE_BONUS_MAX_SCORE} />);

    expect(
      screen.queryByText("You both earn +5 Stack Score when they join with your link.")
    ).not.toBeInTheDocument();
  });

  it("opens the invite modal from the nudge", async () => {
    render(<StatefulOwnerActionsPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Invite stackmates" }));

    expect(await screen.findByRole("heading", { name: "Invite Friends" })).toBeInTheDocument();
  });

  it("keeps invite access in the manage dropdown", () => {
    const onOpen = vi.fn();

    render(
      <OwnerActionsPanel
        {...baseProps}
        invite={{
          ...baseProps.invite,
          onOpen,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open identity management menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Invite Stackmates (+5 each)" }));

    expect(onOpen).toHaveBeenCalledWith("manage_menu");
  });
});
