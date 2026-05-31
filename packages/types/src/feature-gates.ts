export type GatedFeature = "follow" | "message";

export interface FeatureGates {
  canFollow: boolean;
  canMessage: boolean;
  followLimit: number;
  conversationLimit: number;
  messageDailyLimit: number;
}
