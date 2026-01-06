import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css"; // ✅ REQUIRED for react-leaflet
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "FLOK — The long way home",
  description: "Messages delivered with patience.",
  openGraph: {
    title: "FLOK — The long way home",
    description: "Messages delivered with patience.",
    siteName: "FLOK",
    images: [
      {
        url: "/og.png", // optional but recommended
        width: 1200,
        height: 630,
        alt: "FLOK",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

