import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TrackingProvider from "@/components/TrackingProvider";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "XIRI Facility Solutions | Professional Facility Management",
  description: "Complete facility management for medical offices and healthcare facilities. Dedicated facility managers, night audits, and comprehensive care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <TrackingProvider>
          <Navigation />
          {children}
        </TrackingProvider>
      </body>
    </html>
  );
}
