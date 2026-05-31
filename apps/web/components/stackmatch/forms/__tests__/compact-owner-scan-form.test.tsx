import { fireEvent, render, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWebAlertTitle } from "@/lib/feedback/alert-registry";
import { postJson } from "@/lib/post-json";
import { CompactOwnerScanForm } from "../compact-owner-scan-form";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/post-json", () => ({
  postJson: vi.fn(),
}));

describe("CompactOwnerScanForm", () => {
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

  it("normalizes GitHub profile URLs before submitting", async () => {
    vi.mocked(postJson).mockResolvedValue({ queued: 1 });
    const onScanSuccess = vi.fn();

    const { getByLabelText, getByRole } = render(
      <CompactOwnerScanForm onScanSuccess={onScanSuccess} />
    );
    const input = getByLabelText(/GitHub user or organization to scan/i);
    const submitBtn = getByRole("button", { name: /Scan owner/i });

    fireEvent.change(input, { target: { value: "https://github.com/MrSunshyne" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith("/api/scan/user", { owner: "MrSunshyne" });
      expect(pushMock).toHaveBeenCalledWith("/MrSunshyne");
      expect(onScanSuccess).toHaveBeenCalledWith("MrSunshyne");
    });
  });

  it("normalizes GitHub repo URLs to owner scans", async () => {
    vi.mocked(postJson).mockResolvedValue({ queued: 1 });

    const { getByLabelText, getByRole } = render(<CompactOwnerScanForm />);
    const input = getByLabelText(/GitHub user or organization to scan/i);
    const submitBtn = getByRole("button", { name: /Scan owner/i });

    fireEvent.change(input, { target: { value: "https://github.com/facebook/react" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(postJson).toHaveBeenCalledWith("/api/scan/user", { owner: "facebook" });
      expect(pushMock).toHaveBeenCalledWith("/facebook");
    });
  });

  it("shows client-side feedback for invalid URLs", () => {
    const onScanSuccess = vi.fn();
    const { getByLabelText, getByRole, getByText } = render(
      <CompactOwnerScanForm onScanSuccess={onScanSuccess} />
    );
    const input = getByLabelText(/GitHub user or organization to scan/i);
    const submitBtn = getByRole("button", { name: /Scan owner/i });

    fireEvent.change(input, { target: { value: "https://example.com/octocat" } });
    fireEvent.click(submitBtn);

    expect(getByText(getWebAlertTitle("form.owner.invalid"))).toBeDefined();
    expect(getByRole("alert")).toHaveTextContent(getWebAlertTitle("form.owner.invalid"));
    expect(postJson).not.toHaveBeenCalled();
    expect(onScanSuccess).not.toHaveBeenCalled();
  });
});
