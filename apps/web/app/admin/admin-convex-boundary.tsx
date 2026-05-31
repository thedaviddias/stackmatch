"use client";

import type { ReactNode } from "react";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";

export function AdminConvexBoundary({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
