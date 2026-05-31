// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingReferral,
  getPendingReferral,
  type PendingReferral,
  savePendingReferral,
} from "../pending-referral";

describe("pendingReferral", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("savePendingReferral", () => {
    it("stores a referral code as JSON in localStorage", () => {
      savePendingReferral("ABC123");
      const raw = localStorage.getItem("stackmatch-pending-referral");
      expect(JSON.parse(raw ?? "")).toEqual({ code: "ABC123" });
    });

    it("overwrites a previous referral code", () => {
      savePendingReferral("FIRST");
      savePendingReferral("SECOND");
      const result = getPendingReferral();
      expect(result?.code).toBe("SECOND");
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      expect(() => savePendingReferral("TEST")).not.toThrow();
    });
  });

  describe("getPendingReferral", () => {
    it("returns null when no pending referral exists", () => {
      expect(getPendingReferral()).toBeNull();
    });

    it("returns the saved pending referral", () => {
      savePendingReferral("INVITE42");
      expect(getPendingReferral()).toEqual({ code: "INVITE42" });
    });

    it("returns null for invalid JSON", () => {
      localStorage.setItem("stackmatch-pending-referral", "not-json");
      expect(getPendingReferral()).toBeNull();
    });

    it("returns null for JSON with wrong shape", () => {
      localStorage.setItem("stackmatch-pending-referral", JSON.stringify({ foo: "bar" }));
      expect(getPendingReferral()).toBeNull();
    });

    it("returns null for JSON with wrong code type", () => {
      localStorage.setItem("stackmatch-pending-referral", JSON.stringify({ code: 42 }));
      expect(getPendingReferral()).toBeNull();
    });

    it("returns null for empty code string", () => {
      localStorage.setItem("stackmatch-pending-referral", JSON.stringify({ code: "" }));
      expect(getPendingReferral()).toBeNull();
    });

    it("returns null for null stored value", () => {
      localStorage.setItem("stackmatch-pending-referral", JSON.stringify(null));
      expect(getPendingReferral()).toBeNull();
    });

    it("returns null for array stored value", () => {
      localStorage.setItem("stackmatch-pending-referral", JSON.stringify(["not", "an", "object"]));
      expect(getPendingReferral()).toBeNull();
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(getPendingReferral()).toBeNull();
    });
  });

  describe("clearPendingReferral", () => {
    it("removes the pending referral from localStorage", () => {
      savePendingReferral("INVITE42");
      clearPendingReferral();
      expect(localStorage.getItem("stackmatch-pending-referral")).toBeNull();
    });

    it("does not throw when nothing is stored", () => {
      expect(() => clearPendingReferral()).not.toThrow();
    });

    it("does not throw when localStorage is unavailable", () => {
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      expect(() => clearPendingReferral()).not.toThrow();
    });
  });

  describe("PendingReferral type", () => {
    it("type-checks valid PendingReferral objects", () => {
      const referral: PendingReferral = { code: "ABC123" };
      expect(referral.code).toBe("ABC123");
    });
  });
});
