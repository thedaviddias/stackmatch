import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createMetadata } from "@/lib/re-exports/seo";

interface ReferralPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: ReferralPageProps): Promise<Metadata> {
  const { code } = await params;
  const referralCode = decodeURIComponent(code).trim();

  return createMetadata({
    title: "stackmatch.dev",
    description: "Connect with developers who share your dependency stack.",
    path: `/r/${encodeURIComponent(referralCode)}`,
    noIndex: true,
  });
}

export default async function ReferralPage({ params }: ReferralPageProps) {
  await params;
  redirect("/");
}
