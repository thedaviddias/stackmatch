import { fireEvent, render, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { postJson } from "@/lib/post-json";
import { OwnerLookupForm } from "../owner-lookup-form";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/post-json", () => ({
  postJson: vi.fn(),
}));

describe("OwnerLookupForm", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      push: pushMock,
      refresh: vi.fn(),
      replace: vi.fn(),
    });
  });

  it("disables the submit button when the input is empty", () => {
    const { getByRole } = render(<OwnerLookupForm />);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });
    expect(submitBtn).toHaveAttribute("aria-disabled", "true");
  });

  it("uses semantic foreground tokens for the search input", () => {
    const { getByLabelText } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    expect(input).toHaveClass("text-foreground");
    expect(input).toHaveClass("placeholder:text-muted-foreground");
  });

  it("enables the submit button when input is provided", () => {
    const { getByLabelText, getByRole } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });

    fireEvent.change(input, { target: { value: "octocat" } });
    expect(submitBtn).toHaveAttribute("aria-disabled", "false");
  });

  it("prevents multiple submissions using guard clause", async () => {
    let resolvePost: (value: { success: true }) => void = () => {};
    const postPromise = new Promise<{ success: true }>((resolve) => {
      resolvePost = resolve;
    });
    vi.mocked(postJson).mockReturnValue(postPromise);

    const { getByLabelText, getByRole } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });

    fireEvent.change(input, { target: { value: "octocat" } });
    fireEvent.click(submitBtn);

    expect(postJson).toHaveBeenCalledTimes(1);
    expect(submitBtn).toHaveAttribute("aria-disabled", "true");

    // Second click should be ignored
    fireEvent.click(submitBtn);
    expect(postJson).toHaveBeenCalledTimes(1);

    resolvePost({ success: true });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/octocat");
    });
  });

  it("normalizes GitHub profile URLs before submitting", async () => {
    vi.mocked(postJson).mockResolvedValue({ queued: 1 });

    const { getByLabelText, getByRole } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });

    fireEvent.change(input, { target: { value: "https://github.com/MrSunshyne" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith("/api/scan/user", { owner: "MrSunshyne" });
      expect(pushMock).toHaveBeenCalledWith("/MrSunshyne");
    });
  });

  it("normalizes GitHub repo URLs to owner scans", async () => {
    vi.mocked(postJson).mockResolvedValue({ queued: 1 });

    const { getByLabelText, getByRole } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });

    fireEvent.change(input, { target: { value: "https://github.com/facebook/react" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith("/api/scan/user", { owner: "facebook" });
      expect(pushMock).toHaveBeenCalledWith("/facebook");
    });
  });

  it("shows client-side feedback for invalid URLs", () => {
    const { getByLabelText, getByRole, getByText } = render(<OwnerLookupForm />);
    const input = getByLabelText(/GitHub User Or Organization/i);
    const submitBtn = getByRole("button", { name: /Find stackmates/i });

    fireEvent.change(input, { target: { value: "https://example.com/octocat" } });
    fireEvent.click(submitBtn);

    expect(getByText(getWebAlertTitle("form.owner.invalid"))).toBeDefined();
    expect(getByRole("alert")).toHaveTextContent(getWebAlertTitle("form.owner.invalid"));
    expect(postJson).not.toHaveBeenCalled();
  });
});
