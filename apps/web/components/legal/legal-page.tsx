import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LinkCustom } from "@/components/ui/link";

type LegalHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type LegalFact = {
  label: string;
  value: string;
};

type LegalLink = {
  label: string;
  href: string;
};

type LegalPageProps = {
  title: string;
  eyebrow: string;
  description: string;
  updated: string;
  facts: readonly LegalFact[];
  highlights: readonly LegalHighlight[];
  links: readonly LegalLink[];
  children: ReactNode;
};

export function LegalPage({
  title,
  eyebrow,
  description,
  updated,
  facts,
  highlights,
  links,
  children,
}: LegalPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <section className="border-b border-border pb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
          {eyebrow}
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl dark:text-white">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>
          </div>
          <dl className="grid gap-3 rounded-2xl border border-border bg-card/70 p-4 shadow-sm dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Last updated
              </dt>
              <dd className="text-sm font-black text-foreground">{updated}</dd>
            </div>
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-center justify-between gap-4">
                <dt className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {fact.label}
                </dt>
                <dd className="text-right text-sm font-bold text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0 rounded-2xl border border-border bg-card/70 p-6 shadow-sm dark:bg-white/[0.03] sm:p-8 lg:p-10">
          <div className="prose max-w-none prose-neutral dark:prose-invert prose-a:font-semibold prose-a:text-th-accent-1-text prose-a:underline-offset-4 prose-headings:font-black prose-headings:tracking-tight prose-hr:border-border prose-li:marker:text-th-accent-1 prose-strong:text-foreground [&_li]:pl-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
            {children}
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm dark:bg-white/[0.03]">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              At a glance
            </h2>
            <div className="mt-4 space-y-4">
              {highlights.map((highlight) => {
                const Icon = highlight.icon;

                return (
                  <div key={highlight.title} className="flex gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-th-accent-1/20 bg-th-accent-1/10 text-th-accent-1-text">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">{highlight.title}</h3>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-muted-foreground">
                        {highlight.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <nav
            aria-label={`${title} related legal links`}
            className="rounded-2xl border border-border bg-card/70 p-5 shadow-sm dark:bg-white/[0.03]"
          >
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
              Related
            </h2>
            <div className="mt-3 grid gap-2">
              {links.map((link) => (
                <LegalRelatedLink key={link.href} link={link} />
              ))}
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function LegalRelatedLink({ link }: { link: LegalLink }) {
  const className =
    "rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted";

  if (link.href.startsWith("http")) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
        {link.label}
      </a>
    );
  }

  return (
    <LinkCustom href={link.href} className={className}>
      {link.label}
    </LinkCustom>
  );
}
