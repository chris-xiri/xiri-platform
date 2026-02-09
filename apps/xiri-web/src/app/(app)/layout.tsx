'use client';

import Link from "next/link";
import { Home, Users, User, Settings, LogOut, Package, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/accessControl";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { profile, signOut } = useAuth();

    if (!profile) {
        return null; // AuthProvider will redirect to login
    }

    const showSupplyNav = canAccess('supply/recruitment', profile.roles);
    const showSalesNav = canAccess('sales/dashboard', profile.roles);
    const showAdminNav = canAccess('admin/settings', profile.roles);

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/" className="text-xl font-bold">
                            Xiri Platform
                        </Link>
                        <div className="flex gap-4">
                            {/* Supply Dropdown */}
                            {showSupplyNav && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="flex items-center gap-1">
                                            <Package className="w-4 h-4" />
                                            Supply
                                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem asChild>
                                            <Link href="/supply/recruitment" className="flex items-center gap-2 cursor-pointer">
                                                <Package className="w-4 h-4" />
                                                Sourcing
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/supply/crm" className="flex items-center gap-2 cursor-pointer">
                                                <Users className="w-4 h-4" />
                                                Contractors
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {/* Sales Dropdown */}
                            {showSalesNav && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="flex items-center gap-1">
                                            <DollarSign className="w-4 h-4" />
                                            Sales
                                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                        <DropdownMenuItem asChild>
                                            <Link href="/sales/dashboard" className="flex items-center gap-2 cursor-pointer">
                                                <DollarSign className="w-4 h-4" />
                                                Dashboard
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/sales/crm" className="flex items-center gap-2 cursor-pointer">
                                                <Users className="w-4 h-4" />
                                                Sales CRM
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <User className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>
                                <div>
                                    <p className="font-medium">{profile.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Role: {profile.roles.join(', ')}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {showAdminNav && (
                                <>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/templates" className="flex items-center gap-2 cursor-pointer">
                                            <Settings className="w-4 h-4" />
                                            Email Templates
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/agents" className="flex items-center gap-2 cursor-pointer">
                                            <Settings className="w-4 h-4" />
                                            AI Agents
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
                                            <Users className="w-4 h-4" />
                                            User Management
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-red-600 cursor-pointer">
                                <LogOut className="w-4 h-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </nav>
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
