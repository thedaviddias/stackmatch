"use client";

import { ROUTES } from "@stackmatch/config";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildLoginUrlForCurrentLocation } from "@/lib/auth/login-url";
import { cn } from "@/lib/storage/utils";

interface SignInGateCtaProps {
  message: string;
  className?: string;
}

export function SignInGateCta({ message, className }: SignInGateCtaProps) {
  const [loginUrl, setLoginUrl] = useState<string>(ROUTES.login);

  useEffect(() => {
    setLoginUrl(buildLoginUrlForCurrentLocation());
  }, []);

  return (
    <div
      className={cn(
        "mt-8 rounded-3xl border border-th-accent-1/25 bg-th-accent-1/10 p-8 text-center shadow-sm",
        "dark:border-th-accent-1/20 dark:bg-th-accent-1/5",
        className
      )}
    >
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-th-accent-1/25 bg-background text-th-accent-1-text shadow-sm dark:bg-th-accent-1/10">
        <Lock className="h-4 w-4 text-th-accent-1-text" />
      </div>
      <p className="mb-2 text-base font-bold text-foreground dark:text-white">{message}</p>
      <p className="mb-6 text-[10px] font-medium uppercase leading-relaxed tracking-widest text-muted-foreground dark:text-neutral-400">
        Create a free account to unlock full developer discovery.
      </p>
      <Link
        href={loginUrl}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-foreground px-8 py-3 text-[10px] font-black uppercase tracking-widest text-background transition-[background-color,border-color,color] hover:bg-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent-1 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
      >
        Connect GitHub
      </Link>
    </div>
  );
}
