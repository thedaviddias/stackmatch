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
        "mt-8 p-8 rounded-[2rem] border border-th-accent-1/20 bg-th-accent-1/5 text-center",
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-th-accent-1/20 bg-th-accent-1/10 mx-auto mb-4">
        <Lock className="h-4 w-4 text-th-accent-1-text" />
      </div>
      <p className="text-base font-bold text-white mb-2">{message}</p>
      <p className="text-[10px] text-neutral-400 uppercase tracking-widest leading-relaxed mb-6">
        Create a free account to unlock full developer discovery.
      </p>
      <Link
        href={loginUrl}
        className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-all"
      >
        Sign in with GitHub
      </Link>
    </div>
  );
}
