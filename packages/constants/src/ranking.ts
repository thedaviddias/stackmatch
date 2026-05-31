export const LOW_SIGNAL_PACKAGE_WEIGHT = 0.25;
export const DEFAULT_PACKAGE_SIGNAL_WEIGHT = 1;

export const PACKAGE_ECOSYSTEMS = ["npm"] as const;
export type PackageEcosystem = (typeof PACKAGE_ECOSYSTEMS)[number];
export const DEFAULT_PACKAGE_ECOSYSTEM: PackageEcosystem = "npm";

export interface PackageSignalPolicy {
  hardNoisePackagePrefixes: readonly string[];
  lowSignalPackageNames: readonly string[];
  lowSignalPackagePrefixes: readonly string[];
}

export const PACKAGE_SIGNAL_POLICIES = {
  npm: {
    hardNoisePackagePrefixes: [
      "@types/",
      "@babel/",
      "eslint-config-",
      "eslint-plugin-",
      "@typescript-eslint/",
      "@eslint/",
      "prettier-config-",
      "prettier-plugin-",
    ],
    lowSignalPackageNames: [
      "eslint",
      "prettier",
      "typescript",
      "vitest",
      "jest",
      "mocha",
      "ava",
      "ts-node",
      "tsx",
      "tsup",
      "biome",
      "lefthook",
      "husky",
      "lint-staged",
      "commitlint",
      "changesets",
    ],
    lowSignalPackagePrefixes: ["@biomejs/", "@vitest/", "@jest/", "@commitlint/", "@changesets/"],
  },
} as const satisfies Record<PackageEcosystem, PackageSignalPolicy>;

export const HARD_NOISE_PACKAGE_PREFIXES = PACKAGE_SIGNAL_POLICIES.npm.hardNoisePackagePrefixes;
export const LOW_SIGNAL_PACKAGE_NAMES = PACKAGE_SIGNAL_POLICIES.npm.lowSignalPackageNames;
export const LOW_SIGNAL_PACKAGE_PREFIXES = PACKAGE_SIGNAL_POLICIES.npm.lowSignalPackagePrefixes;

export const PACKAGE_SIGNAL_AUDIT_DEFAULT_LIMIT = 50;
export const PACKAGE_SIGNAL_AUDIT_MAX_LIMIT = 200;
export const PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_MIN_OWNER_COUNT = 5;
export const PACKAGE_SIGNAL_AUDIT_LOW_SIGNAL_CANDIDATE_DEV_DEP_RATIO = 0.8;
