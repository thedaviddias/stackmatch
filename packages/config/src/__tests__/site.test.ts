import { describe, expect, it } from "vitest";
import { siteConfig } from "../site";

describe("siteConfig", () => {
  it("has a name", () => {
    expect(siteConfig.name).toBe("stackmatch.dev");
  });

  it("has a valid URL", () => {
    expect(siteConfig.url).toMatch(/^https:\/\//);
  });

  it("has a description", () => {
    expect(siteConfig.description).toBeTruthy();
  });

  it("has an ogImage path", () => {
    expect(siteConfig.ogImage).toBeTruthy();
  });

  it("has ownership metadata", () => {
    expect(siteConfig.ownerName).toBe("David Dias Digital");
    expect(siteConfig.ownerUrl).toBe("https://daviddias.digital");
    expect(siteConfig.founderName).toBe("David Dias");
    expect(siteConfig.founderUrl).toBe("https://thedaviddias.com");
    expect(siteConfig.contactEmail).toBe("hello@stackmatch.dev");
    expect(siteConfig.copyrightYear).toBe(2026);
  });
});
