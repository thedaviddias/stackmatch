"use client";

import {
  SiCodecov,
  SiDependabot,
  SiExpo,
  SiGithubactions,
  SiGooglejules,
  SiNetlify,
  SiRenovate,
  SiSemanticrelease,
  SiSentry,
  SiSnyk,
  SiSonar,
  SiVercel,
  SiWeblate,
} from "@icons-pack/react-simple-icons";
import { ROUTES } from "@stackmatch/config";
import { Bot } from "lucide-react";
import { useMemo } from "react";
import {
  type BotToolBreakdownItem,
  sortBotBreakdown,
} from "@/components/charts/tool-breakdown-sort";

interface BotToolBreakdownProps {
  botBreakdown: BotToolBreakdownItem[];
}

const BotIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  dependabot: SiDependabot,
  renovate: SiRenovate,
  "github-actions": SiGithubactions,
  "semantic-release": SiSemanticrelease,
  "snyk-bot": SiSnyk,
  "sentry-bot": SiSentry,
  codecov: SiCodecov,
  sonarcloud: SiSonar,
  vercel: SiVercel,
  v1: SiVercel,
  "bot-v1": SiVercel,
  netlify: SiNetlify,
  "expo-bot": SiExpo,
  "bot-expo-bot": SiExpo,
  weblate: SiWeblate,
  "bot-weblate": SiWeblate,
  "google-jules": SiGooglejules,
  "bot-google-jules": SiGooglejules,
};

const BOT_COLORS: Record<string, string> = {
  dependabot: "text-[#025E8C]",
  renovate: "text-amber-500",
  "github-actions": "text-[#2088FF]",
  "semantic-release": "text-[#494949] dark:text-neutral-300",
  "snyk-bot": "text-[#4C4A73]",
  "sentry-bot": "text-[#362D59]",
  codecov: "text-[#F01F7A]",
  sonarcloud: "text-[#F3702A]",
  vercel: "text-white",
  v1: "text-white",
  "bot-v1": "text-white",
  netlify: "text-[#00C7B7]",
  "expo-bot": "text-[#000020] dark:text-white",
  "bot-expo-bot": "text-[#000020] dark:text-white",
  weblate: "text-[#2ECCAA]",
  "bot-weblate": "text-[#2ECCAA]",
  "google-jules": "text-[#4285F4]",
  "bot-google-jules": "text-[#4285F4]",
};

const BOT_URLS: Record<string, string> = {
  dependabot: ROUTES.external.botTools.dependabot,
  renovate: ROUTES.external.botTools.renovate,
  "github-actions": ROUTES.external.botTools.githubActions,
  "semantic-release": ROUTES.external.botTools.semanticRelease,
  "snyk-bot": ROUTES.external.botTools.snykBot,
  "sentry-bot": ROUTES.external.botTools.sentryBot,
  codecov: ROUTES.external.botTools.codecov,
  sonarcloud: ROUTES.external.botTools.sonarcloud,
  greenkeeper: ROUTES.external.botTools.greenkeeper,
  imgbot: ROUTES.external.botTools.imgbot,
  "all-contributors": ROUTES.external.botTools.allContributors,
  "release-please": ROUTES.external.botTools.releasePlease,
  mergify: ROUTES.external.botTools.mergify,
  vercel: ROUTES.external.botTools.vercel,
  v1: ROUTES.external.botTools.vercel,
  "bot-v1": ROUTES.external.botTools.vercel,
  netlify: ROUTES.external.botTools.netlify,
  changesets: ROUTES.external.botTools.changesets,
  kodiak: ROUTES.external.botTools.kodiak,
  "expo-bot": ROUTES.external.botTools.expoBot,
  "bot-expo-bot": ROUTES.external.botTools.expoBot,
  weblate: ROUTES.external.botTools.weblate,
  "bot-weblate": ROUTES.external.botTools.weblate,
  "google-jules": ROUTES.external.botTools.googleJules,
  "bot-google-jules": ROUTES.external.botTools.googleJules,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function BotToolBreakdown({ botBreakdown }: BotToolBreakdownProps) {
  const bots = useMemo(() => {
    if (!botBreakdown) return [];
    const filtered = botBreakdown.filter((bot) => bot.commits > 0);
    return sortBotBreakdown(filtered);
  }, [botBreakdown]);

  if (bots.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          Automation Bot Breakdown
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bots.map((bot) => {
          const Icon = BotIcons[bot.key] ?? Bot;
          const color = BOT_COLORS[bot.key] ?? "text-amber-600";
          const isSimpleIcon = bot.key in BotIcons && Icon !== Bot;
          const url = BOT_URLS[bot.key];
          const Wrapper = url ? "a" : "div";
          const wrapperProps = url
            ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Wrapper key={bot.key} {...wrapperProps}>
              <div
                className={`flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4${url ? " transition-colors hover:border-neutral-700 hover:bg-neutral-900/60" : ""}`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-lg h-10 w-10 bg-black/20 border border-neutral-800 ${color}`}
                >
                  {isSimpleIcon ? <Icon size={20} /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {bot.label}
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatNumber(bot.commits)}
                    <span className="ml-1.5 text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      Commits
                    </span>
                  </div>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
