import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Sentry before importing logger
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { logger } from "../index";

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("error", () => {
    it("logs to console.error", () => {
      const err = new Error("test");
      logger.error("Something broke", err);
      expect(console.error).toHaveBeenCalledWith("Something broke", err);
    });

    it("captures Error instances as exceptions in Sentry", () => {
      const err = new Error("test");
      logger.error("Something broke", err, { userId: "123" });
      expect(Sentry.captureException).toHaveBeenCalledWith(err, {
        extra: { message: "Something broke", userId: "123" },
      });
    });

    it("captures non-Error values as messages in Sentry", () => {
      logger.error("Something broke", "string error");
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Something broke", {
        level: "error",
        extra: { originalError: "string error" },
      });
    });

    it("captures message without error as Sentry message", () => {
      logger.error("Something broke");
      expect(Sentry.captureMessage).toHaveBeenCalledWith("Something broke", {
        level: "error",
        extra: { originalError: undefined },
      });
    });
  });

  describe("warn", () => {
    it("logs to console.warn", () => {
      logger.warn("Watch out", { key: "val" });
      expect(console.warn).toHaveBeenCalledWith("Watch out", { key: "val" });
    });

    it("adds a Sentry breadcrumb with warning level", () => {
      logger.warn("Watch out", { key: "val" });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Watch out",
        level: "warning",
        data: { key: "val" },
      });
    });

    it("works without context", () => {
      logger.warn("Watch out");
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "Watch out",
        level: "warning",
        data: undefined,
      });
    });
  });

  describe("info", () => {
    it("logs to console.log", () => {
      logger.info("FYI", { data: true });
      expect(console.log).toHaveBeenCalledWith("FYI", { data: true });
    });

    it("adds a Sentry breadcrumb with info level", () => {
      logger.info("FYI", { data: true });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "FYI",
        level: "info",
        data: { data: true },
      });
    });

    it("works without context", () => {
      logger.info("FYI");
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message: "FYI",
        level: "info",
        data: undefined,
      });
    });
  });
});
