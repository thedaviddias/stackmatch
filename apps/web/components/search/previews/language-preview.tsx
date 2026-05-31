import { ROUTES } from "@stackmatch/config";
import { ArrowRight, Code2 } from "lucide-react";
import { ButtonCustom } from "@/components/ui/button";

interface LanguagePreviewProps {
  name: string;
  onNavigate: (href: string) => void;
}

export function LanguagePreview({ name, onNavigate }: LanguagePreviewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-5 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
        <Code2 className="h-7 w-7 text-emerald-700 dark:text-emerald-400" />
      </div>
      <h3 className="mb-1 text-lg font-black tracking-tight text-foreground dark:text-white">
        {name}
      </h3>
      <p className="mb-6 text-xs font-bold text-muted-foreground dark:text-neutral-500">
        Programming Language
      </p>
      <ButtonCustom
        type="button"
        onClick={() => onNavigate(ROUTES.language(name))}
        variant="subtle"
        size="sm"
      >
        Browse {name} packages
        <ArrowRight className="h-3 w-3" />
      </ButtonCustom>
    </div>
  );
}
