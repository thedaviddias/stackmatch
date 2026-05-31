import { ErrorBoundary } from "@/components/error-boundary";
import { LocationSettings } from "@/components/settings/location-settings";
import { createMetadata } from "@/lib/re-exports/seo";

export const metadata = createMetadata({
  title: "Account Settings",
  description: "Manage your StackMatch account settings.",
  path: "/settings/account",
  noIndex: true,
});

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <ErrorBoundary level="widget">
        <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-8">
          <h2 className="text-lg font-black tracking-tight text-white">Account Settings</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Manage your profile settings and preferences.
          </p>
        </div>
      </ErrorBoundary>

      <ErrorBoundary level="section">
        <LocationSettings />
      </ErrorBoundary>
    </div>
  );
}
