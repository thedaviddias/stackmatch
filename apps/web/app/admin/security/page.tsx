import { ROUTES } from "@stackmatch/config";
import { createMetadata } from "@/lib/re-exports/seo";
import { AdminConvexBoundary } from "../admin-convex-boundary";
import { AdminSecurityContent } from "../admin-home-content";
import { AdminShell } from "../admin-shell";

export const metadata = createMetadata({
  title: "Security Admin",
  description: "Stackmatch security administration tools.",
  path: ROUTES.admin.security,
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminSecurityPage() {
  return (
    <AdminConvexBoundary>
      <AdminShell title="Security">
        <AdminSecurityContent />
      </AdminShell>
    </AdminConvexBoundary>
  );
}
