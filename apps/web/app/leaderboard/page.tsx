import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Stack Leaderboard",
  description: "Redirects to the Stackmatch package stack leaderboard.",
  path: "/leaderboard",
  noIndex: true,
});

export default function LeaderboardPage() {
  redirect("/leaderboard/stacks");
}
