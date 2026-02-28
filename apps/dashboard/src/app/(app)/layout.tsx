'use client';

import { useEffect, useState } from "react";
import { QueryProvider } from "@/providers/QueryProvider";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    Home, Users, User, Settings, LogOut, Package, DollarSign,
    ClipboardList, FileText, Sun, Moon, Monitor, Shield, Receipt,
    MapPin, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, Menu, X,
    Building2, LayoutDashboard, Search, HardHat, Bot, BarChart3, Mail, Scale,
    Share2,
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
    subGroup?: string;
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
                    ? 'bg-nav-item-active-bg text-nav-item-active font-medium'
                    : 'text-nav-item hover:bg-nav-item-hover-bg hover:text-nav-item-hover'
                }
                ${collapsed ? 'justify-center px-2' : ''}
            `}
            title={collapsed ? item.label : undefined}
        >
            <span className={`shrink-0 ${isActive ? 'text-nav-item-active-icon' : 'text-nav-icon'}`}>{item.icon}</span>
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
    const hasActiveChild = section.items.some(item =>
        pathname === item.href || pathname.startsWith(item.href + '/')
    );
    const isExpanded = expandedSections[section.label] === true; // only expands on click

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

    // Group items by subGroup for rendering sub-labels
    const subGroups: { group: string | null; items: NavItem[] }[] = [];
    for (const item of section.items) {
        const g = item.subGroup || null;
        const last = subGroups[subGroups.length - 1];
        if (last && last.group === g) {
            last.items.push(item);
        } else {
            subGroups.push({ group: g, items: [item] });
        }
    }

    return (
        <div>
            {section.dividerAbove && <hr className="my-3 border-border" />}
            <button
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors
                    ${hasActiveChild ? 'text-nav-section-active' : 'text-nav-section hover:text-nav-item-hover'}
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
                    {subGroups.map((sg, idx) => (
                        <div key={sg.group || idx}>
                            {sg.group && (
                                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-nav-sub-label">{sg.group}</p>
                            )}
                            {sg.items.map(item => (
                                <SidebarLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
                            ))}
                        </div>
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
    const [initialExpanded, setInitialExpanded] = useState(false);

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
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

    // Auto-expand section that contains the active page on first load
    useEffect(() => {
        if (initialExpanded) return;
        const activeSection = sections.find(s => s.show && s.items.some(item => pathname === item.href || pathname.startsWith(item.href + '/')));
        if (activeSection) {
            setExpandedSections(prev => ({ ...prev, [activeSection.label]: true }));
            setInitialExpanded(true);
        }
    }, [pathname, initialExpanded]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!profile) {
        return null;
    }

    const showClientsNav = canAccess('sales/dashboard', profile.roles) || canAccess('operations/contracts', profile.roles);
    const showContractorsNav = canAccess('supply/recruitment', profile.roles);
    const showFieldOpsNav = canAccess('operations/audits', profile.roles) || canAccess('operations/site-visits', profile.roles);
    const showFinanceNav = canAccess('accounting/invoices', profile.roles);
    const showAdminNav = canAccess('admin/settings', profile.roles);

    const sections: NavSection[] = [
        {
            label: 'Clients',
            icon: <Building2 className="w-3.5 h-3.5" />,
            show: showClientsNav,
            items: [
                ...(canAccess('sales/sourcing', profile.roles) ? [{ label: 'Lead Sourcing', href: '/sales/sourcing', icon: <Search className="w-4 h-4" /> }] : []),
                ...(canAccess('sales/dashboard', profile.roles) ? [{ label: 'Pipeline', href: '/sales/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }] : []),
                ...(canAccess('sales/quotes', profile.roles) ? [{ label: 'Quotes', href: '/sales/quotes', icon: <FileText className="w-4 h-4" /> }] : []),
                ...(canAccess('operations/contracts', profile.roles) ? [{ label: 'Contracts', href: '/operations/contracts', icon: <FileText className="w-4 h-4" /> }] : []),
                ...(canAccess('operations/work-orders', profile.roles) ? [{ label: 'Work Orders', href: '/operations/work-orders', icon: <ClipboardList className="w-4 h-4" /> }] : []),
            ],
        },
        {
            label: 'Contractors',
            icon: <HardHat className="w-3.5 h-3.5" />,
            show: showContractorsNav,
            items: [
                { label: 'Sourcing', href: '/supply/recruitment', icon: <Search className="w-4 h-4" /> },
                { label: 'Pipeline', href: '/supply/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
                ...(canAccess('accounting/vendor-remittances', profile.roles) ? [{ label: 'Remittances', href: '/accounting/vendor-remittances', icon: <DollarSign className="w-4 h-4" /> }] : []),
            ],
        },
        {
            label: 'Field Ops',
            icon: <Shield className="w-3.5 h-3.5" />,
            show: showFieldOpsNav,
            dividerAbove: true,
            items: [
                ...(canAccess('operations/audits', profile.roles) ? [{ label: 'Audits', href: '/operations/audits', icon: <Shield className="w-4 h-4" /> }] : []),
                ...(canAccess('operations/site-visits', profile.roles) ? [{ label: 'Site Visits', href: '/operations/site-visits', icon: <MapPin className="w-4 h-4" /> }] : []),
            ],
        },
        {
            label: 'Finance',
            icon: <Receipt className="w-3.5 h-3.5" />,
            show: showFinanceNav,
            items: [
                ...(canAccess('accounting/invoices', profile.roles) ? [{ label: 'Invoices', href: '/accounting/invoices', icon: <Receipt className="w-4 h-4" /> }] : []),
                ...(canAccess('accounting/commissions', profile.roles) ? [{ label: 'Commissions', href: '/accounting/commissions', icon: <DollarSign className="w-4 h-4" /> }] : []),
            ],
        },
        {
            label: 'Administration',
            icon: <Settings className="w-3.5 h-3.5" />,
            show: showAdminNav,
            dividerAbove: true,
            items: [
                { label: 'User Manager', href: '/admin/users', icon: <Users className="w-4 h-4" />, subGroup: 'Settings' },
                { label: 'AI Agents', href: '/admin/agents', icon: <Bot className="w-4 h-4" />, subGroup: 'Settings' },
                { label: 'Email Templates', href: '/admin/email-templates', icon: <Mail className="w-4 h-4" />, subGroup: 'Communications' },
                { label: 'Legal Templates', href: '/admin/legal', icon: <Scale className="w-4 h-4" />, subGroup: 'Communications' },
                { label: 'Social Media', href: '/admin/social', icon: <Share2 className="w-4 h-4" />, subGroup: 'Social Media' },
                { label: 'Reports', href: '/admin/reports', icon: <BarChart3 className="w-4 h-4" />, subGroup: 'Reporting' },
                { label: 'Template Analytics', href: '/admin/templates', icon: <BarChart3 className="w-4 h-4" />, subGroup: 'Reporting' },
                { label: 'Commissions', href: '/admin/commissions', icon: <DollarSign className="w-4 h-4" />, subGroup: 'Reporting' },
            ],
        },
    ];

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className={`flex items-center gap-2 px-4 py-5 border-b ${collapsed ? 'justify-center px-2' : ''}`}>
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-brand-logo tracking-tight">
                        {collapsed ? 'X' : 'XIRI'}
                    </span>
                    {!collapsed && (
                        <span className="text-[10px] font-normal text-brand-logo-sub mt-1 leading-tight">
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
                        <DropdownMenuItem asChild>
                            <Link href="/admin/profile" className="flex items-center gap-2 cursor-pointer">
                                <User className="w-4 h-4" /> My Profile
                            </Link>
                        </DropdownMenuItem>
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
                    <QueryProvider>
                        {children}
                    </QueryProvider>
                </main>
            </div>
        </div>
    );
}
