"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackEvent } from "@/lib/storage/tracking";

interface TrackedProductLinkProps {
  href: string;
  className?: string;
  cta: string;
  surface: string;
  children: ReactNode;
}

export function TrackedProductLink({
  href,
  className,
  cta,
  surface,
  children,
}: TrackedProductLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("company_cta_clicked", { cta, surface })}
    >
      {children}
    </Link>
  );
}
