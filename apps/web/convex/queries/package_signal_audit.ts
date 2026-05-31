import {
  DEFAULT_PACKAGE_ECOSYSTEM,
  PACKAGE_SIGNAL_AUDIT_DEFAULT_LIMIT,
  PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_DEV_DEP_RATIO,
  PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_MIN_OWNER_COUNT,
  PACKAGE_SIGNAL_AUDIT_MAX_LIMIT,
  type PackageEcosystem,
} from "@stackmatch/constants/ranking";
import {
  getPackageSignalWeight,
  isLowSignalPackage,
  isNoisePackage,
} from "@stackmatch/utils/ranking";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { getAdminContext } from "../lib/moderation";

const packageEcosystemValidator = v.literal(DEFAULT_PACKAGE_ECOSYSTEM);
const PERCENT_SCALE = 100;

type PackageSignalClassification = "hardNoise" | "lowSignal" | "normal";

interface PackageSignalAuditAggregate {
  packageName: string;
  ownerCount: number;
  repoCount: number;
  depCount: number;
  devDepCount: number;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return PACKAGE_SIGNAL_AUDIT_DEFAULT_LIMIT;
  return Math.min(PACKAGE_SIGNAL_AUDIT_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

export function classifyPackageSignal(
  packageName: string,
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM
): PackageSignalClassification {
  if (isNoisePackage(packageName, ecosystem)) return "hardNoise";
  if (isLowSignalPackage(packageName, ecosystem)) return "lowSignal";
  return "normal";
}

function getSuggestedClassification(input: {
  classification: PackageSignalClassification;
  ownerCount: number;
  devDependencyRatio: number;
}): PackageSignalClassification {
  if (input.classification !== "normal") return input.classification;
  if (
    input.ownerCount >= PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_MIN_OWNER_COUNT &&
    input.devDependencyRatio >= PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_DEV_DEP_RATIO
  ) {
    return "lowSignal";
  }
  return "normal";
}

function getSuggestionReason(input: {
  classification: PackageSignalClassification;
  suggestedClassification: PackageSignalClassification;
  devDependencyRatio: number;
}): string {
  if (input.classification === "hardNoise") return "Already hard-filtered by policy.";
  if (input.classification === "lowSignal") return "Already soft-weighted by policy.";
  if (input.suggestedClassification === "lowSignal") {
    const percent = Math.round(input.devDependencyRatio * PERCENT_SCALE);
    return `${percent}% of observed usage is devDependencies; review as a low-signal candidate.`;
  }
  return "No current low-signal signal from aggregate package usage.";
}

export function buildPackageSignalAuditReport(
  rows: PackageSignalAuditAggregate[],
  ecosystem: PackageEcosystem = DEFAULT_PACKAGE_ECOSYSTEM,
  limit: number = PACKAGE_SIGNAL_AUDIT_DEFAULT_LIMIT
) {
  return [...rows]
    .sort((a, b) => b.ownerCount - a.ownerCount || b.repoCount - a.repoCount)
    .slice(0, limit)
    .map((row) => {
      const totalSectionCount = row.depCount + row.devDepCount;
      const dependencyRatio = totalSectionCount === 0 ? 0 : row.depCount / totalSectionCount;
      const devDependencyRatio = totalSectionCount === 0 ? 0 : row.devDepCount / totalSectionCount;
      const classification = classifyPackageSignal(row.packageName, ecosystem);
      const suggestedClassification = getSuggestedClassification({
        classification,
        ownerCount: row.ownerCount,
        devDependencyRatio,
      });

      return {
        ecosystem,
        packageName: row.packageName,
        ownerCount: row.ownerCount,
        repoCount: row.repoCount,
        depCount: row.depCount,
        devDepCount: row.devDepCount,
        dependencyRatio,
        devDependencyRatio,
        currentClassification: classification,
        suggestedClassification,
        signalWeight: getPackageSignalWeight(row.packageName, ecosystem),
        suggestionReason: getSuggestionReason({
          classification,
          suggestedClassification,
          devDependencyRatio,
        }),
      };
    });
}

export const getPackageSignalAudit = query({
  args: {
    ecosystem: v.optional(packageEcosystemValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAdminContext(ctx);

    const ecosystem = args.ecosystem ?? DEFAULT_PACKAGE_ECOSYSTEM;
    const limit = clampLimit(args.limit);
    const rows = await ctx.db.query("ownerPackages").collect();

    const aggregateByPackage = new Map<string, PackageSignalAuditAggregate>();
    for (const row of rows) {
      const existing = aggregateByPackage.get(row.packageName);
      if (existing) {
        existing.ownerCount += 1;
        existing.repoCount += row.repoCount;
        existing.depCount += row.depCount;
        existing.devDepCount += row.devDepCount;
        continue;
      }

      aggregateByPackage.set(row.packageName, {
        packageName: row.packageName,
        ownerCount: 1,
        repoCount: row.repoCount,
        depCount: row.depCount,
        devDepCount: row.devDepCount,
      });
    }

    return {
      ecosystem,
      limit,
      packages: buildPackageSignalAuditReport(
        Array.from(aggregateByPackage.values()),
        ecosystem,
        limit
      ),
    };
  },
});
