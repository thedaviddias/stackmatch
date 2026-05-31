import type { ReactNode } from "react";
import type { WebAlertAriaRole, WebAlertSeverity } from "@/lib/feedback/alert-registry";
import { cn } from "@/lib/storage/utils";

type AppAlertVariant = "banner" | "inline";

interface AppAlertProps {
  severity: WebAlertSeverity;
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  role?: WebAlertAriaRole;
  variant?: AppAlertVariant;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

const ALERT_TONE_CLASSES = {
  info: {
    card: "border-th-accent-2/20 bg-th-accent-2/5",
    title: "text-th-accent-2-text",
    body: "text-foreground dark:text-neutral-300",
  },
  success: {
    card: "border-emerald-500/25 bg-emerald-500/10",
    title: "text-emerald-700 dark:text-emerald-300",
    body: "text-foreground dark:text-neutral-300",
  },
  warning: {
    card: "border-amber-400/25 bg-amber-400/10",
    title: "text-amber-800 dark:text-amber-300",
    body: "text-foreground dark:text-neutral-300",
  },
  error: {
    card: "border-rose-500/30 bg-rose-500/10",
    title: "text-rose-700 dark:text-rose-400",
    body: "text-foreground dark:text-neutral-300",
  },
} as const satisfies Record<WebAlertSeverity, { card: string; title: string; body: string }>;

function getThemeCard(severity: WebAlertSeverity): string {
  if (severity === "error") return "alert-danger";
  if (severity === "warning") return "alert-warning";
  return "alert-info";
}

export function AppAlert({
  severity,
  title,
  children,
  action,
  role = "none",
  variant = "banner",
  className,
  titleClassName,
  bodyClassName,
}: AppAlertProps) {
  const tone = ALERT_TONE_CLASSES[severity];

  return (
    <div
      data-theme-card={getThemeCard(severity)}
      role={role === "none" ? undefined : role}
      className={cn(
        "rounded-2xl border px-5 py-4",
        tone.card,
        variant === "inline" && "rounded-lg px-4 py-3",
        className
      )}
    >
      {title ? (
        <p
          className={cn(
            "text-[10px] font-black uppercase tracking-widest",
            tone.title,
            titleClassName
          )}
        >
          {title}
        </p>
      ) : null}
      <div className={cn(title ? "mt-1" : "", "text-sm", tone.body, bodyClassName)}>{children}</div>
      {action ? <div className="mt-3 flex flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  );
}
