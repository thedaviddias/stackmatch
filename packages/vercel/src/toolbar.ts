import withVercelToolbar from "@vercel/toolbar/plugins/next";
import { shouldEnableStackmatchVercelToolbar } from "./toolbar-env";

export const withStackmatchVercelToolbar = shouldEnableStackmatchVercelToolbar()
  ? withVercelToolbar()
  : <T>(config: T) => config;

export const stackmatchToolbarCspSources = {
  scriptSrc: ["https://vercel.live"],
  imgSrc: ["https://vercel.live", "https://vercel.com"],
  connectSrc: ["https://vercel.live", "wss://ws-us3.pusher.com"],
  frameSrc: ["https://vercel.live"],
  styleSrc: ["https://vercel.live"],
  fontSrc: ["https://vercel.live", "https://assets.vercel.com"],
} as const;
