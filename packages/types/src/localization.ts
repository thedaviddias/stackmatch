import type { NavItem } from "./navigation";

export type AppLocale = "en";

export interface MetadataPageCopy {
  title: string;
  description: string;
  keywords?: string[];
}

export interface AppCopy {
  metadata: {
    layout: {
      title: string;
      description: string;
    };
    root: {
      defaultTitle: string;
      description: string;
      twitterDescription: string;
      previewAlt: string;
    };
    pages: {
      developers: MetadataPageCopy;
      stacks: MetadataPageCopy;
      topics: MetadataPageCopy;
      topStackers: MetadataPageCopy;
      login: MetadataPageCopy;
      aboutLegacy: MetadataPageCopy;
      ranksLegacy: MetadataPageCopy;
      leaderboardStacks: MetadataPageCopy;
      invite: MetadataPageCopy;
      owner: {
        title: (owner: string) => string;
        description: (owner: string) => string;
      };
      repo: {
        description: (fullName: string) => string;
        keywords: (fullName: string, repoName: string) => string[];
      };
      package: {
        title: (packageName: string) => string;
        description: (packageName: string) => string;
        keywords: (packageName: string) => string[];
      };
      language: {
        title: (language: string) => string;
        description: (language: string) => string;
        keywords: (language: string) => string[];
      };
      topic: {
        title: (topic: string) => string;
        description: (topic: string) => string;
        keywords: (topic: string) => string[];
      };
    };
  };
  navigation: {
    docs: {
      items: NavItem[];
      sectionsAria: string;
      navAria: string;
      sidebarHeading: string;
    };
    leaderboard: {
      items: NavItem[];
      sectionsAria: string;
      navAria: string;
      sidebarHeading: string;
    };
  };
  pages: {
    home: {
      badge: string;
      heroTitlePrefix: string;
      heroTitleHighlight: string;
      heroDescriptionPrefix: string;
      heroCodeToken: string;
      heroDescriptionSuffix: string;
      recentlyJoinedTitle: string;
      recentlyJoinedDescription: string;
      graphTitle: string;
      graphDescription: string;
      graphDevelopersTitle: string;
      graphDevelopersDescription: string;
      graphStacksTitle: string;
      graphStacksDescription: string;
      graphPackagesTitle: string;
      graphPackagesDescription: string;
      graphCommunitiesTitle: string;
      graphCommunitiesDescription: string;
      profilePreviewTitle: string;
      profilePreviewDescription: string;
      profileSignalFingerprintTitle: string;
      profileSignalFingerprintDescription: string;
      profileSignalStackmatesTitle: string;
      profileSignalStackmatesDescription: string;
      profileSignalReputationTitle: string;
      profileSignalReputationDescription: string;
      ecosystemTitle: string;
      ecosystemDescription: string;
      ecosystemItems: Array<{
        title: string;
        description: string;
      }>;
      trendingStacksTitle: string;
      trendingStacksDescription: string;
      starterStacksTitle: string;
      starterStacksDescription: string;
      starterStackBadge: string;
      starterStackMeta: string;
      topStarsTitle: string;
      topStarsDescription: (weekLabel: string) => string;
      noStarsTitle: string;
      noStarsDescription: string;
      followersLabel: string;
      otherProjectsTitle: string;
      otherProjectsDescription: string;
      aria: {
        viewAllDevelopers: string;
        viewAllTechStacks: string;
        viewAllTopStackers: string;
        viewAllOpenSourceProjects: string;
      };
    };
    developers: {
      title: string;
      description: string;
      eyebrow: string;
    };
    stacks: {
      title: string;
      description: string;
      eyebrow: string;
    };
    topics: {
      title: string;
      description: string;
      eyebrow: string;
    };
    login: {
      loading: string;
      signingIn: string;
      signInError: string;
      claimProfileError: string;
      claimIssueHeading: string;
      resolveLoginError: string;
      heading: string;
      subheading: string;
      signInNotice: string;
      howItWorksHeading: string;
      privacyItems: Array<{
        title: string;
        description: string;
      }>;
    };
    modals: {
      confirm: {
        defaultTitle: string;
        defaultDescription: string;
        subtitle: string;
      };
      notification: {
        subtitle: string;
      };
    };
    discovery: {
      emptyOwnerTitle: string;
      emptyOwnerDescription: string;
      emptyVisitorTitle: string;
      emptyVisitorDescription: string;
      thinFeedTitle: string;
      thinFeedDescription: string;
      exploreStacksCta: string;
      exploreDevelopersCta: string;
      signInCta: string;
    };
  };
  feedback: {
    search: {
      invalidInput: string;
    };
    share: {
      linkCopied: string;
    };
    login: {
      referralWelcome: (referrerOwner: string) => string;
      matchSuccess: (targetOwner: string) => string;
      starSuccess: (targetOwner: string) => string;
      starFailed: string;
    };
  };
  a11y: {
    common: {
      closeModal: string;
    };
    login: {
      githubIcon: string;
    };
  };
  placeholders: {
    searchBar: string;
  };
  actions: {
    common: {
      viewAll: string;
      confirm: string;
      cancel: string;
      gotIt: string;
      processing: string;
      openDocs: string;
      openDeveloperRanks: string;
    };
    home: {
      viewAllDevelopers: string;
      viewFullLeaderboard: string;
      viewAllTopStackers: string;
      viewAllProjects: string;
    };
    search: {
      analyze: string;
    };
    login: {
      continueWithGitHub: string;
    };
    share: {
      copyLink: string;
      shareOnX: string;
      share: string;
      shareCard: string;
      tweetText: string;
      tweetTextOwn: string;
    };
  };
}
