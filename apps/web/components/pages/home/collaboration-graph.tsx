import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { LinkCustom } from "@/components/ui/link";

const GRAPH_POSITIONS = [
  { x: 24, y: 24 },
  { x: 82, y: 18 },
  { x: 52, y: 54 },
  { x: 24, y: 76 },
  { x: 88, y: 72 },
];

const FALLBACK_GRAPH_HANDLES = ["delbaoliveira", "shadcn", "cassidoo", "tannerlinsley", "b0rk"];
const EMPTY_HANDLES: string[] = [];
const EMPTY_ENTRY_POINTS: GraphEntryPoint[] = [];
const CONNECTED_AVATAR_OVERLAP_PX = Number("-12");

interface GraphEntryPoint {
  title: string;
  href: string;
  icon: LucideIcon;
}

function dedupeHandles(handles: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const handle of handles) {
    const normalized = handle.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(handle);
  }

  return deduped;
}

export function CollaborationGraph({
  handles = EMPTY_HANDLES,
  title = "Move beyond the",
  highlightedTitle,
  description = "StackMatch.dev ranks matches using package overlap, language and topic similarity, plus social and location signals.",
  statusLabel = "Live product graph",
  entryPoints = EMPTY_ENTRY_POINTS,
}: {
  handles?: string[];
  title?: string;
  highlightedTitle?: string;
  description?: string;
  statusLabel?: string;
  entryPoints?: GraphEntryPoint[];
}) {
  const dedupedHandles = dedupeHandles(handles);
  const activeHandles =
    dedupedHandles.length >= GRAPH_POSITIONS.length
      ? dedupedHandles.slice(0, GRAPH_POSITIONS.length)
      : FALLBACK_GRAPH_HANDLES;
  const connectedAvatars = GRAPH_POSITIONS.map((position, index) => ({
    handle: activeHandles[index] ?? FALLBACK_GRAPH_HANDLES[index] ?? "github",
    x: position.x,
    y: position.y,
  }));

  return (
    <section className="relative mt-section overflow-hidden">
      <div className="group relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-3xl sm:p-7 lg:min-h-[410px] lg:p-8 dark:border-white/10 dark:bg-neutral-950/70">
        <div className="relative z-10 grid h-full grid-cols-1 gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-stretch">
          <div className="flex min-w-0 flex-col justify-center py-2">
            <div className="space-y-4">
              <h2 className="max-w-lg text-3xl font-black leading-[1.08] text-foreground sm:text-4xl lg:text-5xl dark:text-white">
                {title}
                {highlightedTitle && (
                  <>
                    <br className="hidden sm:block" />
                    <span className="text-th-accent-1">{highlightedTitle}</span>
                  </>
                )}
              </h2>
              <p className="max-w-md text-base font-medium leading-relaxed text-muted-foreground dark:text-neutral-400">
                {description}
              </p>
            </div>
            {entryPoints.length > 0 && (
              <div className="mt-6 grid max-w-md grid-cols-2 gap-2">
                {entryPoints.map((entryPoint) => {
                  const Icon = entryPoint.icon;

                  return (
                    <LinkCustom
                      href={entryPoint.href}
                      key={entryPoint.title}
                      className="group/link inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs font-black text-foreground transition-colors hover:border-th-accent-1/40 hover:bg-muted dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-white dark:hover:bg-neutral-900"
                    >
                      <Icon className="size-4 text-th-accent-1-text" />
                      <span className="truncate">{entryPoint.title}</span>
                    </LinkCustom>
                  );
                })}
              </div>
            )}
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex">
                {connectedAvatars.map((a, index) => (
                  <div
                    key={a.handle.toLowerCase()}
                    className="relative size-10 shrink-0 overflow-hidden rounded-full border-2 border-border bg-background ring-2 ring-th-accent-1/20"
                    style={{
                      marginLeft: index === 0 ? 0 : CONNECTED_AVATAR_OVERLAP_PX,
                      zIndex: connectedAvatars.length - index,
                    }}
                  >
                    <Image
                      src={`https://unavatar.io/github/${a.handle}`}
                      alt="Community node"
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="relative hidden min-h-[330px] overflow-hidden rounded-[1.5rem] lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(236,72,153,0.16),transparent_46%)] opacity-70" />
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full opacity-35"
              aria-label="Visualization of connections between developers"
              role="img"
            >
              <line
                x1="24%"
                y1="24%"
                x2="82%"
                y2="18%"
                stroke="var(--theme-accent-1)"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="animate-[pulse_4s_infinite] motion-reduce:animate-none"
              />
              <line
                x1="82%"
                y1="18%"
                x2="52%"
                y2="54%"
                stroke="var(--theme-accent-2)"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="animate-[pulse_3s_infinite] motion-reduce:animate-none"
              />
              <line
                x1="52%"
                y1="54%"
                x2="24%"
                y2="24%"
                stroke="var(--theme-accent-1)"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="animate-[pulse_5s_infinite] motion-reduce:animate-none"
              />
              <line
                x1="52%"
                y1="54%"
                x2="24%"
                y2="76%"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-foreground/40"
              />
              <line
                x1="52%"
                y1="54%"
                x2="88%"
                y2="72%"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="text-foreground/40"
              />
            </svg>

            {connectedAvatars.map((avatar) => (
              <div
                key={avatar.handle.toLowerCase()}
                className="absolute size-14 translate-x-[-50%] translate-y-[-50%] rounded-2xl border-2 border-border bg-card p-1 shadow-xl transition-transform duration-700 group-hover:scale-110 dark:border-neutral-700"
                style={{ top: `${avatar.y}%`, left: `${avatar.x}%` }}
              >
                <div className="size-full rounded-xl overflow-hidden relative">
                  <Image
                    src={`https://unavatar.io/github/${avatar.handle}`}
                    alt="Developer node"
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
