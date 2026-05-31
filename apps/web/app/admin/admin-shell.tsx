"use client";

import { ROUTES } from "@stackmatch/config";
import { AlertTriangle, FileSearch, Search, ServerCog, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect } from "react";
import { api } from "@/data/api";
import { useQuery } from "@/data/react";

type AdminStatus = {
  githubLogin: string;
  role: "owner" | "moderator" | "viewer";
  source: string;
};

const AdminStatusContext = createContext<AdminStatus | null>(null);

const ADMIN_NAV_ITEMS = [
  { href: ROUTES.admin.home, label: "Overview", icon: ShieldCheck },
  { href: ROUTES.admin.profiles, label: "Profiles", icon: Search },
  { href: ROUTES.admin.moderation, label: "Moderation", icon: AlertTriangle },
  { href: ROUTES.admin.audit, label: "Audit", icon: FileSearch },
  { href: ROUTES.admin.security, label: "Security", icon: ServerCog },
];

export function useAdminStatus() {
  const status = useContext(AdminStatusContext);
  if (!status) {
    throw new Error("useAdminStatus must be used inside AdminShell.");
  }
  return status;
}

export function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const adminStatus = useQuery(api.queries.moderation.getMyAdminStatus, {});

  useEffect(() => {
    if (adminStatus === null) {
      router.replace(ROUTES.home);
    }
  }, [adminStatus, router]);

  if (adminStatus === undefined) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
        <div className="mx-auto max-w-app text-sm text-muted-foreground">Loading...</div>
      </main>
    );
  }

  if (!adminStatus) {
    return null;
  }

  return (
    <AdminStatusContext.Provider value={adminStatus}>
      <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
        <div className="mx-auto flex max-w-app flex-col gap-6">
          <header className="flex flex-col gap-4 border-b border-border pb-5 dark:border-neutral-800 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-th-accent-1">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {adminStatus.role} access
                </p>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight">{title}</h1>
            </div>

            <nav className="flex flex-wrap gap-2">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                      active
                        ? "border-th-accent-1 bg-th-accent-1 text-white"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground dark:border-neutral-800"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          {children}
        </div>
      </main>
    </AdminStatusContext.Provider>
  );
}
