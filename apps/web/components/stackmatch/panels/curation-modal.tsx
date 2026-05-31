"use client";

import { ROUTES } from "@stackmatch/config";
import { SegmentedControl, type SegmentedControlOption } from "@stackmatch/ui/segmented-control";
import {
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Search,
  SortAsc,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { TimeAgo } from "@/components/ui/display/time-ago";
import { api } from "@/data/api";
import { useMutation } from "@/data/react";

interface Repo {
  repoId: string;
  name: string;
  fullName: string;
  stars: number;
  pushedAt?: number;
  isExcluded: boolean;
}

interface CurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  repos: Repo[];
}

type SortMode = "latest" | "stars" | "name";

const SORT_OPTIONS = [
  { value: "latest", label: "Latest", icon: <Clock className="h-3 w-3" /> },
  { value: "stars", label: "Stars", icon: <Star className="h-3 w-3" /> },
  { value: "name", label: "Name", icon: <SortAsc className="h-3 w-3" /> },
] as const satisfies ReadonlyArray<SegmentedControlOption<SortMode>>;

interface RepoCurationRowProps {
  repo: Repo;
  onToggle: (repoId: string, isExcluded: boolean) => void;
}

function RepoCurationRow({ repo, onToggle }: RepoCurationRowProps) {
  return (
    <div
      key={repo.repoId}
      className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
        repo.isExcluded
          ? "border-neutral-900 bg-neutral-900/20 opacity-60"
          : "border-neutral-800 bg-white/5"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-black tracking-tight ${repo.isExcluded ? "text-neutral-500 line-through" : "text-white"}`}
        >
          {repo.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
            <Star className="h-2.5 w-2.5" /> {repo.stars}
          </span>
          {repo.pushedAt && (
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neutral-500">
              <Clock className="h-2.5 w-2.5" /> <TimeAgo timestamp={repo.pushedAt} />
            </span>
          )}
          {repo.isExcluded && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400">
              Excluded
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={ROUTES.external.github(repo.fullName)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-neutral-500 transition-all hover:bg-white/10 hover:text-white"
          title="View on GitHub"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
        <button
          type="button"
          aria-label={repo.isExcluded ? "Include in stack" : "Exclude from stack"}
          onClick={() => onToggle(repo.repoId, repo.isExcluded)}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all ${
            repo.isExcluded
              ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              : "border-red-500/30 text-red-400 hover:bg-red-500/10"
          }`}
          title={repo.isExcluded ? "Include in stack" : "Exclude from stack"}
        >
          {repo.isExcluded ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export function CurationModal({ isOpen, onClose, repos }: CurationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const toggleExclusion = useMutation(api.mutations.repos.toggleRepoExclusion);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = originalOverflow || "unset";
    };
  }, [isOpen, onClose]);

  const filteredAndSortedRepos = useMemo(() => {
    return repos
      .filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortMode === "latest") return (b.pushedAt ?? 0) - (a.pushedAt ?? 0);
        if (sortMode === "stars") return b.stars - a.stars;
        return a.name.localeCompare(b.name);
      });
  }, [repos, searchQuery, sortMode]);

  if (!isOpen) return null;

  const handleToggle = async (repoId: string, currentExcluded: boolean) => {
    try {
      // @ts-expect-error repoId is string in component, Id<"repos"> in Convex
      await toggleExclusion({ repoId, isExcluded: !currentExcluded });
      toast.success(currentExcluded ? "Repository included" : "Repository excluded");
    } catch (_error) {
      toast.error("Failed to update repository settings");
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close curation modal"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl rounded-3xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Manage Public Repos
              </h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                Exclude public repositories from your public fingerprint
              </p>
            </div>
          </div>
          <ButtonCustom
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="rounded-full border border-neutral-800 text-neutral-500 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </ButtonCustom>
        </div>

        <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-bold uppercase leading-relaxed tracking-widest text-neutral-500">
            Private repositories are selected in GitHub App settings and are not listed here.
            Stackmatch uses aggregate dependency data from selected private repositories.
          </p>
        </div>

        {/* Controls: Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900/50 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <SegmentedControl
            aria-label="Sort repositories"
            value={sortMode}
            onValueChange={setSortMode}
            options={SORT_OPTIONS}
            className="overflow-x-auto border-neutral-800 bg-neutral-900"
            optionClassName="whitespace-nowrap"
          />
        </div>

        <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-neutral-800">
          {filteredAndSortedRepos.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                No repositories found
              </p>
            </div>
          ) : (
            filteredAndSortedRepos.map((repo) => (
              <RepoCurationRow key={repo.repoId} repo={repo} onToggle={handleToggle} />
            ))
          )}
        </div>

        <div className="mt-10 flex justify-end">
          <ButtonCustom
            type="button"
            onClick={onClose}
            variant="inverse"
            size="pill-lg"
            className="w-full sm:w-32"
          >
            Done
          </ButtonCustom>
        </div>
      </div>
    </div>
  );
}
