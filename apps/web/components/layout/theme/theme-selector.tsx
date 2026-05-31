"use client";

import { Check, Palette } from "lucide-react";
import { useDesignTheme } from "@/components/providers/design-theme-provider";
import { ButtonCustom } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeSelector() {
  const { designTheme, setDesignTheme, themes } = useDesignTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ButtonCustom variant="outline" size="icon" aria-label="Change color theme">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
        </ButtonCustom>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
          Color Theme
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setDesignTheme(theme.id)}
            className="flex cursor-pointer items-center gap-3 py-2.5"
          >
            {/* Color preview dots */}
            <div className="flex -space-x-1">
              {theme.previewColors.map((color) => (
                <div
                  key={color}
                  className="h-4 w-4 rounded-full border-2 border-background dark:border-neutral-900"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm font-bold">
                {theme.emoji} {theme.label}
              </span>
            </div>
            {designTheme === theme.id && (
              <Check className="h-4 w-4 text-foreground dark:text-white" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
