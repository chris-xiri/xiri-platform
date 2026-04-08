import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "What Frustrates You Most About Your Cleaning Service? | XIRI",
    description: "Tap to see what verified cleaning and facility management looks like. Zone-by-zone compliance logs, real-time accountability, one partner for everything.",
    robots: { index: false, follow: false },
};

/**
 * Minimal layout for the NFC demo landing page.
 * No navigation, footer, or marketing elements —
 * just a clean, distraction-free mobile-first experience
 * designed for prospects tapping an NFC business card.
 */
export default function DemoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col bg-white">
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}
