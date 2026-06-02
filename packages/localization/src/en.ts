import type { AppCopy } from "@stackmatch/types/localization";

export const en: AppCopy = {
  metadata: {
    layout: {
      title: "Stackmatch — Find developers using your stack",
      description:
        "Scans package.json files across GitHub to build stacker-level stack fingerprints and find developers who share your dependency graph.",
    },
    root: {
      defaultTitle: "Stackmatch — Find developers with your stack",
      description:
        "Scan package.json dependencies across GitHub repos and connect with people using similar stacks.",
      twitterDescription:
        "Build a public stack fingerprint from GitHub dependencies, discover technically compatible stackmates, and explore the communities around your tools.",
      previewAlt: "Stackmatch preview",
    },
    pages: {
      developers: {
        title: "All Developers",
        description:
          "Explore every indexed developer and organization on Stackmatch, sorted by join date, followers, or stars.",
        keywords: ["developers directory", "github developers", "stackmatch directory"],
      },
      stacks: {
        title: "Stacks",
        description:
          "Explore all indexed JavaScript package stacks and discover what developers are using.",
        keywords: ["stack leaderboard", "package leaderboard", "javascript packages"],
      },
      topics: {
        title: "Topics",
        description:
          "Explore GitHub topics found across indexed Stackmatch developers and organizations.",
        keywords: ["github topics", "developer topics", "stackmatch topics"],
      },
      topStackers: {
        title: "Top Stackers This Week",
        description:
          "See the most recognized developers and organizations on Stackmatch this week.",
        keywords: ["top stackers", "weekly leaderboard", "recognized developers"],
      },
      login: {
        title: "Sign in with GitHub",
        description:
          "Sign in with GitHub to claim your Stackmatch profile. Public repositories are scanned by default; optional private analysis requires installing the Stackmatch GitHub App.",
      },
      aboutLegacy: {
        title: "About (Legacy URL)",
        description: "About documentation has moved to /docs.",
      },
      ranksLegacy: {
        title: "Ranks (Legacy URL)",
        description: "Developer ranks documentation has moved to /docs/ranks.",
      },
      leaderboardStacks: {
        title: "Stack Leaderboard",
        description: "Most common JavaScript packages across scanned owners in stackmatch.",
      },
      invite: {
        title: "You've been invited to StackMatch",
        description:
          "Join StackMatch and discover developers who share your dependency stack. Both you and your referrer earn bonus Stack Score points!",
      },
      owner: {
        title: (owner: string) => `@${owner} stack mates`,
        description: (owner: string) =>
          `Discover stackers and organizations with dependency stacks similar to ${owner}.`,
      },
      repo: {
        description: (fullName: string) =>
          `Explore ${fullName}'s package stack, repository signals, and dependency overlap on Stackmatch.`,
        keywords: (fullName: string, repoName: string) => [
          `${fullName} package stack`,
          `${fullName} dependency analysis`,
          `${repoName} stack profile`,
        ],
      },
      package: {
        title: (packageName: string) => `${packageName} — Package Stats`,
        description: (packageName: string) =>
          `Usage stats, top stackers, and related packages for ${packageName}.`,
        keywords: (packageName: string) => [packageName, "npm package", "package stats"],
      },
      language: {
        title: (language: string) => `${language} Developers — Language Stats`,
        description: (language: string) =>
          `Discover developers using ${language} as their primary language on Stackmatch.`,
        keywords: (language: string) => [language, "programming language", "developers"],
      },
      topic: {
        title: (topic: string) => `#${topic} — Topic Stats`,
        description: (topic: string) =>
          `Explore developers using the ${topic} topic on Stackmatch.`,
        keywords: (topic: string) => [topic, "github topic", "developers"],
      },
    },
  },
  navigation: {
    docs: {
      items: [
        {
          label: "About Stackmatch",
          href: "/docs",
          description: "Learn how we build stacker-level stack fingerprints.",
        },
        {
          label: "Staker Ranks",
          href: "/docs/ranks",
          description: "Understand the Stack Score and engineering tiers.",
        },
      ],
      sectionsAria: "Docs sections",
      navAria: "Docs navigation",
      sidebarHeading: "Docs",
    },
    leaderboard: {
      items: [
        {
          label: "Stacks",
          href: "/leaderboard/stacks",
          description: "Most common package stacks across indexed owners.",
        },
      ],
      sectionsAria: "Leaderboard sections",
      navAria: "Leaderboard navigation",
      sidebarHeading: "Leaderboards",
    },
  },
  pages: {
    home: {
      badge: "stackmatch",
      heroTitlePrefix: "Find developers using your",
      heroTitleHighlight: "perfect stack",
      heroDescriptionPrefix: "We scan",
      heroCodeToken: "package.json",
      heroDescriptionSuffix:
        "files across GitHub to build your unique stack fingerprint. Star compatible developers, create mutual matches, and turn shared tools into collaboration.",
      recentlyJoinedTitle: "New to Stackmatch",
      recentlyJoinedDescription: "Recently verified and indexed developers joining the community.",
      graphTitle: "Explore the Stack Graph",
      graphDescription:
        "Stackmatch is a map of developers, packages, languages, and communities connected by real dependency overlap.",
      graphDevelopersTitle: "Developers",
      graphDevelopersDescription:
        "Browse indexed stackers and organizations by join date, followers, stars, and stack reputation.",
      graphStacksTitle: "Stacks",
      graphStacksDescription:
        "See which packages define the strongest collaboration clusters across the graph.",
      graphPackagesTitle: "Package Pages",
      graphPackagesDescription:
        "Inspect top stackers, related packages, repositories, and registry context for a dependency.",
      graphCommunitiesTitle: "Languages & Topics",
      graphCommunitiesDescription:
        "Jump into TypeScript, AI, design systems, and other communities shaped by actual repos.",
      profilePreviewTitle: "Your Stackmatch page becomes a living stack profile.",
      profilePreviewDescription:
        "A GitHub handle turns into a public technical fingerprint: dependencies, languages, topics, reputation, and the stackmates most likely to ship with you.",
      profileSignalFingerprintTitle: "Stack fingerprint",
      profileSignalFingerprintDescription:
        "Top packages and repo signals show what you actually build with, not just what you list in a bio.",
      profileSignalStackmatesTitle: "Stackmates",
      profileSignalStackmatesDescription:
        "Weekly Picks, Best Matches, and Recent Activity are grouped from your dependency graph.",
      profileSignalReputationTitle: "Reputation",
      profileSignalReputationDescription:
        "Stars, mutual matches, referrals, and public stack activity help your profile level up.",
      ecosystemTitle: "A developer-first stack ecosystem.",
      ecosystemDescription:
        "Stackmatch is a David Dias Digital open-source project that stays free for developers while the public graph creates a future path for OSS and DevRel teams to support communities around the tools they build.",
      ecosystemItems: [
        {
          title: "Free core network",
          description:
            "Developers can create stack profiles, find stackmates, star matches, and message mutual connections without access gates.",
        },
        {
          title: "Trust-first company path",
          description:
            "Future company participation should mean verified presence, ecosystem support, and aggregate insight, not private behavior or privileged inbox access.",
        },
        {
          title: "Natural support surfaces",
          description:
            "Packages, topics, languages, organizations, and stack clusters remain natural places for future verified maintainer and company context.",
        },
      ],
      trendingStacksTitle: "Trending Stacks",
      trendingStacksDescription: "The most matched dependencies right now.",
      starterStacksTitle: "Popular Stacks to Explore",
      starterStacksDescription:
        "Start with widely used dependencies while the Stackmatch graph warms up.",
      starterStackBadge: "Starter pick",
      starterStackMeta: "Explore stack",
      topStarsTitle: "Top Stackers This Week",
      topStarsDescription: (weekLabel: string) => `Most recognized developers — ${weekLabel}`,
      noStarsTitle: "No stars yet this week",
      noStarsDescription: "Be the first! Star a developer above and they'll appear here.",
      followersLabel: "Followers",
      otherProjectsTitle: "Other Projects",
      otherProjectsDescription: "More open-source tools from David Dias Digital.",
      aria: {
        viewAllDevelopers: "View all developers",
        viewAllTechStacks: "View all tech stacks",
        viewAllTopStackers: "View all top stackers",
        viewAllOpenSourceProjects: "View all open source projects",
      },
    },
    developers: {
      title: "Developers",
      description: "Find every developer and organization that has joined Stackmatch.",
      eyebrow: "Developer Directory",
    },
    stacks: {
      title: "Stacks",
      description: "Browse package adoption trends across indexed developers and organizations.",
      eyebrow: "Stack Directory",
    },
    topics: {
      title: "Topics",
      description: "Browse GitHub topic communities across indexed repositories.",
      eyebrow: "Topic Directory",
    },
    login: {
      loading: "Claiming Stackmatch profile...",
      signingIn: "Connecting to GitHub...",
      signInError: "GitHub sign-in failed. Check the local auth server and try again.",
      claimProfileError: "We could not claim your Stackmatch profile. Please try again.",
      claimIssueHeading: "Profile claim needs attention",
      resolveLoginError:
        "You are signed in, but Stackmatch could not resolve your GitHub username. Sign out, then sign in with GitHub again so we can repair the account link.",
      heading: "Sign in with GitHub",
      subheading: "Claim your profile and manage your public Stackmatch fingerprint.",
      signInNotice:
        "Public repositories are scanned by default. Private repository analysis is optional and requires installing the Stackmatch GitHub App, where you choose which repositories to grant access to.",
      inviteCodeToggle: "Have an invite code?",
      inviteCodeOpen: "Open",
      inviteCodeClose: "Close",
      inviteCodeLabel: "Invite code",
      inviteCodePlaceholder: "ABCDEFGH",
      inviteCodeHelper:
        "Enter the code from your Stackmatch invite. You will continue with GitHub to claim it.",
      inviteCodeSubmit: "Continue",
      inviteCodeInvalid: "Enter the full invite code.",
      inviteCodeInvalidCharacters: "Invite codes only use supported letters and numbers.",
      howItWorksHeading: "How it works",
      privacyItems: [
        {
          title: "What we access",
          description:
            "We use GitHub OAuth for identity and read public repository metadata/package manifests needed to build your stack fingerprint. Private repositories require separate GitHub App consent.",
        },
        {
          title: "What we store",
          description:
            "We store public profile details, public repository scan status, package counts, social actions you take inside Stackmatch, and opt-in private aggregate dependency package names/counts.",
        },
        {
          title: "What we never store",
          description:
            "For private analysis, Stackmatch stores aggregate dependency package names/counts and sync status keyed to your GitHub login. It does not store private source code, file paths, commit messages, commit SHAs, or private repository names.",
        },
        {
          title: "Processing",
          description:
            "Package manifests are parsed to aggregate dependency names and counts. Source code is not cloned or stored.",
        },
        {
          title: "Visibility",
          description:
            "Public profiles show stack summaries and matches derived from public data. Private-derived aggregates stay private unless you explicitly make them public.",
        },
        {
          title: "Full control",
          description:
            "You can sign out, hide your profile, clear private aggregate data from Stackmatch, and disconnect the GitHub App locally before revoking access on GitHub.",
        },
      ],
    },
    modals: {
      confirm: {
        defaultTitle: "Are you sure?",
        defaultDescription: "This action cannot be undone.",
        subtitle: "Confirmation Required",
      },
      notification: {
        subtitle: "Notification",
      },
    },
    discovery: {
      emptyOwnerTitle: "Your tribe is still forming",
      emptyOwnerDescription:
        "Sync your repositories to sharpen your fingerprint, then explore the ecosystem to find developers who build like you.",
      emptyVisitorTitle: "No visible stackmates yet",
      emptyVisitorDescription:
        "Sign in to build your own stack fingerprint and see the developers who share your dependency graph.",
      thinFeedTitle: "Only a few stackmates so far",
      thinFeedDescription:
        "The graph is still growing. Deepen your stack or explore the ecosystem to surface more matches.",
      exploreStacksCta: "Explore trending stacks",
      exploreDevelopersCta: "Browse developers",
      signInCta: "Sign in to see your matches",
    },
  },
  feedback: {
    search: {
      invalidInput: "Enter a GitHub username or owner/repo (e.g., thedaviddias or facebook/react)",
    },
    share: {
      linkCopied: "Link copied to clipboard!",
    },
    login: {
      referralWelcome: (referrerOwner: string) =>
        `Welcome! You and @${referrerOwner} both earned +5 Stack Score! 🎉`,
      matchSuccess: (targetOwner: string) =>
        `It's a match! You and @${targetOwner} starred each other! 🎉`,
      starSuccess: (targetOwner: string) => `Starred @${targetOwner}!`,
      starFailed: "Couldn't complete the star. Try again on their profile.",
    },
  },
  a11y: {
    common: {
      closeModal: "Close modal",
    },
    login: {
      githubIcon: "GitHub",
    },
  },
  placeholders: {
    searchBar: "Search username or repo...",
  },
  actions: {
    common: {
      viewAll: "View all",
      confirm: "Confirm",
      cancel: "Cancel",
      gotIt: "Got it",
      processing: "Processing...",
      openDocs: "Open Docs",
      openDeveloperRanks: "Open Developer Ranks",
    },
    home: {
      viewAllDevelopers: "View all developers",
      viewFullLeaderboard: "View full leaderboard",
      viewAllTopStackers: "View all top stackers",
      viewAllProjects: "View all projects",
    },
    search: {
      analyze: "Analyze",
    },
    login: {
      continueWithGitHub: "Continue with GitHub",
    },
    share: {
      copyLink: "Copy Link",
      shareOnX: "Share on X",
      share: "Share",
      shareCard: "Share my stack card",
      tweetText: "Check out this developer's stack on Stackmatch!",
      tweetTextOwn:
        "Here's my dev stack fingerprint on Stackmatch — find developers who build with your tools:",
    },
  },
};
