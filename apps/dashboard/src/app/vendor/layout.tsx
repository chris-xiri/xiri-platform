import { Inter } from "next/font/google";
import "@/app/globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export default function VendorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center">
            {/* Minimal Header */}
            <header className="w-full bg-white dark:bg-card border-b border-gray-200 py-4 px-6 flex justify-center">
                <div className="flex items-center gap-2 font-bold text-xl text-primary">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">X</div>
                    Xiri
                </div>
            </header>

            {/* Content Container */}
            <div className="w-full max-w-3xl flex-1 p-6 md:p-12">
                {children}
            </div>

            {/* Footer */}
            <footer className="w-full py-6 text-center text-sm text-muted-foreground border-t border-gray-200 bg-white dark:bg-card">
                © {new Date().getFullYear()} Xiri Facility Solutions. All rights reserved.
            </footer>
        </div>
    );
}
