import type { ReactElement, ReactNode } from "react";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContributionHeatmap } from "../charts/contribution-heatmap";
import { DeveloperAvatarMarquee } from "../marketing/avatar-marquee";
import { CollaborationGraph } from "../pages/home/collaboration-graph";
import { TimeAgo } from "../ui/display/time-ago";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    height,
    sizes,
    src,
    width,
  }: {
    alt?: string;
    className?: string;
    height?: number;
    sizes?: string;
    src: string;
    width?: number;
  }) => (
    // biome-ignore lint/performance/noImgElement: Next Image is mocked with a plain image for hydration tests.
    <img
      alt={alt ?? ""}
      className={className}
      height={height}
      sizes={sizes}
      src={src}
      width={width}
    />
  ),
}));

vi.mock("@/components/ui/link", () => ({
  LinkCustom: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const HYDRATION_WARNING_PATTERN =
  /hydration|encountered two children with the same key|unique "key"|same key/i;

async function expectHydratesWithoutReactWarnings(ui: ReactElement) {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const container = document.createElement("div");
  let root: Root | null = null;

  container.innerHTML = renderToString(ui);
  document.body.appendChild(container);

  await act(async () => {
    root = hydrateRoot(container, ui);
  });

  await act(async () => {
    await Promise.resolve();
  });

  const messages = [...errorSpy.mock.calls, ...warnSpy.mock.calls]
    .map((call) => call.join(" "))
    .join("\n");

  await act(async () => {
    root?.unmount();
  });
  container.remove();
  errorSpy.mockRestore();
  warnSpy.mockRestore();

  expect(messages).not.toMatch(HYDRATION_WARNING_PATTERN);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hydration hardening", () => {
  it("hydrates TimeAgo without server/client text mismatch warnings", async () => {
    await expectHydratesWithoutReactWarnings(
      <TimeAgo timestamp={new Date("2026-05-30T12:00:00.000Z").getTime()} />
    );
  });

  it("hydrates duplicate avatar marquee handles without duplicate key warnings", async () => {
    await expectHydratesWithoutReactWarnings(
      <DeveloperAvatarMarquee handles={["octocat", "OCTOCAT", "shadcn", "shadcn"]} />
    );
  });

  it("hydrates duplicate collaboration graph handles without duplicate key warnings", async () => {
    await expectHydratesWithoutReactWarnings(
      <CollaborationGraph handles={["octocat", "OCTOCAT", "shadcn", "shadcn", "cassidoo"]} />
    );
  });

  it("hydrates contribution heatmap with a stable date anchor", async () => {
    const todayMs = new Date("2026-05-31T12:00:00.000Z").getTime();

    await expectHydratesWithoutReactWarnings(
      <ContributionHeatmap
        data={[
          {
            date: new Date("2026-05-30T00:00:00.000Z").getTime(),
            human: 2,
            ai: 1,
            automation: 0,
            humanAdditions: 20,
            aiAdditions: 10,
            automationAdditions: 0,
          },
        ]}
        todayMs={todayMs}
        viewMode="commits"
      />
    );
  });
});
