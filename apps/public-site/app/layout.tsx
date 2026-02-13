import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import TrackingProvider from "@/components/TrackingProvider";
import Navigation from "@/components/Navigation";

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
  title: "XIRI Facility Solutions | Medical-Grade Facility Management",
  description: "The facility management standard for medical offices, surgery centers, and auto dealerships. One partner. Zero headaches. Nightly verified.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${outfit.variable} font-sans antialiased text-gray-900 bg-white pt-[112px]`}>
        <TrackingProvider>
          <Navigation />
          {children}
        </TrackingProvider>
      </body>
    </html>
  );
}
