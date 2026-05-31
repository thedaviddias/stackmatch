"use client";

import { ROUTES } from "@stackmatch/config";
import { ChevronRight, Code2, Hash, Package } from "lucide-react";
import Image from "next/image";
import { CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/storage/utils";

export type SearchResultType = "package" | "user" | "language" | "topic";

interface SearchResultItemProps {
  type: SearchResultType;
  label: string;
  secondaryLabel?: string | null;
  avatarUrl?: string;
  meta?: string;
  onSelect: (href: string) => void;
}

function getHref(type: SearchResultType, label: string): string {
  switch (type) {
    case "package":
      return ROUTES.package(label);
    case "user":
      return ROUTES.owner(label);
    case "language":
      return ROUTES.language(label);
    case "topic":
      return ROUTES.topic(label);
  }
}

const typeConfig: Record<SearchResultType, { icon: React.ReactNode; accentClass: string }> = {
  package: {
    icon: <Package className="h-4 w-4 text-pink-400" />,
    accentClass: "data-[selected=true]:border-l-pink-500",
  },
  user: {
    icon: null,
    accentClass: "data-[selected=true]:border-l-purple-500",
  },
  language: {
    icon: <Code2 className="h-4 w-4 text-emerald-400" />,
    accentClass: "data-[selected=true]:border-l-emerald-500",
  },
  topic: {
    icon: <Hash className="h-4 w-4 text-purple-400" />,
    accentClass: "data-[selected=true]:border-l-purple-500",
  },
};

export function SearchResultItem({
  type,
  label,
  secondaryLabel,
  avatarUrl,
  meta,
  onSelect,
}: SearchResultItemProps) {
  const href = getHref(type, label);
  const config = typeConfig[type];

  return (
    <CommandItem
      value={`${type}:${label}`}
      onSelect={() => onSelect(href)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer border-l-2 border-l-transparent transition-all",
        "data-[selected=true]:bg-white/5",
        config.accentClass
      )}
    >
      {type === "user" && avatarUrl ? (
        <Image
          src={avatarUrl}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 rounded-full"
          aria-hidden="true"
          unoptimized
        />
      ) : (
        config.icon
      )}
      <span className="flex-1 truncate text-[15px] font-bold text-white">{label}</span>
      {secondaryLabel && secondaryLabel !== label ? (
        <span className="truncate text-sm text-neutral-500">{secondaryLabel}</span>
      ) : null}
      {meta ? (
        <span className="shrink-0 text-[11px] font-black text-neutral-600">{meta}</span>
      ) : null}
      <ChevronRight className="h-3 w-3 shrink-0 text-neutral-700 opacity-0 transition-opacity [[data-selected=true]_&]:opacity-100" />
    </CommandItem>
  );
}
