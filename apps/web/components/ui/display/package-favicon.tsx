"use client";

import Image from "next/image";
import { useState } from "react";

interface PackageFaviconProps {
  homepage: string;
  packageName: string;
  size?: 16 | 32 | 64;
  className?: string;
}

const FALLBACK_FONT_SIZE_MULTIPLIER = 0.55;

/**
 * Renders a favicon for an npm package's homepage using Google's favicon service.
 * Falls back to a text placeholder showing the first character of the package name.
 */
export function PackageFavicon({
  homepage,
  packageName,
  size = 16,
  className,
}: PackageFaviconProps) {
  const [failed, setFailed] = useState(false);

  let domain: string;
  try {
    domain = new URL(homepage).hostname;
  } catch {
    return <FaviconFallback packageName={packageName} size={size} className={className} />;
  }

  if (failed) {
    return <FaviconFallback packageName={packageName} size={size} className={className} />;
  }

  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`}
      alt=""
      width={size}
      height={size}
      className={className}
      onError={() => setFailed(true)}
      aria-hidden="true"
      unoptimized
    />
  );
}

function FaviconFallback({
  packageName,
  size,
  className,
}: {
  packageName: string;
  size: number;
  className?: string;
}) {
  const initial = packageName.replace(/^@[^/]+\//, "")[0]?.toUpperCase() ?? "#";

  return (
    <span
      className={`inline-flex items-center justify-center rounded bg-neutral-800 text-neutral-400 font-black ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: size * FALLBACK_FONT_SIZE_MULTIPLIER }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
