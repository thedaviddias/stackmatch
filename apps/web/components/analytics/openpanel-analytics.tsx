"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/components/providers/session-provider";
import { clearProfile, identifyProfile, trackEvent } from "@/lib/storage/tracking";

const TRACKABLE_CLICK_SELECTOR = "button,a,[role='button']";
const ANALYTICS_AREA_SELECTOR = "[data-analytics-area]";
const ANALYTICS_IGNORE_SELECTOR = "[data-analytics-ignore='true']";
const MAX_TRACKED_LABEL_LENGTH = 80;

function normalizeLabel(value: string | null | undefined): string | undefined {
  const label = value?.replace(/\s+/g, " ").trim();
  if (!label) return undefined;
  return label.length > MAX_TRACKED_LABEL_LENGTH
    ? `${label.slice(0, MAX_TRACKED_LABEL_LENGTH)}...`
    : label;
}

function firstLabel(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const label = normalizeLabel(value);
    if (label) return label;
  }
  return undefined;
}

function getAnalyticsArea(element: HTMLElement): string | undefined {
  const areaElement = element.closest(ANALYTICS_AREA_SELECTOR) as HTMLElement | null;
  return firstLabel(areaElement?.dataset.analyticsArea);
}

function getElementLabel(element: HTMLElement): string | undefined {
  const datasetLabel = element.dataset.analyticsLabel ?? element.dataset.trackLabel;
  const accessibleLabel = element.getAttribute("aria-label") ?? element.getAttribute("title");

  if (element.tagName.toLowerCase() === "a") {
    return firstLabel(datasetLabel, accessibleLabel);
  }

  return firstLabel(datasetLabel, accessibleLabel, element.textContent);
}

function normalizePath(pathname: string): string {
  if (pathname.startsWith("/messages/")) return "/messages/[conversationId]";
  return pathname;
}

function getTrackedHref(element: HTMLElement): { href?: string; external?: boolean } {
  if (!(element instanceof HTMLAnchorElement)) return {};
  const rawHref = element.getAttribute("href");
  if (!rawHref) return {};

  try {
    const url = new URL(rawHref, window.location.href);
    if (url.origin === window.location.origin) {
      return { href: normalizePath(url.pathname), external: false };
    }
    return { href: url.hostname || url.protocol, external: true };
  } catch {
    return { href: rawHref, external: !rawHref.startsWith("/") };
  }
}

function isDisabledElement(element: HTMLElement): boolean {
  const ariaDisabled = element.getAttribute("aria-disabled");
  return (
    ariaDisabled === "true" ||
    (element instanceof HTMLButtonElement && element.disabled) ||
    element.closest("[disabled],[aria-disabled='true']") !== null
  );
}

function getTrackableClickElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest(TRACKABLE_CLICK_SELECTOR) as HTMLElement | null;
  if (!element || element.closest(ANALYTICS_IGNORE_SELECTOR) || isDisabledElement(element)) {
    return null;
  }
  return element;
}

function trackInteraction(element: HTMLElement): void {
  const isLink = element instanceof HTMLAnchorElement;
  const eventName = isLink ? "link_clicked" : "button_clicked";
  const role = element.getAttribute("role");

  trackEvent(eventName, {
    path: normalizePath(window.location.pathname),
    element: isLink ? "link" : role === "button" ? "role_button" : "button",
    label: getElementLabel(element),
    area: getAnalyticsArea(element),
    slot: element.dataset.slot,
    variant: element.dataset.variant,
    ...getTrackedHref(element),
  });
}

function trackFormSubmit(event: SubmitEvent): void {
  if (!(event.target instanceof HTMLFormElement)) return;
  const form = event.target;
  if (form.closest(ANALYTICS_IGNORE_SELECTOR)) return;

  trackEvent("form_submitted", {
    path: normalizePath(window.location.pathname),
    label: firstLabel(
      form.dataset.analyticsLabel,
      form.getAttribute("aria-label"),
      form.name,
      form.id
    ),
    area: getAnalyticsArea(form),
  });
}

export function OpenPanelAnalytics() {
  const { session, isPending } = useSession();
  const identifiedProfileIdRef = useRef<string | null>(null);
  const profileId = session?.user?.id;

  useEffect(() => {
    if (isPending) return;

    if (profileId) {
      if (identifiedProfileIdRef.current !== profileId) {
        identifyProfile({ profileId });
        identifiedProfileIdRef.current = profileId;
      }
      return;
    }

    if (identifiedProfileIdRef.current) {
      clearProfile();
      identifiedProfileIdRef.current = null;
    }
  }, [isPending, profileId]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const element = getTrackableClickElement(event.target);
      if (element) trackInteraction(element);
    }

    document.addEventListener("click", handleClick, { capture: true });
    document.addEventListener("submit", trackFormSubmit, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      document.removeEventListener("submit", trackFormSubmit, { capture: true });
    };
  }, []);

  return null;
}
