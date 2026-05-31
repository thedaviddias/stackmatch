import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage from "../page";

describe("ContactPage", () => {
  it("renders company ownership and primary contact email", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Contact Stackmatch" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "David Dias Digital" })[0]).toHaveAttribute(
      "href",
      "https://daviddias.digital"
    );
    expect(screen.getAllByRole("link", { name: "hello@stackmatch.dev" })[0]).toHaveAttribute(
      "href",
      "mailto:hello@stackmatch.dev"
    );
  });

  it("renders support, privacy, open-source, and ownership contact paths", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Support and feedback" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Privacy and data requests" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Open-source questions" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Company ownership" })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Review privacy details" })).toHaveAttribute(
      "href",
      "/privacy"
    );
    expect(screen.getByRole("link", { name: "View GitHub source" })).toHaveAttribute(
      "href",
      "https://github.com/thedaviddias/stackmatch"
    );
  });
});
