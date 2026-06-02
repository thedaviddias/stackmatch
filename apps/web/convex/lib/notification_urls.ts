import { ROUTES, siteConfig } from "@stackmatch/config";

function getBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  return trimmed || siteConfig.url;
}

function buildAbsoluteUrl(path: string, baseUrl?: string): string {
  return new URL(path, getBaseUrl(baseUrl)).toString();
}

export function buildOwnerProfileNotificationUrl(owner: string, baseUrl?: string): string {
  return buildAbsoluteUrl(ROUTES.owner(owner), baseUrl);
}

export function buildNotificationsInboxUrl(baseUrl?: string): string {
  return buildAbsoluteUrl(ROUTES.notifications, baseUrl);
}

export function buildMessagesInboxUrl(baseUrl?: string): string {
  return buildAbsoluteUrl(ROUTES.messages, baseUrl);
}

export function buildMessageConversationNotificationUrl(
  conversationId: string,
  baseUrl?: string
): string {
  return buildAbsoluteUrl(`${ROUTES.messages}/${encodeURIComponent(conversationId)}`, baseUrl);
}
