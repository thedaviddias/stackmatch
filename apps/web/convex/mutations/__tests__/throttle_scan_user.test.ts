import {
  ANONYMOUS_SCAN_COOLDOWN_MS,
  ANONYMOUS_SCAN_DAILY_LIMIT,
  AUTHENTICATED_SCAN_COOLDOWN_MS,
  AUTHENTICATED_SCAN_DAILY_LIMIT,
} from "@stackmatch/constants/sync";
import { MINUTE_MS, SECOND_MS } from "@stackmatch/constants/time";
import { describe, expect, it } from "vitest";
import { getScanThrottleScope } from "../throttle_scan_user";

const EXPECTED_ANONYMOUS_SCAN_COOLDOWN_MS = 2 * MINUTE_MS;
const EXPECTED_AUTHENTICATED_SCAN_COOLDOWN_MS = 15 * SECOND_MS;

describe("getScanThrottleScope", () => {
  it("keeps the scan cooldown windows user-friendly", () => {
    expect(ANONYMOUS_SCAN_COOLDOWN_MS).toBe(EXPECTED_ANONYMOUS_SCAN_COOLDOWN_MS);
    expect(AUTHENTICATED_SCAN_COOLDOWN_MS).toBe(EXPECTED_AUTHENTICATED_SCAN_COOLDOWN_MS);
  });

  it("uses owner and IP throttling for anonymous scans", () => {
    expect(
      getScanThrottleScope({
        owner: "OctoCat",
        ipHash: "ip_hash",
      })
    ).toEqual({
      owner: "scan:octocat",
      ipHash: "ip_hash",
      cooldownMs: ANONYMOUS_SCAN_COOLDOWN_MS,
      dailyLimit: ANONYMOUS_SCAN_DAILY_LIMIT,
    });
  });

  it("uses auth user throttling with the faster signed-in policy", () => {
    expect(
      getScanThrottleScope({
        owner: "OctoCat",
        ipHash: "ip_hash",
        submitter: {
          authUserId: "user_123",
          githubLogin: "octocat",
        },
      })
    ).toEqual({
      owner: "scan-user:user_123",
      ipHash: "signed-in",
      cooldownMs: AUTHENTICATED_SCAN_COOLDOWN_MS,
      dailyLimit: AUTHENTICATED_SCAN_DAILY_LIMIT,
    });
  });
});
