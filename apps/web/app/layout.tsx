import { OpenPanelComponent } from "@openpanel/nextjs";
import { shouldEnableStackmatchVercelToolbar } from "@stackmatch/vercel/toolbar-env";
import { VercelToolbar } from "@stackmatch/vercel/toolbar-runtime";
import type { Metadata, Viewport } from "next";
import {
  Space_Grotesk as FontDisplay,
  Source_Code_Pro as FontMono,
  Inter as FontSans,
} from "next/font/google";
import Script from "next/script";
import { ErrorBoundary } from "@/components/error-boundary";
import { Footer } from "@/components/layout/chrome/footer";
import { Header } from "@/components/layout/chrome/header";
import { ScrollToTop } from "@/components/layout/chrome/scroll-to-top";
import { Providers } from "@/components/providers/providers";
import { ThemedToaster } from "@/components/ui/display/themed-toaster";
import "@/app/globals.css";
import { getServerSessionSnapshot } from "@/lib/auth/auth-server";
import { rootMetadata } from "@/lib/re-exports/seo";

const fontSans = FontSans({ subsets: ["latin"], variable: "--font-stack-sans" });
const fontMono = FontMono({ subsets: ["latin"], variable: "--font-stack-mono" });
const fontDisplay = FontDisplay({ subsets: ["latin"], variable: "--font-stack-display" });
const openPanelClientId = process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID;
const shouldEnableOpenPanel = process.env.NODE_ENV === "production" && Boolean(openPanelClientId);
const shouldRenderVercelToolbar = shouldEnableStackmatchVercelToolbar();
const themeInitScript =
  '(function(){try{var t=localStorage.getItem("stackmatch-design-theme");if(t&&t!=="neon")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()';

export const metadata: Metadata = rootMetadata;

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#07070a" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await getServerSessionSnapshot();

  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <head>
        {shouldEnableOpenPanel && openPanelClientId ? (
          <OpenPanelComponent
            clientId={openPanelClientId}
            trackScreenViews
            trackOutgoingLinks
            trackAttributes
            globalProperties={{
              app: "web",
              environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
            }}
          />
        ) : null}
        {/* Inline script to prevent flash of wrong design theme */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers initialSession={initialSession}>
          <a
            href="#main-content"
            data-analytics-area="accessibility"
            className="sr-only fixed left-4 top-4 z-[100] rounded-full border border-border bg-background px-4 py-2 text-sm font-bold text-foreground shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-th-accent-1"
          >
            Skip to content
          </a>
          <div className="relative flex min-h-screen flex-col">
            <div data-app-chrome data-analytics-area="header">
              <ErrorBoundary fallback={null} level="widget">
                <ScrollToTop />
                <Header />
              </ErrorBoundary>
            </div>
            <main
              id="main-content"
              data-app-main
              data-analytics-area="main"
              className="flex-1 mx-auto w-full max-w-app"
            >
              {children}
            </main>
            <div data-app-chrome data-analytics-area="footer">
              <ErrorBoundary fallback={null} level="widget">
                <Footer />
              </ErrorBoundary>
            </div>
          </div>
          <ErrorBoundary fallback={null} level="widget">
            <ThemedToaster />
          </ErrorBoundary>
        </Providers>
        {shouldRenderVercelToolbar ? (
          <ErrorBoundary fallback={null} level="widget">
            <VercelToolbar />
          </ErrorBoundary>
        ) : null}
      </body>
    </html>
  );
}
