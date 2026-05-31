import { ROUTES } from "@stackmatch/config";
import Link from "next/link";
import { api } from "@/data/api";
import { fetchQuery } from "@/data/server";
import { getI18n } from "@/lib/re-exports/i18n";
import { createMetadata, createWebPageJsonLd } from "@/lib/re-exports/seo";

// ISR: revalidate every 2 minutes — leaderboard data doesn't change rapidly
export const revalidate = 120;

const i18n = getI18n();

export const metadata = createMetadata({
  title: i18n.metadata.pages.leaderboardStacks.title,
  description: i18n.metadata.pages.leaderboardStacks.description,
  path: ROUTES.leaderboard.stacks,
});

export default async function StackLeaderboardPage() {
  const rows = await fetchQuery(api.queries.stack.getGlobalStackLeaderboard, {
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <script type="application/ld+json">
        {JSON.stringify(
          createWebPageJsonLd({
            name: i18n.metadata.pages.leaderboardStacks.title,
            path: ROUTES.leaderboard.stacks,
            description: i18n.metadata.pages.leaderboardStacks.description,
          })
        )}
      </script>

      <header className="px-2">
        <h1 className="text-2xl font-black text-white">Stack Leaderboard</h1>
        <p className="text-sm text-neutral-400 font-medium mt-1">
          Ranked by number of owners using each package.
        </p>
      </header>

      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <Link
            key={row.packageName}
            href={ROUTES.package(row.packageName)}
            className="block min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 shadow-sm transition-colors hover:border-th-accent-1/40 hover:bg-neutral-900/70"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-black/30 font-mono text-xs font-black text-neutral-500">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-white">{row.packageName}</h3>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <div className="min-w-0 rounded-xl border border-neutral-800 bg-black/25 p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                      Owners
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-neutral-100">
                      {row.ownerCount}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-neutral-800 bg-black/25 p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                      Repos
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-neutral-100">
                      {row.repoCount}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-th-accent-1/20 bg-th-accent-1/10 p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-th-accent-1-text/70">
                      Uses
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-th-accent-1-text">
                      {row.depCount + row.devDepCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-neutral-800 glass-panel md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900/70 text-[10px] uppercase tracking-widest font-black text-neutral-500">
              <tr>
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Owners</th>
                <th className="px-6 py-4">Repos</th>
                <th className="px-6 py-4">Total Uses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {rows.map((row, index) => (
                <tr
                  key={row.packageName}
                  className="group relative transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-6 py-4 text-neutral-500 font-mono text-xs">{index + 1}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`${ROUTES.package(row.packageName)}`}
                      className="font-bold text-white hover:text-th-accent-1-text transition-colors after:absolute after:inset-0 after:z-10 after:content-['']"
                    >
                      {row.packageName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-neutral-300">{row.ownerCount}</td>
                  <td className="px-6 py-4 font-mono text-xs text-neutral-400">{row.repoCount}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-lg bg-white/5 px-2 py-1 font-mono text-[10px] font-black text-th-accent-1-text border border-white/5">
                      {row.depCount + row.devDepCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
