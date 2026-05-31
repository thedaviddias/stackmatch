const DEVELOPMENT_ENV = "development";
const PREVIEW_VERCEL_ENV = "preview";

type ToolbarEnvironment = {
  NEXT_PUBLIC_VERCEL_ENV?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

export const shouldEnableStackmatchVercelToolbar = (
  env: ToolbarEnvironment = process.env
) =>
  env.NODE_ENV === DEVELOPMENT_ENV ||
  env.VERCEL_ENV === PREVIEW_VERCEL_ENV ||
  env.NEXT_PUBLIC_VERCEL_ENV === PREVIEW_VERCEL_ENV;
