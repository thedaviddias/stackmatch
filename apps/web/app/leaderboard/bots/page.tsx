import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Bot Tools Leaderboard",
  description: "Legacy Stackmatch leaderboard route that redirects to the stack leaderboard.",
  path: "/leaderboard/bots",
  noIndex: true,
});

export default function LegacyLeaderboardPage() {
  redirect("/leaderboard/stacks");
}
