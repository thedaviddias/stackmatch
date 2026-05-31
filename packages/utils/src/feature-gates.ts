import type { FeatureGates, GatedFeature } from "@stackmatch/types/feature-gates";
import { TIER_THRESHOLDS } from "./score";

const MIN_STACK_SCORE = 0;
const MAX_STACK_SCORE = 100;

const FOLLOW_LIMIT_MAX_TIER = 500;
const FOLLOW_LIMIT_FOLLOW_TIER = 50;

const CONVERSATION_LIMIT_MAX_TIER = 20;
const CONVERSATION_LIMIT_MESSAGE_TIER = 3;

const MESSAGE_DAILY_LIMIT_MAX_TIER = 50;
const MESSAGE_DAILY_LIMIT_MESSAGE_TIER = 10;

/**
 * Computes which social features a user can access based on their Stack Score.
 *
 * Pure function — runs identically on client (for UI lock indicators) and
 * server (for mutation enforcement). No DB or auth dependency.
 */
export function getFeatureGates(stackScore: number): FeatureGates {
  const score = Math.max(MIN_STACK_SCORE, Math.min(MAX_STACK_SCORE, stackScore));

  const canFollow = score >= TIER_THRESHOLDS.FOLLOW;
  const canMessage = score >= TIER_THRESHOLDS.MESSAGE;

  return {
    canFollow,
    canMessage,
    followLimit: getFollowLimit(score),
    conversationLimit: getConversationLimit(score),
    messageDailyLimit: getMessageDailyLimit(score),
  };
}

function getFollowLimit(score: number): number {
  if (score >= TIER_THRESHOLDS.MAX_TIER) return FOLLOW_LIMIT_MAX_TIER;
  if (score >= TIER_THRESHOLDS.FOLLOW) return FOLLOW_LIMIT_FOLLOW_TIER;
  return 0;
}

function getConversationLimit(score: number): number {
  if (score >= TIER_THRESHOLDS.MAX_TIER) return CONVERSATION_LIMIT_MAX_TIER;
  if (score >= TIER_THRESHOLDS.MESSAGE) return CONVERSATION_LIMIT_MESSAGE_TIER;
  return 0;
}

function getMessageDailyLimit(score: number): number {
  if (score >= TIER_THRESHOLDS.MAX_TIER) return MESSAGE_DAILY_LIMIT_MAX_TIER;
  if (score >= TIER_THRESHOLDS.MESSAGE) return MESSAGE_DAILY_LIMIT_MESSAGE_TIER;
  return 0;
}

/**
 * Returns the minimum Stack Score required to use a given feature.
 */
export function getFeatureThreshold(feature: GatedFeature): number {
  switch (feature) {
    case "follow":
      return TIER_THRESHOLDS.FOLLOW;
    case "message":
      return TIER_THRESHOLDS.MESSAGE;
  }
}

/**
 * Returns a human-readable tier name for the given feature's unlock threshold.
 */
export function getFeatureTierName(feature: GatedFeature): string {
  switch (feature) {
    case "follow":
      return "Script Scout";
    case "message":
      return "Full-Stack Fanatic";
  }
}
