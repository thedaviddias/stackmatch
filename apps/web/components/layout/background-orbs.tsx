export function BackgroundOrbs() {
  return (
    <div
      aria-hidden="true"
      data-theme-surface="background-orbs"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.08]" />
      <svg
        className="absolute inset-x-0 top-0 h-[32rem] w-full text-th-accent-1 opacity-[0.09]"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1200 520"
      >
        <title>Dependency graph background</title>
        <path
          d="M0 126C178 162 279 62 421 97c143 35 180 191 335 184 154-7 232-171 444-101"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M0 342c132-70 249-62 351 23 132 110 267 99 405-34 113-109 257-118 444-27"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="6 10"
        />
      </svg>
    </div>
  );
}
