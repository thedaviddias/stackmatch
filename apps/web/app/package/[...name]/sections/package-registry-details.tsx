import { Boxes, CircleDollarSign, Clock3, GitFork, GitPullRequest, Star } from "lucide-react";
import { formatDownloads, type NpmEnrichedData } from "@/lib/server/package-data/npm-package-data";
import { formatCurrency, formatDateShort, formatMaybe } from "./shared/utils";

interface PackageRegistryDetailsProps {
  npmData: NpmEnrichedData;
}

export function PackageRegistryDetails({ npmData }: PackageRegistryDetailsProps) {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── NPM / GitHub / Open Collective Cards ─────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            <Boxes className="h-3.5 w-3.5 text-th-accent-1-text" />
            NPM Stats
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Monthly downloads</span>
              <span className="font-black text-white">
                {formatMaybe(npmData.monthlyDownloads, formatDownloads)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Maintainers</span>
              <span className="font-black text-white">{npmData.maintainersCount ?? "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Last published</span>
              <span className="font-black text-white">
                {formatDateShort(npmData.lastPublished ?? undefined)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Created</span>
              <span className="font-black text-white">
                {formatDateShort(npmData.createdAt ?? undefined)}
              </span>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            GitHub Stats
          </h3>
          {npmData.github ? (
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Stars</span>
                <span className="font-black text-white">
                  {formatMaybe(npmData.github.stars, (value) => value.toLocaleString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-neutral-500">
                  <GitFork className="h-3 w-3" />
                  Forks
                </span>
                <span className="font-black text-white">
                  {formatMaybe(npmData.github.forks, (value) => value.toLocaleString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-neutral-500">
                  <GitPullRequest className="h-3 w-3" />
                  Open issues
                </span>
                <span className="font-black text-white">
                  {formatMaybe(npmData.github.openIssues, (value) => value.toLocaleString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-neutral-500">
                  <Clock3 className="h-3 w-3" />
                  Last push
                </span>
                <span className="font-black text-white">
                  {formatDateShort(npmData.github.lastPushedAt ?? undefined)}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-neutral-500">No GitHub repository stats available.</p>
          )}
        </article>

        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            <CircleDollarSign className="h-3.5 w-3.5 text-emerald-400" />
            Open Collective
          </h3>
          {npmData.openCollective ? (
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Yearly budget</span>
                <span className="font-black text-white">
                  {formatCurrency(
                    npmData.openCollective.yearlyBudget,
                    npmData.openCollective.currency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">Donations</span>
                <span className="font-black text-white">
                  {formatCurrency(
                    npmData.openCollective.totalAmountDonated,
                    npmData.openCollective.currency
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-neutral-500">
                  {/* Note: Icons might be needed here if you want them back, but currently focusing on cleaning up unused ones */}
                  Backers
                </span>
                <span className="font-black text-white">
                  {npmData.openCollective.backersCount ?? "N/A"}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-neutral-500">No Open Collective profile discovered.</p>
          )}
        </article>
      </section>

      {/* ── Additional Ecosystem Signals ─────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            jsDelivr
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Hits</span>
              <span className="font-black text-white">
                {formatMaybe(npmData.jsDelivr?.hits, (v) => v.toLocaleString())}
              </span>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            Stack Overflow
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Questions</span>
              <span className="font-black text-white">
                {formatMaybe(npmData.stackOverflow?.questionCount, (value) =>
                  value.toLocaleString()
                )}
              </span>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-neutral-800 glass-panel p-6">
          <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">
            Libraries.io
          </h3>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Rank</span>
              <span className="font-black text-white">
                {formatMaybe(npmData.librariesIo?.rank, (value) => value.toLocaleString())}
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
