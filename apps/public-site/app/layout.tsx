import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import TrackingProvider from "@/components/TrackingProvider";
import Navigation from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { GoogleAnalytics } from '@next/third-parties/google';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://xiri.ai'),
  title: {
    default: "XIRI Facility Solutions | Medical-Grade Facility Management",
    template: "%s | XIRI Facility Solutions",
  },
  description: "The facility management standard for single-tenant buildings. One partner. Zero headaches. Nightly verified.",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://xiri.ai',
    siteName: 'XIRI Facility Solutions',
    title: 'XIRI Facility Solutions | Medical-Grade Facility Management',
    description: 'The facility management standard for single-tenant buildings. One partner. Zero headaches. Nightly verified.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'XIRI Facility Solutions',
    description: 'Medical-grade facility management. One partner. Zero headaches.',
  },
  alternates: {
    canonical: 'https://xiri.ai',
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
        {/* Organization Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "XIRI Facility Solutions",
              "url": "https://xiri.ai",
              "description": "Medical-grade facility management for single-tenant buildings.",
              "serviceType": "Facility Management",
              "areaServed": {
                "@type": "State",
                "name": "New York"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "sales",
                "email": "chris@xiri.ai"
              }
            })
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-gray-900 bg-white pt-[112px]`}>
        <TrackingProvider>
          <Navigation />
          {children}
          <Footer />
        </TrackingProvider>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
