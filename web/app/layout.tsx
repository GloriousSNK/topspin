import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Editorial serif for headings. Loaded as the variable font (one file per
// style covers every weight) instead of pinning eight static cuts.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://topspin.tennis";
const DESCRIPTION =
  "Film one stroke and TopSpin reads your form on-device, then predicts your " +
  "ball flight with real drag and Magnus physics. Your footage never leaves your phone.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TopSpin · The physics of a better game",
    template: "%s · TopSpin",
  },
  description: DESCRIPTION,
  applicationName: "TopSpin",
  authors: [{ name: "TopSpin Labs" }],
  creator: "TopSpin Labs",
  publisher: "TopSpin Labs",
  keywords: [
    "tennis", "stroke analysis", "ball flight prediction", "pose detection",
    "tennis practice", "tennis coaching", "topspin", "Magnus effect", "serve speed",
  ],
  category: "sports",
  openGraph: {
    type: "website",
    siteName: "TopSpin",
    url: SITE_URL,
    title: "TopSpin · The physics of a better game",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TopSpin · The physics of a better game",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
