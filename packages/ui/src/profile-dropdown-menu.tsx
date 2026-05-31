"use client";

import { cn } from "@stackmatch/utils/cn";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "./profile-tooltip";

type DropdownActionItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: React.ReactNode;
  variant?: "default" | "destructive";
};

type DropdownSeparatorItem = {
  type: "separator";
};

type DropdownMenuItem = DropdownActionItem | DropdownSeparatorItem;

function isSeparatorItem(item: DropdownMenuItem): item is DropdownSeparatorItem {
  return "type" in item && item.type === "separator";
}

function DropdownMenuActionItem({
  item,
  onSelect,
  tooltipSide,
}: {
  item: DropdownActionItem;
  onSelect: (item: DropdownActionItem) => void;
  tooltipSide: "left" | "right";
}) {
  const menuButton = (
    <button
      type="button"
      onClick={() => onSelect(item)}
      disabled={item.disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-all",
        item.variant === "destructive"
          ? "text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
          : "text-muted-foreground hover:bg-muted hover:text-foreground dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white",
        item.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-inherit"
      )}
      role="menuitem"
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{item.icon}</span>
      <span className="whitespace-nowrap">{item.label}</span>
    </button>
  );

  if (!item.tooltip || item.disabled) {
    return menuButton;
  }

  return (
    <Tooltip
      side={tooltipSide}
      className="max-w-64 text-left normal-case tracking-normal"
      trigger={menuButton}
      content={item.tooltip}
    />
  );
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  className?: string;
  align?: "left" | "right";
  ariaLabel?: string;
}

export function DropdownMenu({
  trigger,
  items,
  className,
  align = "left",
  ariaLabel = "Open menu",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleMenuItemSelect = (item: DropdownActionItem) => {
    if (item.disabled) {
      return;
    }
    item.onClick();
    setOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn("transition-all", className)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {trigger}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-max min-w-[200px] overflow-hidden rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-black/90",
            align === "left" ? "left-0" : "right-0"
          )}
          role="menu"
        >
          {items.map((item, index) =>
            isSeparatorItem(item) ? (
              <hr
                // biome-ignore lint/suspicious/noArrayIndexKey: Separators have no stable label and never reorder independently.
                key={`separator-${index}`}
                className="my-1 h-px border-0 bg-border dark:bg-neutral-800"
              />
            ) : (
              <DropdownMenuActionItem
                key={item.label}
                item={item}
                onSelect={handleMenuItemSelect}
                tooltipSide={align === "right" ? "left" : "right"}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
