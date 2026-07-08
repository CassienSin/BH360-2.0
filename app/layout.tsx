import type { Metadata, Viewport } from "next";
import { Sora, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import InstallPrompt from "@/components/InstallPrompt";

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
    >
      <body className="min-h-full flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: "var(--font-sora), Sora, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "16px",
              padding: "12px 16px",
              boxShadow: "0 8px 32px rgba(91,84,232,0.15)",
            },
            success: {
              iconTheme: { primary: "#22c55e", secondary: "white" },
              style: { border: "1px solid #dcfce7", background: "#f0fdf4", color: "#166534" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "white" },
              style: { border: "1px solid #fecaca", background: "#fff1f1", color: "#991b1b" },
            },
          }}
        />
        {children}
        <InstallPrompt />
        {/* next/script instead of a raw inline tag — Next controls when it
            runs (after hydration) and dedupes it across navigations */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
                .catch(err => console.log('[PWA] SW registration failed:', err))
            }
          `}
        </Script>
      </body>
    </html>
  );
}