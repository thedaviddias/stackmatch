import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Define the root directory to start searching for pages
const appDir = path.resolve(__dirname, "../../app");

// Recursively find all page.tsx files
function findPages(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      // Skip API routes and test directories
      if (file === "api" || file === "__tests__" || file.startsWith("_")) {
        continue;
      }
      findPages(filePath, fileList);
    } else if (file === "page.tsx") {
      fileList.push(filePath);
    }
  }

  return fileList;
}

const allPages = findPages(appDir);

// Define pages that are allowed to skip JSON-LD (e.g. settings, internal pages)
const JSON_LD_EXEMPT_PAGES = [
  "/about/page.tsx",
  "/admin/audit/page.tsx",
  "/admin/page.tsx",
  "/admin/moderation/page.tsx",
  "/admin/profiles/page.tsx",
  "/admin/security/page.tsx",
  "/feed/page.tsx",
  "/invite/[code]/page.tsx",
  "/login/page.tsx",
  "/messages/[conversationId]/page.tsx",
  "/messages/page.tsx",
  "/notifications/page.tsx",
  "/r/[code]/page.tsx",
  "/ranks/page.tsx",
  "/settings/page.tsx",
  "/settings/account/page.tsx",
  "/settings/notifications/page.tsx",
];

describe("Global SEO and Semantic Structure Compliance", () => {
  it("should find pages to test", () => {
    expect(allPages.length).toBeGreaterThan(0);
  });

  it("root layout includes an accessible skip link target", () => {
    const layoutPath = path.join(appDir, "layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    expect(layoutContent).toContain('href="#main-content"');
    expect(layoutContent).toContain('id="main-content"');
  });

  describe.each(allPages)("%s", (pagePath) => {
    const relativePath = pagePath.replace(appDir, "");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    const dirPath = path.dirname(pagePath);

    // Read all TSX files in the same directory and subdirectories to account for split components
    let aggregateContent = pageContent;

    function readDirRecursive(dir: string) {
      const files = fs.readdirSync(dir);

      // If this is a subdirectory and it contains a page.tsx, it's a child route, so we skip it.
      if (dir !== dirPath && files.includes("page.tsx")) {
        return;
      }

      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          if (file !== "__tests__") {
            readDirRecursive(fullPath);
          }
        } else if (file.endsWith(".tsx") && file !== "page.tsx") {
          // Ignore Next.js special files that aren't the page itself
          const nextjsSpecialFiles = [
            "layout.tsx",
            "not-found.tsx",
            "error.tsx",
            "loading.tsx",
            "template.tsx",
            "default.tsx",
            "global-error.tsx",
          ];
          if (nextjsSpecialFiles.includes(file)) {
            continue;
          }
          aggregateContent += `\n${fs.readFileSync(fullPath, "utf-8")}`;
        }
      }
    }

    readDirRecursive(dirPath);

    // Follow local imports to find delegated H1 tags
    const visitedPaths = new Set<string>();
    function followImports(content: string) {
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      for (const match of content.matchAll(importRegex)) {
        const importPath = match[1];
        if (!importPath) continue;
        try {
          let resolvedPath = "";
          if (importPath.startsWith("./") || importPath.startsWith("../")) {
            // Local relative import
            resolvedPath = path.resolve(dirPath, `${importPath}.tsx`);
            if (!fs.existsSync(resolvedPath)) {
              resolvedPath = path.resolve(dirPath, importPath, "index.tsx");
            }
          } else if (importPath.startsWith("@/components/")) {
            resolvedPath = path.resolve(__dirname, "../../", `${importPath.replace("@/", "")}.tsx`);
          } else if (importPath.startsWith("@stackmatch/ui/")) {
            resolvedPath = path.resolve(
              __dirname,
              "../../../../packages/ui/src/",
              `${importPath.replace("@stackmatch/ui/", "")}.tsx`
            );
          }

          if (resolvedPath && fs.existsSync(resolvedPath) && !visitedPaths.has(resolvedPath)) {
            visitedPaths.add(resolvedPath);
            const importedContent = fs.readFileSync(resolvedPath, "utf-8");
            aggregateContent += `\n${importedContent}`;
            followImports(importedContent); // Recursive follow
          }
        } catch (_e) {
          // Ignore unresolvable imports
        }
      }
    }

    followImports(aggregateContent);

    it("should export metadata or generateMetadata", () => {
      // metadata must be in page.tsx
      const hasMetadataExport = /export\s+(const|let|var)\s+metadata\b/.test(pageContent);
      const hasGenerateMetadataExport = /export\s+(async\s+)?function\s+generateMetadata\b/.test(
        pageContent
      );

      expect(hasMetadataExport || hasGenerateMetadataExport).toBe(true);
    });

    it("should contain at least one <h1> heading for semantic structure", () => {
      // Skip check if the page's default export only redirects — no JSX rendered.
      // Use pageContent (not aggregateContent) to avoid false-positives from imported modules.
      const hasJsxReturn = pageContent.includes("return (") || pageContent.includes("return(<");
      if (!hasJsxReturn && pageContent.includes("redirect(")) {
        return;
      }

      let h1OpenCount = (aggregateContent.match(/<h1\b/g) || []).length;
      h1OpenCount += (aggregateContent.match(/<SectionTitle[^>]*variant=["']h1["']/g) || []).length;

      // If no h1 found, check parent layouts
      if (h1OpenCount === 0) {
        let currentDir = dirPath;
        while (currentDir !== path.dirname(appDir)) {
          // Stop above appDir
          const layoutPath = path.join(currentDir, "layout.tsx");
          if (fs.existsSync(layoutPath)) {
            const layoutContent = fs.readFileSync(layoutPath, "utf-8");
            h1OpenCount += (layoutContent.match(/<h1\b/g) || []).length;
            h1OpenCount += (layoutContent.match(/<SectionTitle[^>]*variant=["']h1["']/g) || [])
              .length;
            if (h1OpenCount > 0) break;
          }
          currentDir = path.dirname(currentDir);
        }
      }

      expect(
        h1OpenCount,
        "Page component tree (or its layouts) should have at least one <h1> tag"
      ).toBeGreaterThanOrEqual(1);
    });

    it("should include JSON-LD structured data if not exempt", () => {
      // Skip check if the page's default export only redirects — no JSX rendered.
      const hasJsxReturn = pageContent.includes("return (") || pageContent.includes("return(<");
      if (!hasJsxReturn && pageContent.includes("redirect(")) {
        return;
      }
      const isExempt = JSON_LD_EXEMPT_PAGES.some((exemptPath) => relativePath.endsWith(exemptPath));

      if (isExempt) {
        return;
      }

      const hasJsonLd =
        aggregateContent.includes('type="application/ld+json"') ||
        aggregateContent.includes("<JsonLd") ||
        aggregateContent.includes("<OrganizationSchema") ||
        aggregateContent.includes("<ArticleSchema") ||
        aggregateContent.includes("<BreadcrumbSchema") ||
        aggregateContent.includes("dangerouslySetInnerHTML={{ __html: JSON.stringify(");

      expect(hasJsonLd, "Public page is missing JSON-LD structured data").toBe(true);
    });
  });
});
