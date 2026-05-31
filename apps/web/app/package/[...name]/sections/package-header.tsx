import { ROUTES } from "@stackmatch/config";
import { Globe, RefreshCw } from "lucide-react";
import { PackageFavicon } from "@/components/ui/display/package-favicon";
import { formatRelativeTime } from "./shared/utils";

interface PackageHeaderProps {
  packageName: string;
  description?: string | null;
  homepage?: string | null;
  repositoryUrl?: string | null;
  latestVersion?: string | null;
  license?: string | null;
  keywords?: string[] | null;
  fetchedAt?: number;
}

const KEYWORDS_PREVIEW_LIMIT = 15;

export function PackageHeader({
  packageName,
  description,
  homepage,
  repositoryUrl,
  latestVersion,
  license,
  keywords,
  fetchedAt,
}: PackageHeaderProps) {
  return (
    <section
      data-theme-card="package-header"
      className="rounded-3xl border border-neutral-800 glass-panel p-5 sm:p-8"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div
              data-theme-label="status"
              className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-th-accent-1 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-th-accent-1"></span>
              </span>
              Package Registry
            </div>
            {fetchedAt && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                <RefreshCw className="size-2.5" />
                Refreshed {formatRelativeTime(fetchedAt)}
              </span>
            )}
          </div>
          <h1 className="flex min-w-0 flex-wrap items-center gap-3 break-words text-4xl font-black tracking-tighter text-white sm:text-5xl">
            {homepage ? (
              <PackageFavicon homepage={homepage} packageName={packageName} size={32} />
            ) : null}
            <span className="min-w-0 break-words">{packageName}</span>
          </h1>
          {description ? (
            <p className="max-w-2xl text-base leading-relaxed text-neutral-400 font-medium sm:text-lg">
              {description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1 text-sm font-bold sm:gap-x-6 sm:pt-2">
            <a
              href={ROUTES.external.npm(packageName)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-th-accent-1-text hover:text-th-accent-1 transition-colors flex items-center gap-1.5"
            >
              npm <span className="text-[10px] opacity-50">↗</span>
            </a>
            {repositoryUrl ? (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
              >
                Repository <span className="text-[10px] opacity-50">↗</span>
              </a>
            ) : null}
            {homepage ? (
              <a
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5"
              >
                <Globe className="size-3.5" />
                Website <span className="text-[10px] opacity-50">↗</span>
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
          {latestVersion ? (
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <span
                data-theme-label="status"
                className="relative flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-black/40 px-4 py-2 text-xs font-black text-emerald-400 backdrop-blur-xl"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />v{latestVersion}
              </span>
            </div>
          ) : null}
          {license ? (
            <span
              data-theme-label="count"
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-xs font-bold text-neutral-500"
            >
              {license}
            </span>
          ) : null}
        </div>
      </div>

      {keywords && keywords.length > 0 ? (
        <div className="mt-10 flex flex-wrap gap-2">
          {keywords.slice(0, KEYWORDS_PREVIEW_LIMIT).map((kw) => (
            <span
              key={kw}
              data-theme-label="topic"
              className="rounded-xl border border-neutral-800 bg-black/20 px-3 py-1.5 text-[11px] font-bold text-neutral-500 transition-all hover:border-neutral-700 hover:text-neutral-300 hover:bg-black/40"
            >
              {kw}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
