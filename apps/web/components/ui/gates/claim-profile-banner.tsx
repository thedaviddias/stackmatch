"use client";

import { ROUTES } from "@stackmatch/config";
import { OWNER_TYPE_ORGANIZATION, type OwnerType } from "@stackmatch/constants/owner";
import { Building2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";

interface ClaimProfileBannerProps {
  owner: string;
  ownerType?: OwnerType;
}

export function ClaimProfileBanner({ owner, ownerType }: ClaimProfileBannerProps) {
  const [loginUrl, setLoginUrl] = useState<string>(ROUTES.login);
  const isOrganization = ownerType === OWNER_TYPE_ORGANIZATION;
  const Icon = isOrganization ? Building2 : UserCheck;
  const href = isOrganization ? "/api/github-app/install" : loginUrl;

  useEffect(() => {
    setLoginUrl(buildLoginUrlForCurrentLocation());
  }, []);

  return (
    <div
      data-theme-card="claim-banner"
      className="rounded-2xl border border-amber-500/35 bg-amber-50 px-5 py-4 dark:border-amber-500/20 dark:bg-amber-500/5"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <Icon className="h-5 w-5 text-amber-700 shrink-0 hidden dark:text-amber-400 sm:block" />
          <div>
            <p className="text-sm font-black text-amber-800 dark:text-amber-300">
              {isOrganization ? `Manage @${owner}?` : `Is this you, @${owner}?`}
            </p>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5 dark:text-amber-400/70">
              {isOrganization
                ? "Verify the GitHub organization to unlock ecosystem insights and company controls."
                : "Claim your developer profile to unlock matching, following, messaging, and more."}
            </p>
          </div>
        </div>
        <Link
          data-theme-button="default"
          href={href}
          className="shrink-0 rounded-full border border-amber-600/40 bg-amber-100 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-amber-800 transition-all hover:bg-amber-200 hover:text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20 dark:hover:text-amber-200"
        >
          {isOrganization ? "Verify Organization" : "Claim Profile"}
        </Link>
      </div>
    </div>
  );
}
