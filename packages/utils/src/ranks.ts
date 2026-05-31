import type { Rank } from "@stackmatch/types/score";

export const RANKS: Rank[] = [
  {
    title: "Organic Architect",
    description: "Pure human thought. 100% natural code.",
    color: "text-green-500",
    hex: "#22c55e",
    icon: "\u{1F33F}",
  },
  {
    title: "Augmented Developer",
    description: "Human intuition enhanced by machine speed.",
    color: "text-emerald-400",
    hex: "#34d399",
    icon: "\u{2728}",
  },
  {
    title: "Cyborg Coder",
    description: "Perfectly balanced. Half biology, half logic.",
    color: "text-cyan-400",
    hex: "#22d3ee",
    icon: "\u{1F9BE}",
  },
  {
    title: "AI Pilot",
    description: "Guiding the machine to build the future.",
    color: "text-purple-400",
    hex: "#a78bfa",
    icon: "\u{1F916}",
  },
  {
    title: "Digital Overseer",
    description: "The code flows from the model. You just approve.",
    color: "text-fuchsia-500",
    hex: "#d946ef",
    icon: "\u{1F52E}",
  },
];

export function getRank(humanPercentage: number): Rank {
  const fallback: Rank = {
    title: "Unknown",
    description: "",
    color: "text-neutral-500",
    hex: "#737373",
    icon: "\u2753",
  };
  if (humanPercentage >= 95) return RANKS[0] ?? fallback; // Organic Architect
  if (humanPercentage >= 80) return RANKS[1] ?? fallback; // Augmented Developer
  if (humanPercentage >= 50) return RANKS[2] ?? fallback; // Cyborg Coder
  if (humanPercentage >= 20) return RANKS[3] ?? fallback; // AI Pilot
  return RANKS[4] ?? fallback; // Digital Overseer
}
