import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarangayHub 360",
  description: "Smart Barangay Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontFamily: 'Sora, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '16px',
              padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(91,84,232,0.15)',
            },
            success: {
              iconTheme: { primary: '#22c55e', secondary: 'white' },
              style: { border: '1px solid #dcfce7', background: '#f0fdf4', color: '#166534' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: 'white' },
              style: { border: '1px solid #fecaca', background: '#fff1f1', color: '#991b1b' },
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}