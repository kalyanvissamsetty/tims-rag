import type { Metadata } from "next";
import { IBM_Plex_Sans, Manrope } from "next/font/google";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";

const metadataBase = process.env.NEXT_PUBLIC_APP_URL
  ? new URL(process.env.NEXT_PUBLIC_APP_URL)
  : undefined;

const heading = Manrope({
  subsets: ["latin"],
  variable: "--font-heading"
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "TIMS AI Studio",
    template: "%s | TIMS AI Studio"
  },
  description: "Chat with TIMS's trusted documents using a polished, retrieval-first AI workspace built for teams.",
  applicationName: "TIMS AI Studio",
  keywords: ["RAG", "AI chat", "document chat", "knowledge base", "TIMS AI Studio"],
  openGraph: {
    title: "TIMS AI Studio",
    description: "Chat with TIMS's trusted documents using a polished, retrieval-first AI workspace built for teams.",
    siteName: "TIMS AI Studio",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "TIMS AI Studio",
    description: "Chat with TIMS's trusted documents using a polished, retrieval-first AI workspace built for teams."
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    shortcut: ["/favicon/favicon.ico"],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      {
        rel: "icon",
        url: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        rel: "icon",
        url: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${heading.variable} ${body.variable} font-[family-name:var(--font-body)]`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
