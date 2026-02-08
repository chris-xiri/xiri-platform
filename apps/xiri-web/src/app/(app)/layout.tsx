import Link from "next/link";
import { Home, Users, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/sourcing" className="text-xl font-bold">
                            Xiri Platform
                        </Link>
                        <div className="flex gap-4">
                            <Link href="/sourcing" className="flex items-center gap-2 text-sm hover:text-primary">
                                <Home className="w-4 h-4" />
                                Sourcing
                            </Link>
                            <Link href="/crm" className="flex items-center gap-2 text-sm hover:text-primary">
                                <Users className="w-4 h-4" />
                                CRM
                            </Link>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <User className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/settings/templates" className="flex items-center gap-2 cursor-pointer">
                                    <Settings className="w-4 h-4" />
                                    Admin Settings
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="flex items-center gap-2 text-red-600">
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
