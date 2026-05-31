import { SectionTitle } from "@stackmatch/ui/section-title";
import { Crown } from "lucide-react";
import { PackageOwnersSection } from "@/components/pages/package/package-owners-section";

interface TopOwner {
  owner: string;
  avatarUrl: string;
  repoCount: number;
  depCount: number;
  devDepCount: number;
  totalStars: number;
  isBlurred?: boolean;
}

interface PackageOwnersProps {
  packageName: string;
  serverTopOwners: TopOwner[];
  serverTopOwnersCount: number;
}

export function PackageOwners({
  packageName,
  serverTopOwners,
  serverTopOwnersCount,
}: PackageOwnersProps) {
  return (
    <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionTitle
        variant="h2"
        title="Top Stackers"
        description={`Organizations and developers with ${packageName} in their core stack.`}
        icon={Crown}
        iconClassName="text-amber-500"
      />

      {serverTopOwners.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 p-20 text-center glass-panel">
          <p className="text-neutral-500 font-bold">No stackers found for this package yet.</p>
        </div>
      ) : (
        <PackageOwnersSection
          packageName={packageName}
          serverTopOwners={serverTopOwners}
          serverTopOwnersCount={serverTopOwnersCount}
        />
      )}
    </section>
  );
}
