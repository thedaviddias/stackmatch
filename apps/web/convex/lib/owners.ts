import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type DataCtx = Pick<QueryCtx | MutationCtx, "db">;

export function normalizeOwnerKey(owner: string): string {
  return owner.trim().toLowerCase();
}

export function areSameOwner(a: string, b: string): boolean {
  return normalizeOwnerKey(a) === normalizeOwnerKey(b);
}

export function ownerVariants(owner: string): string[] {
  const trimmed = owner.trim();
  const lower = normalizeOwnerKey(trimmed);
  return Array.from(new Set([trimmed, lower].filter(Boolean)));
}

export function getConversationParticipantOwner(
  conversation: Pick<Doc<"conversations">, "participantA" | "participantB">,
  owner: string
): string | null {
  if (areSameOwner(conversation.participantA, owner)) return conversation.participantA;
  if (areSameOwner(conversation.participantB, owner)) return conversation.participantB;
  return null;
}

export function getOtherConversationParticipant(
  conversation: Pick<Doc<"conversations">, "participantA" | "participantB">,
  owner: string
): string {
  return areSameOwner(conversation.participantA, owner)
    ? conversation.participantB
    : conversation.participantA;
}

export function sortOwnersForConversation(a: string, b: string): [string, string] {
  return normalizeOwnerKey(a) < normalizeOwnerKey(b) ? [a, b] : [b, a];
}

export async function findProfileByOwnerOrCaseVariant(
  ctx: DataCtx,
  owner: string
): Promise<Doc<"profiles"> | null> {
  for (const variant of ownerVariants(owner)) {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_owner", (q) => q.eq("owner", variant))
      .unique();
    if (profile) return profile;
  }

  return null;
}

export async function findProfileByOwnerOrAvatar(
  ctx: DataCtx,
  owner: string,
  avatarUrl: string | null | undefined
): Promise<Doc<"profiles"> | null> {
  const ownerProfile = await findProfileByOwnerOrCaseVariant(ctx, owner);
  if (ownerProfile || !avatarUrl) return ownerProfile;

  return await ctx.db
    .query("profiles")
    .withIndex("by_avatarUrl", (q) => q.eq("avatarUrl", avatarUrl))
    .first();
}
