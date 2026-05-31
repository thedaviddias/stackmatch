import { ROUTES } from "@stackmatch/config";
import { Badge } from "@stackmatch/ui/badge";
import { Code2, Hash } from "lucide-react";
import Link from "next/link";

interface StackFingerprintSectionProps {
  languages: string[];
  topics: string[];
}

export function StackFingerprintSection({ languages, topics }: StackFingerprintSectionProps) {
  if (languages.length === 0 && topics.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="px-2">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-foreground dark:text-white">
          <Code2 className="h-6 w-6 text-th-accent-1" /> Stack Fingerprint
        </h2>
        <p className="mt-1 text-sm font-medium text-muted-foreground dark:text-neutral-400">
          Languages and topics from synced public repositories.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
        {languages.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <Code2 className="h-3.5 w-3.5 text-th-accent-1" />
              Languages
            </div>
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <Link
                  key={lang}
                  href={ROUTES.language(lang)}
                  className="transition-transform hover:scale-105"
                >
                  <Badge variant="emerald" size="md">
                    {lang}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {topics.length > 0 && (
          <div className="rounded-2xl border border-border bg-card/70 p-4 dark:border-neutral-800 dark:bg-neutral-950/40">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-neutral-500">
              <Hash className="h-3.5 w-3.5 text-th-accent-1" />
              Topics
            </div>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <Link
                  key={topic}
                  href={ROUTES.topic(topic)}
                  className="transition-transform hover:scale-105"
                >
                  <Badge variant="neon" size="md">
                    {topic}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
