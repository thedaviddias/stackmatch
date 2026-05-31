"use client";

import { getI18n } from "@stackmatch/localization";
import { cn } from "@stackmatch/utils/cn";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { ButtonCustom } from "../button-custom";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Modal title */
  title?: string;
  /** Modal description text */
  description?: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Whether the action is destructive (renders red) */
  destructive?: boolean;
  /** Loading state while confirm action is in progress */
  isLoading?: boolean;
}

const i18n = getI18n();

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = i18n.pages.modals.confirm.defaultTitle,
  description = i18n.pages.modals.confirm.defaultDescription,
  confirmLabel = i18n.actions.common.confirm,
  cancelLabel = i18n.actions.common.cancel,
  destructive = false,
  isLoading = false,
}: ConfirmModalProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save the element that had focus before the modal opened
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the dialog
    dialogRef.current?.focus();

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = originalOverflow || "unset";
      // Restore focus to the previously focused element
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={i18n.a11y.common.closeModal}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl animate-in zoom-in-95 duration-300 outline-none"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border",
                destructive
                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
              )}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id={headingId}
                className="text-xl font-black text-white uppercase tracking-tighter"
              >
                {title}
              </h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                {i18n.pages.modals.confirm.subtitle}
              </p>
            </div>
          </div>
          <ButtonCustom
            type="button"
            onClick={onClose}
            aria-label={i18n.a11y.common.closeModal}
            variant="ghost"
            size="icon"
            className="rounded-full border border-neutral-800 text-neutral-500 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </ButtonCustom>
        </div>

        <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>

        <div className="mt-10 space-y-3">
          <ButtonCustom
            type="button"
            onClick={() => {
              void onConfirm();
              onClose();
            }}
            disabled={isLoading}
            variant={destructive ? "destructive" : "inverse"}
            size="pill-lg"
            className="w-full aria-disabled:opacity-70"
          >
            {isLoading ? i18n.actions.common.processing : confirmLabel}
          </ButtonCustom>
          <ButtonCustom
            type="button"
            onClick={onClose}
            disabled={isLoading}
            variant="ghost"
            size="xs"
            className="h-8 w-full text-neutral-500 hover:text-neutral-300 aria-disabled:opacity-70"
          >
            {cancelLabel}
          </ButtonCustom>
        </div>
      </div>
    </div>
  );
}
