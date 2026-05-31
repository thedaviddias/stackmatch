"use client";

import {
  SiClaude,
  SiCoderabbit,
  SiCursor,
  SiGithubcopilot,
  SiGooglegemini,
  SiQodo,
  SiReplit,
  SiSentry,
  SiStackblitz,
  SiV0,
  SiWindsurf,
} from "@icons-pack/react-simple-icons";
import { ROUTES } from "@stackmatch/config";
import { Bot, Sparkles, Terminal } from "lucide-react";
import { useMemo } from "react";
import { type AiToolBreakdownItem, sortAiBreakdown } from "@/components/charts/tool-breakdown-sort";
import {
  GreptileIcon,
  LovableIcon,
  OpenAIIcon,
  SourcegraphIcon,
  TabnineIcon,
} from "@/components/icons/custom-tool-icons";

// Keys whose icons come from simple-icons (use `size` prop instead of className)
const SIMPLE_ICON_KEYS = new Set([
  "github-copilot",
  "claude-code",
  "cursor",
  "gemini",
  "coderabbit",
  "seer-by-sentry",
  "sentry-ai-reviewer",
  "qodo-merge",
  "windsurf",
  "replit-agent",
  "v0",
  "bolt",
  "openai-codex",
  "lovable",
  "greptile",
  "tabnine",
  "sourcegraph-cody",
]);

interface AIToolBreakdownProps {
  toolBreakdown: AiToolBreakdownItem[];
  viewMode: "commits" | "loc";
}

const ToolIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  "github-copilot": SiGithubcopilot,
  "claude-code": SiClaude,
  cursor: SiCursor,
  aider: Terminal,
  devin: Bot,
  "openai-codex": OpenAIIcon,
  gemini: SiGooglegemini,
  "amazon-q-developer": Bot,
  sweep: Sparkles,
  coderabbit: SiCoderabbit,
  "seer-by-sentry": SiSentry,
  "sentry-ai-reviewer": SiSentry,
  "qodo-merge": SiQodo,
  greptile: GreptileIcon,
  "korbit-ai": Sparkles,
  codeium: Sparkles,
  windsurf: SiWindsurf,
  "sourcegraph-cody": SourcegraphIcon,
  tabnine: TabnineIcon,
  "continue-dev": Sparkles,
  "replit-agent": SiReplit,
  bolt: SiStackblitz,
  v0: SiV0,
  "blackbox-ai": Sparkles,
  lovable: LovableIcon,
};

const TOOL_COLORS: Record<string, string> = {
  "github-copilot": "text-[#181717] dark:text-white",
  "claude-code": "text-[#D97757]",
  cursor: "text-[#00A3FF]",
  aider: "text-green-400",
  devin: "text-purple-400",
  "openai-codex": "text-[#181717] dark:text-white",
  gemini: "text-[#4285F4]",
  coderabbit: "text-[#FF6B2B]",
  "seer-by-sentry": "text-[#362D59]",
  "sentry-ai-reviewer": "text-[#362D59]",
  "qodo-merge": "text-[#7C3AED]",
  windsurf: "text-[#00C0FF]",
  "replit-agent": "text-[#F26207]",
  v0: "text-[#181717] dark:text-white",
  bolt: "text-[#1389FD]",
  greptile: "text-[#30B77E]",
  tabnine: "text-[#FF2210]",
  "sourcegraph-cody": "text-[#00CBEC]",
  lovable: "text-[#1E52F1]",
};

const TOOL_URLS: Record<string, string> = {
  "github-copilot": ROUTES.external.aiTools.githubCopilot,
  "claude-code": ROUTES.external.aiTools.claudeCode,
  cursor: ROUTES.external.aiTools.cursor,
  aider: ROUTES.external.aiTools.aider,
  devin: ROUTES.external.aiTools.devin,
  "openai-codex": ROUTES.external.aiTools.openaiCodex,
  gemini: ROUTES.external.aiTools.gemini,
  "amazon-q-developer": ROUTES.external.aiTools.amazonQ,
  sweep: ROUTES.external.aiTools.sweep,
  coderabbit: ROUTES.external.aiTools.coderabbit,
  "seer-by-sentry": ROUTES.external.aiTools.seerBySentry,
  "sentry-ai-reviewer": ROUTES.external.aiTools.seerBySentry,
  "qodo-merge": ROUTES.external.aiTools.qodoMerge,
  greptile: ROUTES.external.aiTools.greptile,
  "korbit-ai": ROUTES.external.aiTools.korbitAi,
  codeium: ROUTES.external.aiTools.codeium,
  windsurf: ROUTES.external.aiTools.windsurf,
  "sourcegraph-cody": ROUTES.external.aiTools.sourcegraphCody,
  tabnine: ROUTES.external.aiTools.tabnine,
  "continue-dev": ROUTES.external.aiTools.continueDev,
  "replit-agent": ROUTES.external.aiTools.replitAgent,
  bolt: ROUTES.external.aiTools.bolt,
  v0: ROUTES.external.aiTools.v0,
  "blackbox-ai": ROUTES.external.aiTools.blackboxAi,
  lovable: ROUTES.external.aiTools.lovable,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function AIToolBreakdown({ toolBreakdown, viewMode }: AIToolBreakdownProps) {
  const tools = useMemo(() => {
    if (!toolBreakdown || !Array.isArray(toolBreakdown)) return [];

    const filtered = toolBreakdown.filter((tool) =>
      viewMode === "commits" ? tool.commits > 0 : tool.additions > 0
    );
    return sortAiBreakdown(filtered, viewMode);
  }, [toolBreakdown, viewMode]);

  if (tools.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-500">
          AI Tooling Breakdown
        </h3>
        <div className="h-px flex-1 bg-neutral-800/50" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => {
          const Icon = ToolIcons[tool.key] ?? Sparkles;
          const value = viewMode === "commits" ? tool.commits : tool.additions;
          const label = viewMode === "commits" ? "Commits" : "Lines Added";
          const color = TOOL_COLORS[tool.key] ?? "text-neutral-300";
          const url = TOOL_URLS[tool.key];
          const Wrapper = url ? "a" : "div";
          const wrapperProps = url
            ? { href: url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};

          return (
            <Wrapper key={tool.key} {...wrapperProps}>
              <div
                className={`flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4${url ? " transition-colors hover:border-neutral-700 hover:bg-neutral-900/60" : ""}`}
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-lg h-10 w-10 bg-black/20 border border-neutral-800 ${color}`}
                >
                  {SIMPLE_ICON_KEYS.has(tool.key) ? (
                    <Icon size={20} />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    {tool.label}
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatNumber(value)}
                    <span className="ml-1.5 text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                      {label}
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
