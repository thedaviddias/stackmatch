export const EMAIL_DEFAULTS = {
  from: "stackmatch.dev <noreply@mail.stackmatch.dev>",
  replyTo: "support@mail.stackmatch.dev",
} as const;

export const EMAIL_BRAND = {
  primary: "#6366f1",
  secondary: "#1e1b4b",
  background: "#fafafa",
  text: "#18181b",
  mutedText: "#71717a",
  border: "#e4e4e7",
  white: "#ffffff",
} as const;

export const EMAIL_TEMPLATES = {
  welcome: "welcome",
  verification: "verification",
  notification: "notification",
} as const;

export type EmailTemplate = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];

export const EMAIL_CATEGORIES = {
  transactional: "transactional",
  notification: "notification",
  marketing: "marketing",
} as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[keyof typeof EMAIL_CATEGORIES];

export const EMAIL_URLS = {
  base: process.env.NEXT_PUBLIC_BASE_URL || "https://stackmatch.dev",
  logo: "https://stackmatch.dev/logo.png",
  unsubscribe: "/unsubscribe",
} as const;
