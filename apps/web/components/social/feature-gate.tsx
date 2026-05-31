"use client";

import type { GatedFeature } from "@stackmatch/types";
import { getFeatureGates, getFeatureThreshold, getFeatureTierName } from "@stackmatch/utils";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

interface FeatureGateProps {
  feature: GatedFeature;
  stackScore: number;
  children: ReactNode;
  /** Fallback shown when the feature is locked. Defaults to a generic lock message. */
  lockedFallback?: ReactNode;
}

const SCORE_PERCENT_SCALE = 100;

/**
 * Conditionally renders children based on whether the user's Stack Score
 * is high enough to use the gated feature.
 *
 * When locked, shows a progress indicator and the tier name needed to unlock.
 */
export function FeatureGate({ feature, stackScore, children, lockedFallback }: FeatureGateProps) {
  const gates = getFeatureGates(stackScore);
  const isUnlocked = feature === "follow" ? gates.canFollow : gates.canMessage;

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (lockedFallback) {
    return <>{lockedFallback}</>;
  }

  const threshold = getFeatureThreshold(feature);
  const tierName = getFeatureTierName(feature);
  const progress = Math.min(
    SCORE_PERCENT_SCALE,
    Math.round((stackScore / threshold) * SCORE_PERCENT_SCALE)
  );

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
        <Lock className="h-4 w-4 text-neutral-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-neutral-300">
          Reach <span className="text-th-accent-1-text">{tierName}</span> to unlock
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Stack Score {stackScore}/{threshold}
        </p>
      </div>
      <div className="w-full max-w-[200px]">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-th-accent-1/60 to-th-accent-1 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
