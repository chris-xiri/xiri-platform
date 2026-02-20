'use client';

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    Home, Users, User, Settings, LogOut, Package, DollarSign,
    ClipboardList, FileText, Sun, Moon, Monitor, Shield, Receipt,
    MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, Menu, X,
    Building2, LayoutDashboard, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
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

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface NavSection {
    label: string;
    icon: React.ReactNode;
    items: NavItem[];
    show: boolean;
    dividerAbove?: boolean;
}

function SidebarLink({ item, collapsed, pathname }: { item: NavItem; collapsed: boolean; pathname: string }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
        <Link
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group
                ${isActive
                    ? 'bg-sky-50 text-sky-700 font-medium dark:bg-sky-950/40 dark:text-sky-400'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
                ${collapsed ? 'justify-center px-2' : ''}
            `}
            title={collapsed ? item.label : undefined}
        >
            <span className={`shrink-0 ${isActive ? 'text-sky-600 dark:text-sky-400' : ''}`}>{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
    );
}

function SidebarSection({ section, collapsed, pathname, expandedSections, toggleSection }: {
    section: NavSection;
    collapsed: boolean;
    pathname: string;
    expandedSections: Record<string, boolean>;
    toggleSection: (key: string) => void;
}) {
    if (!section.show) return null;
    const isExpanded = expandedSections[section.label] !== false; // default open
    const hasActiveChild = section.items.some(item =>
        pathname === item.href || pathname.startsWith(item.href + '/')
    );

    if (collapsed) {
        return (
            <>
                {section.dividerAbove && <hr className="my-2 border-border" />}
                <div className="space-y-1">
                    {section.items.map(item => (
                        <SidebarLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
                    ))}
                </div>
            </>
        );
    }

    return (
        <div>
            {section.dividerAbove && <hr className="my-3 border-border" />}
            <button
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors
                    ${hasActiveChild ? 'text-sky-700 dark:text-sky-400' : 'text-muted-foreground hover:text-foreground'}
                `}
            >
                {section.icon}
                <span className="flex-1 text-left">{section.label}</span>
                {isExpanded
                    ? <ChevronDown className="w-3 h-3" />
                    : <ChevronRight className="w-3 h-3" />
                }
            </button>
            {isExpanded && (
                <div className="mt-1 ml-1 space-y-0.5">
                    {section.items.map(item => (
                        <SidebarLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const { profile, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { setTheme, theme } = useTheme();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));
    };

    useEffect(() => {
        if (!loading && !profile) {
            router.push('/login');
        }
    }, [loading, profile, router]);

    // Close mobile sidebar on nav
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!profile) {
        return null;
    }

    const showSupplyNav = canAccess('supply/recruitment', profile.roles);
    const showSalesNav = canAccess('sales/dashboard', profile.roles);
    const showOpsNav = canAccess('operations/work-orders', profile.roles);
    const showAccountingNav = canAccess('accounting/invoices', profile.roles);
    const showAdminNav = canAccess('admin/settings', profile.roles);

    const sections: NavSection[] = [
        {
            label: 'Sales',
            icon: <DollarSign className="w-3.5 h-3.5" />,
            show: showSalesNav,
            items: [
                { label: 'Dashboard', href: '/sales/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
                { label: 'Leads Sourcing', href: '/sales/sourcing', icon: <Search className="w-4 h-4" /> },
                { label: 'Leads CRM', href: '/sales/crm', icon: <Users className="w-4 h-4" /> },
                { label: 'Leads Quotes', href: '/sales/quotes', icon: <FileText className="w-4 h-4" /> },
            ],
        },
        {
            label: 'Supply',
            icon: <Package className="w-3.5 h-3.5" />,
            show: showSupplyNav,
            items: [
                { label: 'Dashboard', href: '/supply/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
                { label: 'Contractor Sourcing', href: '/supply/recruitment', icon: <Search className="w-4 h-4" /> },
                { label: 'Contractors CRM', href: '/supply/crm', icon: <Users className="w-4 h-4" /> },
            ],
        },
        {
            label: 'Operations',
            icon: <ClipboardList className="w-3.5 h-3.5" />,
            show: showOpsNav,
            dividerAbove: true,
            items: [
                { label: 'Client Work Orders', href: '/operations/work-orders', icon: <ClipboardList className="w-4 h-4" /> },
                { label: 'Client Contracts', href: '/operations/contracts', icon: <FileText className="w-4 h-4" /> },
                { label: 'Client Audits', href: '/operations/audits', icon: <Shield className="w-4 h-4" /> },
                { label: 'Site Visits', href: '/operations/site-visits', icon: <MapPin className="w-4 h-4" /> },
            ],
        },
        {
            label: 'Accounting',
            icon: <Receipt className="w-3.5 h-3.5" />,
            show: showAccountingNav,
            items: [
                { label: 'Invoices', href: '/accounting/invoices', icon: <Receipt className="w-4 h-4" /> },
                { label: 'Commissions', href: '/accounting/commissions', icon: <DollarSign className="w-4 h-4" /> },
                { label: 'Vendor Remittances', href: '/accounting/vendor-remittances', icon: <DollarSign className="w-4 h-4" /> },
            ],
        },
    ];

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className={`flex items-center gap-2 px-4 py-5 border-b ${collapsed ? 'justify-center px-2' : ''}`}>
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-sky-700 tracking-tight">
                        {collapsed ? 'X' : 'XIRI'}
                    </span>
                    {!collapsed && (
                        <span className="text-[10px] font-normal text-muted-foreground mt-1 leading-tight">
                            FACILITY<br />SOLUTIONS
                        </span>
                    )}
                </Link>
            </div>

            {/* Nav Sections */}
            <div className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
                {sections.map(section => (
                    <SidebarSection
                        key={section.label}
                        section={section}
                        collapsed={collapsed}
                        pathname={pathname}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                    />
                ))}
            </div>

            {/* Bottom: User & Theme */}
            <div className={`border-t p-3 space-y-2 ${collapsed ? 'px-2' : ''}`}>
                {/* Collapse Toggle (desktop only) */}
                <button
                    onClick={() => setCollapsed(prev => !prev)}
                    className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                    {!collapsed && 'Collapse'}
                </button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left ${collapsed ? 'justify-center px-2' : ''}`}>
                            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-sky-700 dark:text-sky-400" />
                            </div>
                            {!collapsed && (
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{profile.displayName}</p>
                                    <p className="text-xs text-muted-foreground truncate">{profile.roles.join(', ')}</p>
                                </div>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-56">
                        <DropdownMenuLabel>
                            <div>
                                <p className="font-medium">{profile.displayName}</p>
                                <p className="text-xs text-muted-foreground">{profile.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setTheme('light')} className={`flex items-center gap-2 cursor-pointer ${theme === 'light' ? 'bg-muted' : ''}`}>
                            <Sun className="w-4 h-4" /> Light
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('dark')} className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'bg-muted' : ''}`}>
                            <Moon className="w-4 h-4" /> Dark
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTheme('system')} className={`flex items-center gap-2 cursor-pointer ${theme === 'system' ? 'bg-muted' : ''}`}>
                            <Monitor className="w-4 h-4" /> System
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {showAdminNav && (
                            <>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/templates" className="flex items-center gap-2 cursor-pointer">
                                        <Settings className="w-4 h-4" /> Email Templates
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/agents" className="flex items-center gap-2 cursor-pointer">
                                        <Settings className="w-4 h-4" /> AI Agents
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
                                        <Users className="w-4 h-4" /> User Management
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem onClick={() => signOut()} className="flex items-center gap-2 text-red-600 cursor-pointer">
                            <LogOut className="w-4 h-4" /> Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Desktop Sidebar */}
            <aside
                className={`hidden lg:flex flex-col border-r bg-background transition-all duration-200 shrink-0
                    ${collapsed ? 'w-[60px]' : 'w-[240px]'}
                `}
            >
                {sidebarContent}
            </aside>

            {/* Mobile Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
            )}

            {/* Mobile Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[260px] border-r bg-background transition-transform duration-200 lg:hidden
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="absolute top-3 right-3">
                    <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>
                {sidebarContent}
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Mobile Top Bar */}
                <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b">
                    <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
                        <Menu className="w-5 h-5" />
                    </Button>
                    <span className="text-xl font-bold text-sky-700">XIRI</span>
                </div>

                <main className="flex-1 overflow-y-auto px-6 py-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
