"use client";

import { ROUTES } from "@stackmatch/config";
import { Check, Copy, Gift, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent } from "react";
import { toast } from "sonner";
import { ButtonCustom } from "@/components/ui/button";
import { trackEvent } from "@/lib/storage/tracking";

export interface InviteCode {
  code: string;
  redeemedBy?: string | null;
  redeemedAt?: number | null;
  createdAt?: number;
}

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCodes: InviteCode[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onGenerate?: () => void;
}

function buildInviteUrl(code: string): string {
  const origin = typeof window === "undefined" ? "https://stackmatch.dev" : window.location.origin;
  return new URL(ROUTES.invite(encodeURIComponent(code)), origin).toString();
}

function formatInviteUrlLabel(inviteUrl: string): string {
  return new URL(inviteUrl).pathname;
}

function isInviteCodeRedeemed(inviteCode: InviteCode): boolean {
  return Boolean(inviteCode.redeemedBy || inviteCode.redeemedAt);
}

function copyInviteLinkToClipboard(inviteUrl: string) {
  navigator.clipboard.writeText(inviteUrl);
  trackEvent("invite_link_copy", {});
  toast.success("Invite link copied!");
}

export function InviteModal({
  isOpen,
  onClose,
  inviteCodes,
  isLoading = false,
  errorMessage,
  onGenerate,
}: InviteModalProps) {
  const handleClose = useEffectEvent(onClose);
  const availableInviteCodes = inviteCodes.filter(
    (inviteCode) => !isInviteCodeRedeemed(inviteCode)
  );
  const redeemedInviteCodes = inviteCodes.filter(isInviteCodeRedeemed);

  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEsc);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = originalOverflow || "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close invite modal"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl animate-in zoom-in-95 duration-300 sm:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-500 border border-pink-500/20">
              <Gift className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Invite Friends
              </h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                Share your technical DNA
              </p>
            </div>
          </div>
          <ButtonCustom
            type="button"
            aria-label="Close invite modal"
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="rounded-full border border-neutral-800 text-neutral-500 hover:text-white"
          >
            <X className="size-5" aria-hidden="true" />
          </ButtonCustom>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Available Links
              </span>
              <span className="text-[10px] font-bold text-pink-500/80 uppercase tracking-widest">
                {isLoading ? "Generating" : `${availableInviteCodes.length} remaining`}
              </span>
            </div>

            <div className="grid gap-2">
              {isLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
                  <LoaderCircle className="size-4 animate-spin text-pink-500" />
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                    Generating codes
                  </p>
                </div>
              ) : inviteCodes.length > 0 ? (
                <>
                  {availableInviteCodes.map((inviteCode) => {
                    const inviteUrl = buildInviteUrl(inviteCode.code);
                    const inviteUrlLabel = formatInviteUrlLabel(inviteUrl);

                    return (
                      <button
                        type="button"
                        key={inviteCode.code}
                        onClick={() => copyInviteLinkToClipboard(inviteUrl)}
                        className="group grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 text-left transition-all hover:bg-white/10 active:scale-[0.98]"
                      >
                        <span className="min-w-0 overflow-hidden">
                          <span className="block text-[10px] font-black uppercase tracking-widest text-pink-500/80">
                            Invite link
                          </span>
                          <code className="mt-1 block truncate text-xs font-mono font-black text-white tracking-wide">
                            {inviteUrlLabel}
                          </code>
                        </span>
                        <span className="flex min-w-0 shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500 transition-colors group-hover:text-white">
                          Copy Link <Copy className="size-3.5" />
                        </span>
                      </button>
                    );
                  })}

                  {redeemedInviteCodes.length > 0 && (
                    <div className="pt-2">
                      <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-widest text-neutral-600">
                        Redeemed invites
                      </p>
                      <div className="grid gap-2">
                        {redeemedInviteCodes.map((inviteCode) => {
                          if (inviteCode.redeemedBy) {
                            return (
                              <Link
                                key={inviteCode.code}
                                href={ROUTES.owner(inviteCode.redeemedBy)}
                                className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 text-left transition-all hover:border-emerald-500/20 hover:bg-emerald-500/10"
                              >
                                <span className="min-w-0 overflow-hidden">
                                  <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                                    Redeemed
                                  </span>
                                  <span className="mt-1 block truncate text-sm font-black text-white">
                                    @{inviteCode.redeemedBy}
                                  </span>
                                  <span className="mt-1 block text-[11px] font-bold text-emerald-400/80">
                                    +5 Stack Score earned
                                  </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400/80">
                                  Profile <Check className="size-3.5" />
                                </span>
                              </Link>
                            );
                          }

                          return (
                            <div
                              key={inviteCode.code}
                              className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 opacity-60"
                            >
                              <span className="min-w-0 overflow-hidden">
                                <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                  Redeemed
                                </span>
                                <span className="mt-1 block truncate text-xs font-black text-neutral-300">
                                  Invite link used
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                                Used
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {availableInviteCodes.length === 0 && (
                    <p className="rounded-2xl border border-dashed border-neutral-800 p-5 text-center text-xs font-bold uppercase tracking-widest text-neutral-500">
                      All invite links have been used.
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-800 p-8 text-center">
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                    {errorMessage ?? "No codes available"}
                  </p>
                  {onGenerate && (
                    <ButtonCustom
                      type="button"
                      onClick={onGenerate}
                      variant="outline"
                      size="sm"
                      className="mt-4 rounded-full border-neutral-700 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10"
                    >
                      Generate codes
                    </ButtonCustom>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 p-4">
            <p className="text-[11px] text-emerald-400/90 leading-relaxed font-medium">
              Both you and your friend will earn <span className="font-black">+5 Stack Score</span>{" "}
              when they join with your invite link.
            </p>
          </div>
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
