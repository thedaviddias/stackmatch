import { ConfirmModal } from "@stackmatch/ui/confirm-modal";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

afterEach(() => {
  cleanup();
});

describe("ConfirmModal accessibility", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: "Delete item?",
    description: "This action cannot be undone.",
  };

  it("should have no axe violations when open", async () => {
    const { container } = render(
      <main>
        <ConfirmModal {...defaultProps} />
      </main>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have role=dialog on the modal container", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("should have aria-modal=true", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should have aria-labelledby pointing to the heading", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const heading = screen.getByRole("heading", { name: "Delete item?" });
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
  });

  it("should move focus into the modal when opened", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("should close when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("should render nothing when isOpen is false", () => {
    const { container } = render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("should have an accessible close button", () => {
    render(<ConfirmModal {...defaultProps} />);
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it("should have the confirm button labeled with the confirmLabel prop", () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Delete forever" />);
    expect(screen.getByRole("button", { name: "Delete forever" })).toBeInTheDocument();
  });
});
