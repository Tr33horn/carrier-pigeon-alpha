// CSS load order matters:
// base → cards → timeline → map (map wins on specificity)

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./styles/base.css";
import "./styles/cards.css";
import "./styles/map.css";
import "./styles/timeline.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.APP_BASE_URL ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FLOK — The long way home",
  description: "Messages delivered with patience.",
  openGraph: {
    title: "FLOK — The long way home",
    description: "Messages delivered with patience.",
    siteName: "FLOK",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "FLOK",
      },
    ],
  },
  // optional but nice:
  twitter: {
    card: "summary_large_image",
    title: "FLOK — The long way home",
    description: "Messages delivered with patience.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}