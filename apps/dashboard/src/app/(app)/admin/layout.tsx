"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Users, Bot, Scale, User, Mail, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { profile } = useAuth();
    const isAdmin = profile?.roles.includes("admin");

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-3 mb-8">
                    <Settings className="w-8 h-8" />
                    <h1 className="text-3xl font-bold">Settings</h1>
                </div>

                <div className="grid grid-cols-12 gap-6">
                    {/* Sidebar */}
                    <div className="col-span-3">
                        <nav className="space-y-1">
                            {/* Profile — visible to all */}
                            <NavLink href="/admin/profile" label="My Profile" icon={User} pathname={pathname} />

                            {/* Admin-only section */}
                            {isAdmin && (
                                <>
                                    <div className="pt-4 pb-1">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-4 font-semibold">Administration</p>
                                    </div>
                                    <NavLink href="/admin/users" label="User Manager" icon={Users} pathname={pathname} />
                                    <NavLink href="/admin/agents" label="AI Agents" icon={Bot} pathname={pathname} />
                                    <NavLink href="/admin/email-templates" label="Email Templates" icon={Mail} pathname={pathname} />
                                    <NavLink href="/admin/legal" label="Legal Templates" icon={Scale} pathname={pathname} />
                                    <NavLink href="/admin/commissions" label="Commissions" icon={DollarSign} pathname={pathname} />
                                </>
                            )}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="col-span-9">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: React.ElementType; pathname: string }) {
    const isActive = pathname === href;
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
        </Link>
    );
}
