const STACK_OVERFLOW_TAG_OVERRIDES: Record<string, string> = {
  react: "reactjs",
  "react-dom": "reactjs",
  next: "next.js",
  nextjs: "next.js",
  vue: "vue.js",
  nuxt: "nuxt.js",
  jest: "jestjs",
  vite: "vitejs",
};

function normalizePackageName(packageName: string): string {
  const unscoped = packageName.replace(/^@[^/]+\//, "");
  return unscoped.toLowerCase().replace(/[^a-z0-9.+-]/g, "");
}

export function resolveStackOverflowTag(packageName: string): string {
  const normalized = normalizePackageName(packageName);
  return STACK_OVERFLOW_TAG_OVERRIDES[normalized] ?? normalized;
}

export const __private = {
  normalizePackageName,
  STACK_OVERFLOW_TAG_OVERRIDES,
};
