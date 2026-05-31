import { cn } from "@stackmatch/utils/cn";
import type { ReactNode } from "react";

export interface SegmentedControlOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps<TValue extends string> {
  "aria-label": string;
  options: readonly SegmentedControlOption<TValue>[];
  value: TValue;
  onValueChange: (value: TValue) => void;
  className?: string;
  optionClassName?: string;
}

export function SegmentedControl<TValue extends string>({
  "aria-label": ariaLabel,
  options,
  value,
  onValueChange,
  className,
  optionClassName,
}: SegmentedControlProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex rounded-xl border border-border bg-muted p-1 dark:border-white/10 dark:bg-black/30",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            disabled={option.disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              isSelected
                ? "bg-background text-foreground shadow-sm dark:bg-white/10 dark:text-white"
                : "text-muted-foreground hover:text-foreground dark:text-neutral-400 dark:hover:text-neutral-200",
              optionClassName
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
