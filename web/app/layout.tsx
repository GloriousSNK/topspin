import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/components/AuthProvider";
import { BackendStatusBanner } from "@/components/BackendStatus";
import { SITE_URL, SITE_NAME, ORG_NAME, SITE_DESCRIPTION } from "@/lib/site";

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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TopSpin · The physics of a better game",
    template: "%s · TopSpin",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: ORG_NAME, url: SITE_URL }],
  creator: ORG_NAME,
  publisher: ORG_NAME,
  keywords: [
    "TopSpin Labs", "TopSpin", "tennis", "stroke analysis", "ball flight prediction",
    "pose detection", "tennis practice", "tennis coaching", "Magnus effect", "serve speed",
  ],
  category: "sports",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: ORG_NAME, // what Google shows as the site name in results
    url: SITE_URL,
    title: "TopSpin · The physics of a better game",
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TopSpin · The physics of a better game",
    description: SITE_DESCRIPTION,
    creator: "@topspinlabs",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

// Organisation + WebSite structured data so search engines can connect the name
// "TopSpin Labs" to this site. Static, self-authored JSON — no user input.
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    alternateName: "TopSpin",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: ORG_NAME, // primary signal for the site name in Google results
    alternateName: SITE_NAME,
    url: SITE_URL,
    publisher: { "@type": "Organization", name: ORG_NAME },
  },
];

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
        <VercelAnalytics />
        <BackendStatusBanner />
      </body>
    </html>
  );
}
