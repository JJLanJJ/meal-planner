import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meal Planner",
  description: "AI-powered weekly meal planning",
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
        <nav className="border-b border-border bg-card">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="text-lg font-bold text-primary">
              Meal Planner
            </Link>
            <Link
              href="/ingredients"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              New Plan
            </Link>
            <Link
              href="/history"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              History
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
