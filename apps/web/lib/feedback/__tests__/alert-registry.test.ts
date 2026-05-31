import { describe, expect, it } from "vitest";
import { ROUTE_ERROR_ALERT_IDS, WEB_ALERTS, type WebAlertDefinition } from "../alert-registry";

const REQUIRED_STRING_FIELDS = [
  "id",
  "surface",
  "severity",
  "audience",
  "placement",
  "title",
  "description",
  "persistence",
  "ariaRole",
] as const satisfies ReadonlyArray<keyof WebAlertDefinition>;

describe("WEB_ALERTS", () => {
  it("keeps every alert definition complete and keyed by id", () => {
    for (const [key, alert] of Object.entries(WEB_ALERTS)) {
      expect(alert.id).toBe(key);

      for (const field of REQUIRED_STRING_FIELDS) {
        expect(alert[field], `${key}.${field}`).toEqual(expect.any(String));
        expect(alert[field].trim(), `${key}.${field}`).not.toBe("");
      }
    }
  });

  it("keeps every route error id backed by the registry", () => {
    for (const alertId of Object.values(ROUTE_ERROR_ALERT_IDS)) {
      expect(WEB_ALERTS[alertId].surface).toBe("route-error");
    }
  });
});
