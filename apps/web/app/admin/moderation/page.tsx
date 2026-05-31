import { ROUTES } from "@stackmatch/config";
import { createMetadata } from "@/lib/re-exports/seo";
import { AdminConvexBoundary } from "../admin-convex-boundary";
import { AdminShell } from "../admin-shell";
import { AdminModerationContent } from "./admin-moderation-content";

export const metadata = createMetadata({
  title: "Moderation Admin",
  description: "Stackmatch moderation administration tools.",
  path: ROUTES.admin.moderation,
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminModerationPage() {
  return (
    <AdminConvexBoundary>
      <AdminShell title="Moderation">
        <AdminModerationContent />
      </AdminShell>
    </AdminConvexBoundary>
  );
}
