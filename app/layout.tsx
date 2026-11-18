import type { Metadata, Viewport } from "next";
import { Sora, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import InstallPrompt from "@/components/InstallPrompt";
import OfflineBanner from "@/components/OfflineBanner";
import NotificationLinkReader from "@/components/NotificationLinkReader";
import { BOOT_SCRIPT } from "@/lib/dashboardSkeletons";

// Sora is the font the entire app actually renders in — it was previously
// loaded via a render-blocking Google Fonts @import in globals.css while
// next/font was set up for Geist (which the app barely used). next/font
// self-hosts it: no external request, no flash of fallback font, and it
// keeps working offline for the PWA.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarangayHub 360",
  description: "Smart Barangay Management System with AI-powered insights",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BH360",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#5B54E8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Draw edge to edge under the notch and home bar; headers, composers,
  // sheets and toasts pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${geistMono.variable} h-full antialiased`}
      // The boot script below adds data-* attributes to <html> before React
      // hydrates; this tells React they are expected (this element only).
      suppressHydrationWarning
    >
      <head>
        {/* Runs while the HTML is parsed, before the first paint: records the
            saved sidebar width, the dashboard section's skeleton and the
            notification banner on <html>, so the static loading skeleton
            matches the page it stands in for. See lib/dashboardSkeletons.js.
            A plain inline script on purpose: next/script's beforeInteractive
            only queues inline code (self.__next_s) for Next's bootstrap
            bundle to run, which is after the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Toaster
          position="top-right"
          gutter={10}
          // Clear the notch / status bar and a landscape phone's notch side.
          containerStyle={{
            top: "max(16px, env(safe-area-inset-top, 0px))",
            right: "max(16px, env(safe-area-inset-right, 0px))",
            left: "max(16px, env(safe-area-inset-left, 0px))",
          }}
          toastOptions={{
            /* The COMPACT density of components/Toast.jsx — one-line
               confirmations like "Saved" or "Copied". Same radius, shadow and
               left rail as the full card there, so the two read as one system.
               Anything with a title and a detail, an action, or a severity
               worth colouring goes through notify() instead.

               4s, not the old 3s: three seconds is fine for "Saved" and too
               quick to finish reading anything longer. */
            duration: 4000,
            style: {
              fontFamily: "var(--font-sora), Sora, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "14px",
              padding: "12px 14px",
              maxWidth: "340px",
              boxShadow: "0 8px 32px rgba(91,84,232,0.15)",
              background: "#ffffff",
              border: "1px solid #eceaf6",
              borderLeft: "4px solid #5B54E8",
              color: "#1f2937",
            },
            success: {
              iconTheme: { primary: "#16a34a", secondary: "white" },
              style: { borderLeft: "4px solid #16a34a" },
            },
            error: {
              duration: 6000,
              iconTheme: { primary: "#dc2626", secondary: "white" },
              style: { borderLeft: "4px solid #dc2626" },
            },
          }}
        />
        {children}
        <InstallPrompt />
        <OfflineBanner />
        <NotificationLinkReader />
        {/* next/script instead of a raw inline tag — Next controls when it
            runs (after hydration) and dedupes it across navigations */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              // A new worker does not take over on its own — it waits until
              // every tab the old one controls has closed, which on an
              // installed app can be never. That left people running an old
              // worker indefinitely: exactly how a fix to offline behaviour
              // fails to reach the phone that needs it.
              //
              // So the swap happens here, at the one moment it is safe: a
              // full reload, where the page that loads is served entirely by
              // the new worker rather than half by each.
              //
              // Only when a worker is being *replaced*, though. sw.js calls
              // clients.claim(), so a first install also fires
              // controllerchange (none -> the new worker) — and reloading
              // then loaded every first visit twice, and left
              // document.referrer pointing at the page itself (which made
              // lib/goBack.js send a fresh tab's Back to a blank page).
              var reloading = false
              var hadController = !!navigator.serviceWorker.controller
              navigator.serviceWorker.addEventListener('controllerchange', function () {
                if (!hadController) { hadController = true; return }
                if (reloading) return
                reloading = true
                window.location.reload()
              })

              // Before skipping a push for "this conversation is already on
              // screen", the worker asks where the page is now (whereIs in
              // sw.js): the address it has for a window stays the one the
              // page was loaded at, however far the app has navigated since.
              navigator.serviceWorker.addEventListener('message', function (event) {
                if (!event.data || event.data.type !== 'BH360_WHERE' || !event.ports || !event.ports[0]) return
                event.ports[0].postMessage({ path: location.pathname, visible: document.visibilityState === 'visible' })
              })
              navigator.serviceWorker.startMessages()

              navigator.serviceWorker.register('/sw.js')
                .then(function (reg) {
                  function promote(worker) {
                    if (!worker) return
                    worker.addEventListener('statechange', function () {
                      // Only when something was already in charge. On a first
                      // install there is nothing to replace and no reload to do.
                      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        worker.postMessage('SKIP_WAITING')
                      }
                    })
                  }
                  if (reg.waiting && navigator.serviceWorker.controller) {
                    reg.waiting.postMessage('SKIP_WAITING')
                  }
                  promote(reg.installing)
                  reg.addEventListener('updatefound', function () { promote(reg.installing) })
                })
                .catch(function (err) { console.log('[PWA] SW registration failed:', err) })
            }
          `}
        </Script>
      </body>
    </html>
  );
}