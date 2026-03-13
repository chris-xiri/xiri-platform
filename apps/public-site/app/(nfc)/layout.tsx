import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "XIRI Check-In",
    description: "NFC check-in for facility management",
    robots: { index: false, follow: false },
};

/**
 * Minimal layout for NFC check-in pages (/s/, /z/, /c/).
 * No navigation, footer, popups, or marketing elements
 * — just a clean mobile-first interface.
 *
 * Each page provides its own branded header, so this layout
 * is intentionally bare. It only sets a white background.
 */
export default function NfcLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-white">
            <main className="flex-1">
                {children}
            </main>
        </div>
    );
}
