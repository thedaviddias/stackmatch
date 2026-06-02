import { MESSAGE_THREAD_LIMIT_MAX } from "@stackmatch/constants/messages";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markConversationRead, sendMessage, startConversation } from "../mutations/messages";
import {
  canMessageUser,
  getMessages,
  getMessagingUsage,
  getMyConversations,
} from "../queries/messages";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../lib/auth_helpers", () => ({
  resolveGitHubLogin: vi.fn(),
}));

vi.mock("../lib/presence", () => ({
  touchOwnerPresence: vi.fn(),
}));

const NOW = 1_800_000_000_000;
const TODAY_KEY = new Date(NOW).toISOString().slice(0, 10);
const WEEK_START = 1_799_625_600_000;
const SECRET_MESSAGE = "secret launch details";

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<string, Row[]>;

interface FakeCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  runMutation: ReturnType<typeof vi.fn>;
}

function getHandler<TArgs = Record<string, unknown>, TResult = unknown>(fn: unknown) {
  return (fn as { _handler: (ctx: FakeCtx, args: TArgs) => Promise<TResult> })._handler;
}

function makeRow(table: string, id: string, row: Record<string, unknown>): Row {
  return { _id: `${table}_${id}`, _creationTime: NOW, ...row };
}

function makeHighScoreProfile(owner: string): Row {
  return makeRow("profiles", owner, {
    owner,
    isClaimed: true,
    bio: "Secure builder",
    website: "https://example.com",
    avatarUrl: `https://github.com/${owner}.png`,
  });
}

function makeHighScoreRows(owner: string): Partial<Tables> {
  return {
    profiles: [makeHighScoreProfile(owner)],
    repos: [
      makeRow("repos", `${owner}-repo`, {
        owner,
        syncStatus: "synced",
      }),
    ],
    ownerPackages: Array.from({ length: 31 }, (_, index) =>
      makeRow("ownerPackages", `${owner}-${index}`, {
        owner,
        packageName: `pkg-${index}`,
      })
    ),
    userPrivateStackSyncStatus: [
      makeRow("userPrivateStackSyncStatus", owner, {
        githubLogin: owner,
        includesPrivateData: true,
      }),
    ],
  };
}

function mergeTables(...partials: Array<Partial<Tables>>): Tables {
  const tables: Tables = {};
  for (const partial of partials) {
    for (const [table, rows] of Object.entries(partial)) {
      tables[table] = [...(tables[table] ?? []), ...(rows ?? [])];
    }
  }
  return tables;
}

function makeQueryBuilder(tables: Tables, table: string) {
  const filters: Array<[string, unknown]> = [];
  let orderDirection: "asc" | "desc" | null = null;

  const queryApi = {
    eq(field: string | { field: string }, value: unknown) {
      filters.push([typeof field === "string" ? field : field.field, value]);
      return queryApi;
    },
    field(field: string) {
      return { field };
    },
  };

  function rows() {
    let result = [...(tables[table] ?? [])].filter((row) =>
      filters.every(([field, value]) => row[field] === value)
    );

    if (orderDirection) {
      result = result.sort((a, b) => {
        const aTime = Number(a.createdAt ?? a.lastMessageAt ?? 0);
        const bTime = Number(b.createdAt ?? b.lastMessageAt ?? 0);
        return orderDirection === "asc" ? aTime - bTime : bTime - aTime;
      });
    }

    return result;
  }

  return {
    withIndex(_indexName: string, callback: (q: typeof queryApi) => typeof queryApi) {
      callback(queryApi);
      return this;
    },
    filter(callback: (q: typeof queryApi) => typeof queryApi) {
      callback(queryApi);
      return this;
    },
    order(direction: "asc" | "desc") {
      orderDirection = direction;
      return this;
    },
    async collect() {
      return rows();
    },
    async first() {
      return rows()[0] ?? null;
    },
    async unique() {
      return rows()[0] ?? null;
    },
    async take(limit: number) {
      return rows().slice(0, limit);
    },
  };
}

function makeCtx(tablesInput: Partial<Tables> = {}): FakeCtx & { tables: Tables } {
  const tables = mergeTables(
    {
      conversations: [],
      messages: [],
      profileBlocks: [],
      profiles: [],
      repos: [],
      ownerPackages: [],
      userPrivateStackSyncStatus: [],
      stars: [],
      dailyActionCounts: [],
      notifications: [],
    },
    tablesInput
  );

  const ctx = {
    tables,
    runMutation: vi.fn().mockResolvedValue({ notificationId: "notification_1" }),
    db: {
      get: vi.fn(async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) return row;
        }
        return null;
      }),
      insert: vi.fn(async (table: string, row: Record<string, unknown>) => {
        const id = `${table}_${(tables[table] ?? []).length + 1}`;
        const stored = { _id: id, _creationTime: NOW, ...row };
        tables[table] = [...(tables[table] ?? []), stored];
        return id;
      }),
      patch: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, patch);
            return;
          }
        }
      }),
      delete: vi.fn(async (id: string) => {
        for (const [table, rows] of Object.entries(tables)) {
          tables[table] = rows.filter((row) => row._id !== id);
        }
      }),
      query: vi.fn((table: string) => makeQueryBuilder(tables, table)),
    },
  };

  return ctx;
}

async function signInAs(owner: string) {
  const { authComponent } = await import("../auth");
  const { resolveGitHubLogin } = await import("../lib/auth_helpers");
  vi.mocked(authComponent.getAuthUser).mockResolvedValue({ username: owner } as never);
  vi.mocked(resolveGitHubLogin).mockResolvedValue(owner);
}

async function signOut() {
  const { authComponent } = await import("../auth");
  vi.mocked(authComponent.getAuthUser).mockRejectedValue(new Error("Unauthenticated"));
}

function conversation(id: string, participantA = "alice", participantB = "bob") {
  return makeRow("conversations", id, {
    participantA,
    participantB,
    lastMessageAt: NOW,
    createdAt: NOW,
  });
}

function message(id: string, conversationId: string, senderOwner = "alice", body = "hello") {
  return makeRow("messages", id, {
    conversationId,
    senderOwner,
    body,
    createdAt: NOW + Number(id),
    isRead: false,
  });
}

function block(blockerOwner: string, targetOwner: string) {
  return makeRow("profileBlocks", `${blockerOwner}-${targetOwner}`, {
    blockerOwner,
    targetOwner,
    createdAt: NOW,
  });
}

function star(starrerLogin: string, targetOwner: string) {
  return makeRow("stars", `${starrerLogin}-${targetOwner}`, {
    starrerLogin,
    targetOwner,
    weekStart: WEEK_START,
    createdAt: NOW,
  });
}

function dailyMessageCount(owner: string, count: number) {
  return makeRow("dailyActionCounts", `${owner}-message-${TODAY_KEY}`, {
    owner,
    action: "message",
    date: TODAY_KEY,
    count,
  });
}

describe("message security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no messages for unauthenticated users", async () => {
    await signOut();
    const convo = conversation("1");
    const ctx = makeCtx({
      conversations: [convo],
      messages: [message("1", convo._id)],
    });

    await expect(
      getHandler(getMessages)(ctx, { conversationId: convo._id, limit: 50 })
    ).resolves.toEqual([]);
  });

  it("prevents non-participants from reading or sending", async () => {
    await signInAs("mallory");
    const convo = conversation("1", "alice", "bob");
    const ctx = makeCtx({
      ...makeHighScoreRows("mallory"),
      conversations: [convo],
      messages: [message("1", convo._id)],
    });

    await expect(
      getHandler(getMessages)(ctx, { conversationId: convo._id, limit: 50 })
    ).resolves.toEqual([]);
    await expect(
      getHandler(sendMessage)(ctx, { conversationId: convo._id, body: "hello" })
    ).rejects.toThrow("You are not a participant");
    expect(ctx.tables.dailyActionCounts).toHaveLength(0);
  });

  it("requires current-week mutual stars for new conversations", async () => {
    await signInAs("alice");
    const baseRows = makeHighScoreRows("alice");
    const oneWayCtx = makeCtx({
      ...baseRows,
      stars: [star("alice", "bob")],
    });

    await expect(getHandler(startConversation)(oneWayCtx, { targetOwner: "bob" })).rejects.toThrow(
      "starred each other this week"
    );

    const mutualCtx = makeCtx({
      ...baseRows,
      stars: [star("alice", "bob"), star("bob", "alice")],
    });

    await expect(getHandler(startConversation)(mutualCtx, { targetOwner: "bob" })).resolves.toEqual(
      {
        conversationId: "conversations_1",
        isNew: true,
      }
    );
  });

  it("reports which weekly star is missing before starting a conversation", async () => {
    await signInAs("alice");
    const baseRows = makeHighScoreRows("alice");

    await expect(
      getHandler(canMessageUser)(makeCtx(baseRows), { targetOwner: "bob" })
    ).resolves.toEqual({
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: false,
      targetHasStarredViewer: false,
    });

    await expect(
      getHandler(canMessageUser)(
        makeCtx({
          ...baseRows,
          stars: [star("alice", "bob")],
        }),
        { targetOwner: "bob" }
      )
    ).resolves.toEqual({
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: true,
      targetHasStarredViewer: false,
    });

    await expect(
      getHandler(canMessageUser)(
        makeCtx({
          ...baseRows,
          stars: [star("bob", "alice")],
        }),
        { targetOwner: "bob" }
      )
    ).resolves.toEqual({
      canMessage: false,
      reason: "no_mutual_match",
      viewerHasStarredTarget: false,
      targetHasStarredViewer: true,
    });
  });

  it("hides blocked conversations and prevents continuing them", async () => {
    await signInAs("alice");
    const convo = conversation("1", "alice", "bob");
    const ctx = makeCtx({
      ...makeHighScoreRows("alice"),
      conversations: [convo],
      messages: [message("1", convo._id)],
      profileBlocks: [block("bob", "alice")],
    });

    await expect(getHandler(getMyConversations)(ctx, { limit: 50 })).resolves.toEqual([]);
    await expect(
      getHandler(getMessages)(ctx, { conversationId: convo._id, limit: 50 })
    ).resolves.toEqual([]);
    await expect(
      getHandler(markConversationRead)(ctx, { conversationId: convo._id })
    ).resolves.toEqual({ updated: 0 });
    await expect(getHandler(canMessageUser)(ctx, { targetOwner: "bob" })).resolves.toEqual({
      canMessage: false,
      reason: "blocked",
    });
    await expect(getHandler(startConversation)(ctx, { targetOwner: "bob" })).rejects.toThrow(
      "not available"
    );
    await expect(
      getHandler(sendMessage)(ctx, { conversationId: convo._id, body: "hello" })
    ).rejects.toThrow("not available");
  });

  it("returns aggregate messaging usage without exposing message content", async () => {
    await signInAs("alice");
    const visibleConvo = conversation("1", "alice", "bob");
    const blockedConvo = conversation("2", "alice", "mallory");
    const ctx = makeCtx({
      ...makeHighScoreRows("alice"),
      conversations: [visibleConvo, blockedConvo],
      dailyActionCounts: [dailyMessageCount("alice", 2)],
      messages: [
        message("1", visibleConvo._id, "alice", SECRET_MESSAGE),
        message("2", blockedConvo._id, "mallory", "blocked thread"),
      ],
      profileBlocks: [block("mallory", "alice")],
    });

    await expect(getHandler(getMessagingUsage)(ctx, {})).resolves.toEqual({
      canMessage: true,
      conversationCount: 1,
      conversationLimit: 3,
      conversationsRemaining: 2,
      messageDailyLimit: 10,
      messagesRemainingToday: 8,
      messagesSentToday: 2,
    });
  });

  it("clamps message query limits server-side", async () => {
    await signInAs("alice");
    const convo = conversation("1", "alice", "bob");
    const ctx = makeCtx({
      conversations: [convo],
      messages: Array.from({ length: MESSAGE_THREAD_LIMIT_MAX + 5 }, (_, index) =>
        message(String(index), convo._id)
      ),
    });

    const result = await getHandler(getMessages)(ctx, {
      conversationId: convo._id,
      limit: 10_000,
    });

    expect(result).toHaveLength(MESSAGE_THREAD_LIMIT_MAX);
  });

  it("does not include message body or preview in notification payloads", async () => {
    await signInAs("alice");
    const convo = conversation("1", "alice", "bob");
    const ctx = makeCtx({
      ...makeHighScoreRows("alice"),
      conversations: [convo],
    });

    await getHandler(sendMessage)(ctx, {
      conversationId: convo._id,
      body: SECRET_MESSAGE,
    });

    const notificationArgs = ctx.runMutation.mock.calls[0]?.[1];
    expect(notificationArgs.message).toBe("@alice sent you a message.");
    expect(notificationArgs.message).not.toContain(SECRET_MESSAGE);
    expect(notificationArgs.actionUrl).toContain(`/messages/${convo._id}`);
  });

  it("marks only other participants' unread messages as read", async () => {
    await signInAs("alice");
    const convo = conversation("1", "alice", "bob");
    const mine = message("1", convo._id, "alice");
    const theirs = message("2", convo._id, "bob");
    const ctx = makeCtx({
      conversations: [convo],
      messages: [mine, theirs],
    });

    await expect(
      getHandler(markConversationRead)(ctx, { conversationId: convo._id })
    ).resolves.toEqual({ updated: 1 });
    expect(mine.isRead).toBe(false);
    expect(theirs.isRead).toBe(true);
  });
});
