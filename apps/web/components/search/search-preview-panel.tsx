"use client";

import type { SearchPackage, SearchUser } from "@/lib/server/directory/search-directory";
import { LanguagePreview } from "./previews/language-preview";
import { PackagePreview } from "./previews/package-preview";
import { TopicPreview } from "./previews/topic-preview";
import { UserPreview } from "./previews/user-preview";

export type PreviewData =
  | { type: "package"; data: SearchPackage }
  | { type: "user"; data: SearchUser }
  | { type: "language"; data: { name: string } }
  | { type: "topic"; data: { name: string } };

interface SearchPreviewPanelProps {
  previewData: PreviewData | undefined;
  onNavigate: (href: string) => void;
}

export function SearchPreviewPanel({ previewData, onNavigate }: SearchPreviewPanelProps) {
  if (!previewData) return null;

  return (
    <div className="hidden sm:flex w-1/2 flex-col border-l border-neutral-800/50 bg-neutral-950/30">
      <PreviewContent data={previewData} onNavigate={onNavigate} />
    </div>
  );
}

function PreviewContent({
  data,
  onNavigate,
}: {
  data: PreviewData;
  onNavigate: (href: string) => void;
}) {
  switch (data.type) {
    case "package":
      return <PackagePreview data={data.data} onNavigate={onNavigate} />;
    case "user":
      return <UserPreview data={data.data} onNavigate={onNavigate} />;
    case "language":
      return <LanguagePreview name={data.data.name} onNavigate={onNavigate} />;
    case "topic":
      return <TopicPreview name={data.data.name} onNavigate={onNavigate} />;
  }
}
