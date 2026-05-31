// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingStar,
  getPendingStar,
  type PendingStar,
  savePendingStar,
} from "../pending-star";

describe("pendingStar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("savePendingStar", () => {
    it("stores a star as JSON in localStorage", () => {
      savePendingStar({ targetOwner: "octocat" });
      const raw = localStorage.getItem("stackmatch-pending-star");
      expect(JSON.parse(raw ?? "")).toEqual({ targetOwner: "octocat" });
    });

    it("overwrites a previous pending star", () => {
      savePendingStar({ targetOwner: "first" });
      savePendingStar({ targetOwner: "second" });
      expect(getPendingStar()).toEqual({ targetOwner: "second" });
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => savePendingStar({ targetOwner: "test" })).not.toThrow();
    });
  });

  describe("getPendingStar", () => {
    it("returns null when no pending star exists", () => {
      expect(getPendingStar()).toBeNull();
    });

    it("returns the saved pending star", () => {
      savePendingStar({ targetOwner: "octocat" });
      expect(getPendingStar()).toEqual({ targetOwner: "octocat" });
    });

    it("returns null for invalid JSON", () => {
      localStorage.setItem("stackmatch-pending-star", "not-json");
      expect(getPendingStar()).toBeNull();
    });

    it("returns null for JSON with wrong shape", () => {
      localStorage.setItem("stackmatch-pending-star", JSON.stringify({ foo: "bar" }));
      expect(getPendingStar()).toBeNull();
    });

    it("returns null for JSON with wrong types", () => {
      localStorage.setItem("stackmatch-pending-star", JSON.stringify({ targetOwner: 123 }));
      expect(getPendingStar()).toBeNull();
    });

    it("returns null for null stored value", () => {
      localStorage.setItem("stackmatch-pending-star", JSON.stringify(null));
      expect(getPendingStar()).toBeNull();
    });

    it("returns null for array stored value", () => {
      localStorage.setItem("stackmatch-pending-star", JSON.stringify(["not", "an", "object"]));
      expect(getPendingStar()).toBeNull();
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(getPendingStar()).toBeNull();
    });
  });

  describe("clearPendingStar", () => {
    it("removes the pending star from localStorage", () => {
      savePendingStar({ targetOwner: "octocat" });
      clearPendingStar();
      expect(localStorage.getItem("stackmatch-pending-star")).toBeNull();
    });

    it("does not throw when nothing is stored", () => {
      expect(() => clearPendingStar()).not.toThrow();
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(() => clearPendingStar()).not.toThrow();
    });
  });

  describe("PendingStar type", () => {
    it("type-checks valid PendingStar objects", () => {
      const star: PendingStar = { targetOwner: "test" };
      expect(star.targetOwner).toBe("test");
    });
  });
});
