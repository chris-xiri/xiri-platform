"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users } from "lucide-react";
import { SettingsDropdown } from "@/components/SettingsDropdown";

export function Navbar() {
    const pathname = usePathname();

    const isRecruitment = pathname === "/" || pathname.startsWith("/recruitment");
    const isCRM = pathname.startsWith("/crm") || pathname.startsWith("/vendors");

    return (
        <nav className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <span className="text-2xl font-bold text-sky-700 tracking-tight flex items-center gap-2">
                                XIRI
                                <span className="text-xs font-normal text-gray-500 mt-1 hidden sm:block">FACILITY SOLUTIONS</span>
                            </span>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link
                                href="/"
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${isRecruitment
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                    }`}
                            >
                                <LayoutDashboard className="w-4 h-4 mr-2" />
                                Recruitment
                            </Link>
                            <Link
                                href="/crm"
                                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${isCRM
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                                    }`}
                            >
                                <Users className="w-4 h-4 mr-2" />
                                CRM
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <SettingsDropdown />
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-md">
                            JD
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <div className="sm:hidden bg-card border-b border-border px-4 py-3">
                <div className="flex flex-col space-y-2">
                    <Link
                        href="/"
                        className={`font-medium flex items-center gap-2 py-2 ${isRecruitment ? "text-primary" : "text-muted-foreground"
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Recruitment
                    </Link>
                    <Link
                        href="/crm"
                        className={`font-medium flex items-center gap-2 py-2 ${isCRM ? "text-primary" : "text-muted-foreground"
                            }`}
                    >
                        <Users className="w-4 h-4" />
                        CRM
                    </Link>
                </div>
            </div>
        </nav>
    );
}
