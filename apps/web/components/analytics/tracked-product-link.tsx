"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/storage/tracking";

interface TrackedProductLinkProps {
  href: string;
  className?: string;
  cta: string;
  surface: string;
  eventName?: "company_cta_clicked" | "company_profile_cta_clicked";
  owner?: string;
  children: ReactNode;
}

export function TrackedProductLink({
  href,
  className,
  cta,
  surface,
  eventName = "company_cta_clicked",
  owner,
  children,
}: TrackedProductLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (eventName === "company_profile_cta_clicked" && owner) {
          trackEvent("company_profile_cta_clicked", { owner, cta, surface });
          return;
        }
        trackEvent("company_cta_clicked", { cta, surface });
      }}
    >
      {children}
    </Link>
  );
}
