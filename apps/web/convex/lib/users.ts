import { v } from "convex/values";
import { components } from "../_generated/api";
import { internalQuery } from "../_generated/server";

export const getUserByLogin = internalQuery({
  args: { login: v.string() },
  handler: async (ctx, args) => {
    const byUsername = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "username", value: args.login }],
    });

    if (byUsername) {
      return byUsername;
    }

    return await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "displayUsername", value: args.login }],
    });
  },
});
