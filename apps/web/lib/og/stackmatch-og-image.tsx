import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@stackmatch/constants/og";

const OG_BACKGROUND = "#07070a";
const OG_PANEL = "rgba(255,255,255,0.045)";
const OG_PANEL_BORDER = "rgba(255,255,255,0.12)";
const OG_TEXT = "#fafafa";
const OG_MUTED = "#a1a1aa";
const OG_ACCENT = "#ff0080";
const OG_ACCENT_2 = "#a855f7";
const OG_PANEL_RADIUS = 28;
const OG_CANVAS_PADDING_X = 62;
const OG_CANVAS_PADDING_Y = 48;
const OG_HEADLINE_SIZE = 84;
const OG_REPO_HEADLINE_SIZE = 78;
const OG_GRAPH_WIDTH = 430;
const OG_GRAPH_HEIGHT = 398;
const OG_CENTER_NODE_SIZE = 132;
const OG_ENDPOINT_SIZE = 24;
const OG_ENDPOINT_SMALL_SIZE = 16;

type StackmatchOgVariant = "global" | "user" | "repo";

export interface StackmatchOgImageParams {
  headline: string;
  variant: StackmatchOgVariant;
  badge?: string;
  avatarUrl?: string;
}

export function renderStackmatchOgImage({
  headline,
  variant,
  badge,
  avatarUrl,
}: StackmatchOgImageParams) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        backgroundColor: OG_BACKGROUND,
        color: OG_TEXT,
        padding: `${OG_CANVAS_PADDING_Y}px ${OG_CANVAS_PADDING_X}px`,
        fontFamily: "Inter",
      }}
    >
      <GridBackdrop />
      <Header badge={badge} />

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          flex: 1,
          gap: "42px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "58%",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Space Grotesk",
              fontSize: variant === "repo" ? OG_REPO_HEADLINE_SIZE : OG_HEADLINE_SIZE,
              fontWeight: 700,
              lineHeight: 0.94,
              letterSpacing: "-0.01em",
              maxWidth: "650px",
              textWrap: "balance",
            }}
          >
            {headline}
          </div>
        </div>

        <ProductGraph variant={variant} avatarUrl={avatarUrl} />
      </div>
    </div>
  );
}

function Header({ badge }: { badge?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            display: "flex",
            width: "18px",
            height: "18px",
            borderRadius: "999px",
            backgroundColor: OG_ACCENT,
            boxShadow: `0 0 28px ${OG_ACCENT}`,
          }}
        />
        <div
          style={{
            display: "flex",
            fontFamily: "Space Grotesk",
            fontSize: "34px",
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          stackmatch
        </div>
      </div>

      {badge ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: `1px solid ${OG_PANEL_BORDER}`,
            borderRadius: "999px",
            backgroundColor: "rgba(255,0,128,0.1)",
            color: OG_TEXT,
            fontSize: "18px",
            fontWeight: 700,
            padding: "11px 18px",
          }}
        >
          {badge}
        </div>
      ) : null}
    </div>
  );
}

function GridBackdrop() {
  return (
    <svg
      width={OG_IMAGE_WIDTH}
      height={OG_IMAGE_HEIGHT}
      viewBox={`0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}`}
      style={{ position: "absolute", inset: 0, opacity: 0.46 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="stackmatch-og-grid" width="74" height="74" patternUnits="userSpaceOnUse">
          <path d="M 74 0 L 0 0 0 74" fill="none" stroke="rgba(255,255,255,0.045)" />
        </pattern>
        <radialGradient id="stackmatch-og-edge-glow" cx="76%" cy="52%" r="48%">
          <stop offset="0%" stopColor="rgba(255,0,128,0.28)" />
          <stop offset="48%" stopColor="rgba(168,85,247,0.12)" />
          <stop offset="100%" stopColor="rgba(7,7,10,0)" />
        </radialGradient>
      </defs>
      <rect width={OG_IMAGE_WIDTH} height={OG_IMAGE_HEIGHT} fill="url(#stackmatch-og-grid)" />
      <rect width={OG_IMAGE_WIDTH} height={OG_IMAGE_HEIGHT} fill="url(#stackmatch-og-edge-glow)" />
    </svg>
  );
}

function ProductGraph({
  variant,
  avatarUrl,
}: {
  variant: StackmatchOgVariant;
  avatarUrl?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: `${OG_GRAPH_WIDTH}px`,
        height: `${OG_GRAPH_HEIGHT}px`,
        border: `1px solid ${OG_PANEL_BORDER}`,
        borderRadius: `${OG_PANEL_RADIUS}px`,
        backgroundColor: OG_PANEL,
        overflow: "hidden",
      }}
    >
      <GraphLines />
      <GraphEndpoint left={82} top={78} tone="muted" size="large" />
      <GraphEndpoint left={338} top={82} tone="muted" size="small" />
      <GraphEndpoint left={348} top={316} tone="pink" size="large" />
      <GraphEndpoint left={94} top={320} tone="muted" size="small" />
      <CentralNode avatarUrl={avatarUrl} variant={variant} />
    </div>
  );
}

function GraphLines() {
  return (
    <svg
      width={OG_GRAPH_WIDTH}
      height={OG_GRAPH_HEIGHT}
      viewBox={`0 0 ${OG_GRAPH_WIDTH} ${OG_GRAPH_HEIGHT}`}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="stackmatch-og-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={OG_ACCENT} />
          <stop offset="100%" stopColor={OG_ACCENT_2} />
        </linearGradient>
      </defs>
      <path
        d="M94 90L215 199L346 90M215 199L360 328M215 199L102 328"
        fill="none"
        stroke="url(#stackmatch-og-line)"
        strokeLinecap="round"
        strokeWidth="2.5"
        opacity="0.72"
      />
    </svg>
  );
}

function CentralNode({ avatarUrl, variant }: { avatarUrl?: string; variant: StackmatchOgVariant }) {
  if (!avatarUrl) {
    return (
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "56px",
          height: "56px",
          transform: "translate(-50%, -50%)",
          borderRadius: "999px",
          border: `1px solid ${variant === "global" ? "rgba(255,0,128,0.52)" : "rgba(255,0,128,0.38)"}`,
          backgroundColor: OG_ACCENT,
          boxShadow: `0 0 56px ${OG_ACCENT}, 0 0 92px rgba(168,85,247,0.28)`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${OG_CENTER_NODE_SIZE}px`,
        height: `${OG_CENTER_NODE_SIZE}px`,
        transform: "translate(-50%, -50%)",
        border: `1px solid ${variant === "global" ? "rgba(255,0,128,0.48)" : OG_PANEL_BORDER}`,
        borderRadius: variant === "user" ? "32px" : "999px",
        backgroundColor: "rgba(9,9,11,0.88)",
        boxShadow: `0 0 44px rgba(255,0,128,0.24), 0 0 70px rgba(168,85,247,0.14)`,
        overflow: "hidden",
      }}
    >
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </div>
  );
}

function GraphEndpoint({
  left,
  top,
  tone,
  size,
}: {
  left: number;
  top: number;
  tone: "pink" | "purple" | "muted";
  size: "small" | "large";
}) {
  const color = tone === "pink" ? OG_ACCENT : tone === "purple" ? OG_ACCENT_2 : OG_MUTED;
  const glow = tone === "muted" ? "rgba(255,255,255,0.14)" : color;
  const nodeSize = size === "small" ? OG_ENDPOINT_SMALL_SIZE : OG_ENDPOINT_SIZE;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        zIndex: 1,
        left: `${left}px`,
        top: `${top}px`,
        width: `${nodeSize}px`,
        height: `${nodeSize}px`,
        borderRadius: "999px",
        backgroundColor: color,
        boxShadow: `0 0 28px ${glow}`,
      }}
    />
  );
}
