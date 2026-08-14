import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrendForge",
  description:
    "Turn rising topics in your niche into platform-ready content, fast.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
