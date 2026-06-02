export function BrandPulseDot() {
  return (
    <span aria-hidden="true" data-brand-pulse-dot className="relative flex size-2.5 shrink-0">
      <span
        data-brand-pulse-dot-halo
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-th-accent-1 opacity-75"
      />
      <span
        data-brand-pulse-dot-core
        className="relative inline-flex size-2.5 rounded-full bg-th-accent-1"
      />
    </span>
  );
}
