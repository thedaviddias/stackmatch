import { ROUTES } from "@stackmatch/config";
import { createMetadata } from "@/lib/re-exports/seo";
import { AdminConvexBoundary } from "../admin-convex-boundary";
import { AdminAuditContent } from "../admin-home-content";
import { AdminShell } from "../admin-shell";

export const metadata = createMetadata({
  title: "Audit Admin",
  description: "Stackmatch audit administration tools.",
  path: ROUTES.admin.audit,
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminAuditPage() {
  return (
    <AdminConvexBoundary>
      <AdminShell title="Audit">
        <AdminAuditContent />
      </AdminShell>
    </AdminConvexBoundary>
  );
}
