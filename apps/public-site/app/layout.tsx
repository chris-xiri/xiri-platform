import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import TrackingProvider from "@/components/TrackingProvider";
import Navigation from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ConditionalFooter } from "@/components/ConditionalFooter";
import { GoogleAnalytics } from '@next/third-parties/google';
import { ClarityProvider } from '@/components/ClarityProvider';
import { StickyMobileCTA } from '@/components/StickyMobileCTA';

import { MarketingShell } from '@/components/MarketingShell';
import { BodyClassProvider } from '@/components/BodyClassProvider';
import { SITE } from '@/lib/constants';

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
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | The New Standard`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
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
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} | Medical-Grade Facility Management`,
    description: SITE.description,
    images: [{
      url: `${SITE.url}/og-image.png`,
      width: 1200,
      height: 630,
      alt: `${SITE.name} — ${SITE.tagline}`,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: 'Medical-grade facility management. One partner. Zero headaches.',
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Critical inline styles — fallback if external CSS fails to load */}
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          /* Base fallback if CSS bundle fails */
          noscript .noscript-overlay {
            position: fixed; inset: 0; z-index: 99999;
            background: #0f172a; color: #e2e8f0;
            display: flex; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          noscript .noscript-card {
            max-width: 480px; padding: 48px 32px; text-align: center;
            background: #1e293b; border-radius: 16px; border: 1px solid #334155;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,.5);
          }
          noscript .noscript-card h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px; color: #38bdf8; }
          noscript .noscript-card p { font-size: 15px; line-height: 1.6; margin: 0 0 12px; color: #94a3b8; }
          noscript .noscript-card a { color: #38bdf8; text-decoration: underline; }
        `}} />
      </head>
      <BodyClassProvider className={`${inter.variable} ${outfit.variable} font-sans antialiased text-gray-900 bg-white pt-[112px]`}>
        {/* Fallback for users with JavaScript disabled */}
        <noscript>
          <div className="noscript-overlay">
            <div className="noscript-card">
              <h1>XIRI Facility Solutions</h1>
              <p>Our site requires JavaScript to provide the best experience.</p>
              <p>Please enable JavaScript in your browser settings, then refresh this page.</p>
              <p style={{ marginTop: '24px', fontSize: '13px' }}>
                Or contact us directly:<br />
                <a href={`mailto:${SITE.email}`}>{SITE.email}</a> · <a href={`tel:${SITE.phone}`}>{SITE.phone}</a>
              </p>
            </div>
          </div>
        </noscript>
        <TrackingProvider>
          <MarketingShell>
            <Navigation />
          </MarketingShell>
          {children}
          <MarketingShell>
            <ConditionalFooter>
              <Footer />
            </ConditionalFooter>

            <StickyMobileCTA />
          </MarketingShell>
        </TrackingProvider>
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
        <ClarityProvider />
        {/* Organization Structured Data — placed in body to avoid render-blocking */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${SITE.url}/#organization`,
              "name": SITE.name,
              "url": SITE.url,
              "logo": `${SITE.url}/icon.png`,
              "description": "Medical-grade facility management for single-tenant buildings.",
              "serviceType": "Facility Management",
              "telephone": SITE.phone,
              "sameAs": [
                SITE.social.facebook,
                SITE.social.linkedin
              ],
              "areaServed": {
                "@type": "State",
                "name": "New York"
              },
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "sales",
                "email": SITE.email,
                "telephone": SITE.phone
              }
            })
          }}
        />
        {/* WebSite Schema — tells Google our site name is "XIRI Facility Solutions", not "xiri.ai" */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE.url}/#website`,
              "name": SITE.name,
              "alternateName": [SITE.shortName, "Xiri Facility Solutions", "XIRI FM"],
              "url": SITE.url
            })
          }}
        />
      </BodyClassProvider>
    </html>
  );
}
