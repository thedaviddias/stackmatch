import { BackgroundOrbs } from "@/components/layout/background-orbs";
import { createMetadata } from "@/lib/re-exports/seo";
import { InviteRedirect } from "./invite-redirect";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: InvitePageProps) {
  const { code } = await params;

  return createMetadata({
    title: "Redeem Stackmatch Invite",
    description: "Redeem a Stackmatch referral invite.",
    path: `/invite/${encodeURIComponent(code)}`,
    noIndex: true,
  });
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { code } = await params;

  return (
    <main className="relative min-h-screen px-4 py-16">
      <BackgroundOrbs />
      <h1 className="sr-only">Redeem Stackmatch invite</h1>
      <InviteRedirect code={code} />
    </main>
  );
}
