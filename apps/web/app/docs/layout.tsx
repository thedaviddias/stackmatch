import type { ReactNode } from "react";
import { DocsNav } from "@/components/layout/nav/docs-nav";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="py-12 sm:py-16">
      <div className="mb-10 space-y-3 px-4 sm:px-6">
        <div className="mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-th-accent-1/30 bg-th-accent-1/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-th-accent-1-text">
            Documentation
          </div>
          <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Manual
          </h1>
          <p className="max-w-3xl text-base text-neutral-400 font-medium leading-normal sm:leading-relaxed">
            Everything you need to know about Stackmatch, ranks, and our methodology.
          </p>
        </div>

        <div className="lg:hidden mb-8">
          <DocsNav mode="tabs" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl border border-neutral-800 glass-panel p-4">
              <DocsNav mode="sidebar" />
            </div>
          </aside>

          <div className="min-w-0 glass-panel rounded-3xl border border-neutral-800 p-8 sm:p-12 prose prose-invert prose-pink max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
