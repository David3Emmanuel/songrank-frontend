import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "../lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Pick between two songs at a time and get a real ranking of an album, a playlist or an artist. No scores, no accounts.";

/**
 * What a pasted link shows.
 *
 * This is how the app travels: somebody posts their ranking, somebody else clicks,
 * and until this existed the link arrived as a bare URL with no picture and nothing
 * to say what it was. The address is configuration, so the tags stay relative until
 * a deployment sets one.
 */
export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: "SongRank",
  description: DESCRIPTION,
  openGraph: {
    title: "SongRank",
    description: DESCRIPTION,
    siteName: "SongRank",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SongRank",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* The players and the artwork come from here. Warming the handshake
            costs nothing and saves it on the first comparison. No crossOrigin:
            the iframe and the images both take the default connection, and
            asking for a CORS one would open a second, unused pool. */}
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.youtube.com" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
