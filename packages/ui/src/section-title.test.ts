import { describe, expect, it } from "vitest";
import { Badge } from "./badge";
import { ButtonCustom } from "./button-custom";
import { LinkCustom } from "./link-custom";
import { SectionTitle } from "./section-title";

describe("UI Components", () => {
  describe("SectionTitle", () => {
    it("is a valid component", () => {
      expect(typeof SectionTitle).toBe("function");
    });

    it("uses semantic foreground classes", () => {
      const rendered = SectionTitle({
        title: "Light Mode",
        description: "Semantic description",
      });

      expect(JSON.stringify(rendered)).toContain("text-foreground");
      expect(JSON.stringify(rendered)).toContain("text-muted-foreground");
    });
  });

  describe("Badge", () => {
    it("is a valid component", () => {
      expect(typeof Badge).toBe("function");
    });
  });

  describe("ButtonCustom", () => {
    it("is a valid component", () => {
      expect(typeof ButtonCustom).toBe("function");
    });
  });

  describe("LinkCustom", () => {
    it("is a valid component", () => {
      expect(typeof LinkCustom).toBe("function");
    });
  });
});
