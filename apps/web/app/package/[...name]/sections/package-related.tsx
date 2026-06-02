import { ROUTES } from "@stackmatch/config";
import { SectionTitle } from "@stackmatch/ui/section-title";
import { Link2 } from "lucide-react";
import {
  PackageCompareTray,
  type RelatedPackage,
} from "@/components/pages/package/package-compare-tray";
import { MetricHelpTooltip } from "@/components/ui/display/metric-help-tooltip";
import { LinkCustom } from "@/components/ui/link";

interface PackageRelatedProps {
  packageName: string;
  relatedPackages: RelatedPackage[];
}

const RELATED_PACKAGE_METRICS_TOOLTIP =
  "Counts show sampled indexed owners whose manifests include both packages. Lift is a bounded 0-10 co-occurrence score; higher means stronger co-use than baseline, not package quality.";

export function PackageRelated({ packageName, relatedPackages }: PackageRelatedProps) {
  if (relatedPackages.length === 0) return null;

  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <SectionTitle
        variant="h2"
        title="Related Packages"
        description={
          <>
            Packages commonly found in the same{" "}
            <code className="text-th-accent-1-text bg-th-accent-1/10 px-1.5 py-0.5 rounded text-xs font-mono">
              package.json
            </code>
            .
          </>
        }
        icon={Link2}
        iconClassName="text-th-accent-1-text"
      />
      <div className="flex items-center gap-1.5 px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <span>Co-use metrics</span>
        <MetricHelpTooltip label="Co-use metrics" content={RELATED_PACKAGE_METRICS_TOOLTIP} />
      </div>
      <div className="flex min-w-0 flex-wrap gap-3 px-2">
        {relatedPackages.map((pkg) => (
          <LinkCustom
            key={pkg.packageName}
            href={ROUTES.package(pkg.packageName)}
            className="group relative flex max-w-full min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground transition-all hover:-translate-y-1 hover:border-[var(--theme-hover-border)] hover:bg-muted hover:text-foreground hover:shadow-[0_8px_30px_rgba(var(--theme-hover-glow),0.1)] dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white sm:gap-3 sm:px-5"
          >
            <span className="text-th-accent-1 group-hover:scale-125 transition-transform">#</span>
            <span className="min-w-0 break-all">{pkg.packageName}</span>
            <div className="h-4 w-px bg-border group-hover:bg-th-accent-1/20 dark:bg-neutral-800" />
            <span className="text-[10px] font-black tabular-nums text-muted-foreground dark:text-neutral-500">
              {pkg.coOccurrenceCount}
            </span>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-black text-muted-foreground dark:border-neutral-800 dark:text-neutral-500">
              lift {pkg.liftScore != null ? pkg.liftScore.toFixed(2) : "N/A"}
            </span>
          </LinkCustom>
        ))}
      </div>

      <PackageCompareTray packageName={packageName} relatedPackages={relatedPackages} />
    </section>
  );
}
