"use client";

import { getI18n } from "@stackmatch/localization";
import { Bell, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { ButtonCustom } from "../button-custom";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
}

const i18n = getI18n();

export function NotificationModal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = i18n.actions.common.gotIt,
}: NotificationModalProps) {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id={headingId}
                className="text-xl font-black text-white uppercase tracking-tighter"
              >
                {title}
              </h2>
              <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-0.5">
                {i18n.pages.modals.notification.subtitle}
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

        <div className="mt-10 flex justify-end">
          <ButtonCustom
            type="button"
            onClick={onClose}
            variant="inverse"
            size="pill-lg"
            className="w-full sm:w-32"
          >
            {confirmLabel}
          </ButtonCustom>
        </div>
      </div>
    </div>
  );
}
