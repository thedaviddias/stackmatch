import { NotificationModal } from "@stackmatch/ui/notification-modal";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

afterEach(() => {
  cleanup();
});

describe("NotificationModal accessibility", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: "Update available",
    description: "A new version is available. Please refresh.",
  };

  it("should have no axe violations when open", async () => {
    const { container } = render(
      <main>
        <NotificationModal {...defaultProps} />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have role=dialog on the modal container", () => {
    render(<NotificationModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("should have aria-modal=true", () => {
    render(<NotificationModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should have aria-labelledby pointing to the heading", () => {
    render(<NotificationModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Update available" });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("should move focus into the modal when opened", () => {
    render(<NotificationModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("should close when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<NotificationModal {...defaultProps} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("should render nothing when isOpen is false", () => {
    const { container } = render(<NotificationModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("should have the confirm button with correct label", () => {
    render(<NotificationModal {...defaultProps} confirmLabel="Dismiss" />);
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
