import type { EmailCategory } from "./keys";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  category?: EmailCategory;
  tags?: Array<{ name: string; value: string }>;
  scheduledAt?: Date;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface WelcomeEmailProps {
  name: string;
}

export interface VerificationEmailProps {
  name: string;
  verificationLink: string;
  expiresIn?: number;
}

export interface NotificationEmailProps {
  name: string;
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  };
}

export interface NotificationDigestEmailItem {
  text: string;
  actorOwner?: string;
  actionUrl?: string;
}

export interface NotificationDigestEmailProps {
  name: string;
  title: string;
  summary?: string;
  count: number;
  items: Array<string | NotificationDigestEmailItem>;
  action?: {
    label: string;
    url: string;
  };
}

export interface WaitlistConfirmationEmailProps {
  githubHandle: string;
  memberNumber: number;
  referralCode: string;
}

export interface EarlyAccessInviteEmailProps {
  githubHandle: string;
  inviteToken: string;
}

export interface MatchAlertEmailProps {
  name: string;
  matchedHandle: string;
  matchedAvatar: string;
  affinityScore: number;
  sharedPackages: string[];
}

export interface StarEmailProps {
  name: string;
  actorHandle: string;
  actorAvatar: string;
  powerScore: number;
}

export interface WeeklyStackPulseEmailProps {
  name: string;
  matchCount: number;
  trendingPackages: Array<{ name: string; growth: number }>;
  topMatchedPeers: Array<{ handle: string; avatar: string }>;
  globalStats: {
    totalDevelopers: string;
    newRepos: number;
  };
}
