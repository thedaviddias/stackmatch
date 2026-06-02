"use client";

import { FileCode, FolderSearch, Link as LinkIcon, Wand2 } from "lucide-react";

interface AiConfig {
  tool: string;
  type: string;
  name: string;
}

interface AiConfigStackProps {
  configs: AiConfig[];
}

export function AiConfigStack({ configs }: AiConfigStackProps) {
  if (!configs || configs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-foreground dark:text-neutral-300">
          Detected AI Tools & Agents
        </h3>
        <div className="h-px flex-1 bg-border dark:bg-neutral-800/50" />
      </div>

      <div className="flex flex-wrap gap-2">
        {configs.map((config) => {
          const isSkill = config.tool === "skills.sh" || config.type === "Skill";
          const skillUrl = isSkill
            ? `https://skills.sh/?q=${encodeURIComponent(config.name)}`
            : null;

          const content = (
            <>
              {isSkill ? (
                <Wand2
                  className="h-3 w-3 text-purple-700 dark:text-purple-400"
                  aria-hidden="true"
                />
              ) : config.type === "Rule File" || config.type === "Rule" ? (
                <FileCode className="h-3 w-3 text-blue-700 dark:text-blue-400" aria-hidden="true" />
              ) : (
                <FolderSearch
                  className="h-3 w-3 text-muted-foreground dark:text-neutral-400"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-foreground dark:text-neutral-100">
                  {config.name}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-tighter text-muted-foreground dark:text-neutral-500">
                  {config.tool}
                </span>
              </div>
              {isSkill && (
                <LinkIcon
                  className="h-2.5 w-2.5 text-muted-foreground transition-colors group-hover:text-purple-700 dark:text-neutral-600 dark:group-hover:text-purple-400"
                  aria-hidden="true"
                />
              )}
            </>
          );

          const baseClassName =
            "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/50";
          const className = isSkill
            ? `${baseClassName} group transition-[background-color,border-color,box-shadow] hover:border-purple-500/40 hover:bg-muted hover:ring-1 hover:ring-purple-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:hover:ring-purple-500/30`
            : baseClassName;

          if (skillUrl) {
            return (
              <a
                key={`${config.tool}-${config.type}-${config.name}`}
                href={skillUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <div key={`${config.tool}-${config.type}-${config.name}`} className={className}>
              {content}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] font-medium italic text-muted-foreground dark:text-neutral-600">
        Detected via repository configuration files and agent skill directories.
      </p>
    </div>
  );
}
