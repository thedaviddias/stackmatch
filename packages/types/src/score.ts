export type StakerRank =
  | "Ghost Coder"
  | "Script Scout"
  | "Assembly Architect"
  | "Full-Stack Fanatic"
  | "Hardware Hacker"
  | "Stackmate Supreme";

export interface ScoreData {
  isLoggedIn: boolean;
  hasPrivateSync: boolean;
  hasBio: boolean;
  hasSocial: boolean;
  packageCount: number;
  repoCoverage: number; // 0 to 1
  referralBonus?: number; // +5 per successful referral (both referrer & invitee)
  starsReceived?: number; // total stars received
}

export interface Rank {
  title: string;
  description: string;
  color: string; // Tailwind class
  hex: string; // Hex code for OG image
  icon: string;
}
