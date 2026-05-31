import { ROUTES } from "@stackmatch/config";
import { createMetadata } from "@/lib/re-exports/seo";
import { AdminConvexBoundary } from "./admin-convex-boundary";
import { AdminHomeContent } from "./admin-home-content";
import { AdminShell } from "./admin-shell";

export const metadata = createMetadata({
  title: "Admin",
  description: "Stackmatch administration dashboard.",
  path: ROUTES.admin.home,
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AdminConvexBoundary>
      <AdminShell title="Admin">
        <AdminHomeContent />
      </AdminShell>
    </AdminConvexBoundary>
  );
}
