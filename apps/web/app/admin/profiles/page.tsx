import { ROUTES } from "@stackmatch/config";
import { createMetadata } from "@/lib/re-exports/seo";
import { AdminConvexBoundary } from "../admin-convex-boundary";
import { AdminProfilesContent } from "../admin-home-content";
import { AdminShell } from "../admin-shell";

export const metadata = createMetadata({
  title: "Profile Admin",
  description: "Stackmatch profile administration tools.",
  path: ROUTES.admin.profiles,
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminProfilesPage() {
  return (
    <AdminConvexBoundary>
      <AdminShell title="Profile Admin">
        <AdminProfilesContent />
      </AdminShell>
    </AdminConvexBoundary>
  );
}
