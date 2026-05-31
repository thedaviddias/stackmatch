import { describe, expect, it } from "vitest";
import {
  resolveOwnerPageAccess,
  shouldUseOwnerPublicPreview,
  shouldUsePrivatePackagesForViewer,
} from "../stack_private_visibility";

describe("shouldUsePrivatePackagesForViewer", () => {
  it("allows the owner to use private package aggregates", () => {
    expect(
      shouldUsePrivatePackagesForViewer({
        owner: "thedaviddias",
        viewerLogin: "TheDavidDias",
        showPrivateDataPublicly: false,
      })
    ).toBe(true);
  });

  it("allows visitors only after explicit public opt-in", () => {
    expect(
      shouldUsePrivatePackagesForViewer({
        owner: "thedaviddias",
        viewerLogin: "octocat",
        showPrivateDataPublicly: true,
      })
    ).toBe(true);
  });

  it("keeps visitor match scoring public-only by default", () => {
    expect(
      shouldUsePrivatePackagesForViewer({
        owner: "thedaviddias",
        viewerLogin: "octocat",
        showPrivateDataPublicly: undefined,
      })
    ).toBe(false);
  });

  it("keeps anonymous match scoring public-only without explicit opt-in", () => {
    expect(
      shouldUsePrivatePackagesForViewer({
        owner: "thedaviddias",
        viewerLogin: null,
        showPrivateDataPublicly: false,
      })
    ).toBe(false);
  });
});

describe("public owner preview", () => {
  it("honors public preview only for the signed-in owner", () => {
    expect(
      shouldUseOwnerPublicPreview({
        owner: "thedaviddias",
        viewerLogin: "TheDavidDias",
        viewAs: "public",
      })
    ).toBe(true);

    expect(
      shouldUseOwnerPublicPreview({
        owner: "thedaviddias",
        viewerLogin: "octocat",
        viewAs: "public",
      })
    ).toBe(false);
  });

  it("honors public preview for an authorized organization admin", () => {
    expect(
      shouldUseOwnerPublicPreview({
        owner: "stackmatch-labs",
        viewerLogin: "thedaviddias",
        viewAs: "public",
        isAuthorizedOwnerViewer: true,
      })
    ).toBe(true);
  });

  it("treats an owner using public preview as a public visitor", () => {
    expect(
      resolveOwnerPageAccess({
        owner: "thedaviddias",
        viewerLogin: "TheDavidDias",
        viewAs: "public",
        visibility: "public",
      })
    ).toMatchObject({
      isActualOwnerViewer: true,
      isPublicPreview: true,
      isOwnerViewer: false,
      canViewProfile: true,
    });
  });

  it("treats verified organization admins as owner viewers", () => {
    expect(
      resolveOwnerPageAccess({
        owner: "stackmatch-labs",
        viewerLogin: "thedaviddias",
        visibility: "public",
        isAuthorizedOwnerViewer: true,
      })
    ).toMatchObject({
      isActualOwnerViewer: true,
      isPublicPreview: false,
      isOwnerViewer: true,
      canViewProfile: true,
    });
  });

  it("hides private profiles from owner public preview", () => {
    expect(
      resolveOwnerPageAccess({
        owner: "thedaviddias",
        viewerLogin: "TheDavidDias",
        viewAs: "public",
        visibility: "private",
      })
    ).toMatchObject({
      isPublicPreview: true,
      isOwnerViewer: false,
      canViewProfile: false,
    });
  });
});
