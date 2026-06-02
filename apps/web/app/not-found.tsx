import { Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-8 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-400/20 to-purple-500/20 shadow-lg">
        <span className="text-3xl font-bold text-foreground dark:text-white">404</span>
      </div>

      <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-foreground dark:text-white sm:text-5xl">
        Page not found
      </h1>

      <p className="mb-10 max-w-md text-lg text-muted-foreground dark:text-neutral-400">
        The repository or stacker you are looking for doesn't exist or hasn't been analyzed yet.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/"
          className="rounded-xl bg-foreground px-8 py-3 text-sm font-semibold text-background transition-all hover:bg-foreground/85 active:scale-95 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          Back to Home
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-8 py-3 text-sm font-semibold text-foreground transition-all hover:bg-muted active:scale-95 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
        >
          <Search className="size-4" />
          Search Again
        </Link>
      </div>
    </div>
  );
}
