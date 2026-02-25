
"use client";

import { Vendor } from "@xiri/shared";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, Eye, Briefcase, Zap, Send, Phone, Mail, MousePointerClick, MailOpen, MailCheck, AlertTriangle, Ban } from "lucide-react";
import Link from "next/link";
import { getStatusColor, getScoreColor, getStatusLabel } from "./utils";
import { useState } from "react";

interface VendorRowProps {
    vendor: Vendor;
    index: number;
    showActions: boolean;
    isRecruitmentMode?: boolean;
    onUpdateStatus: (id: string, newStatus: Vendor['status'], options?: { onboardingTrack?: 'FAST_TRACK' | 'STANDARD', hasActiveContract?: boolean }) => void;
    onSelect?: (id: string) => void;
    isActive?: boolean;
    isSelected?: boolean;
    onSelectChange?: (checked: boolean) => void;
    onAddEmailAndRetrigger?: (id: string, email: string) => void;
    onUpdateContact?: (id: string, data: { email?: string; phone?: string }) => void;
}

// ─── Engagement signal helpers ───
function getEngagementSignal(vendor: Vendor) {
    const eng = vendor.emailEngagement;
    if (!eng) return null;

    switch (eng.lastEvent) {
        case 'clicked':
            return { icon: MousePointerClick, label: 'Clicked', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', heat: 3 };
        case 'opened':
            return { icon: MailOpen, label: `Opened${eng.openCount > 1 ? ` ×${eng.openCount}` : ''}`, color: 'text-blue-600 bg-blue-50 border-blue-200', heat: 2 };
        case 'delivered':
            return { icon: MailCheck, label: 'Delivered', color: 'text-gray-500 bg-gray-50 border-gray-200', heat: 1 };
        case 'bounced':
            return { icon: AlertTriangle, label: 'Bounced', color: 'text-red-600 bg-red-50 border-red-200', heat: -1 };
        case 'spam':
            return { icon: Ban, label: 'Spam', color: 'text-red-700 bg-red-50 border-red-200', heat: -2 };
        default:
            return null;
    }
}

function timeAgo(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

export function VendorRow({ vendor, index, showActions, isRecruitmentMode = false, onUpdateStatus, onSelect, isActive, isSelected, onSelectChange, onAddEmailAndRetrigger, onUpdateContact }: VendorRowProps) {
    const isGrayedOut = isRecruitmentMode && (vendor.status || 'pending_review').toLowerCase() !== 'pending_review';
    const [emailInput, setEmailInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [showContactInputs, setShowContactInputs] = useState(false);
    const isNeedsContact = vendor.outreachStatus === 'NEEDS_CONTACT' && (vendor.status === 'qualified' || vendor.status === 'QUALIFIED');

    // Parse location — merge city/state/zip into single string
    const locationParts = [
        vendor.city,
        vendor.state,
        vendor.zip
    ].filter(Boolean);

    const locationStr = locationParts.length > 0
        ? `${vendor.city || ''}${vendor.city && vendor.state ? ', ' : ''}${vendor.state || ''} ${vendor.zip || ''}`.trim()
        : (vendor.address || 'Unknown');

    const detailLink = isRecruitmentMode
        ? `/supply/recruitment/${vendor.id}`
        : `/supply/crm/${vendor.id}`;

    const handleRowClick = (e: React.MouseEvent) => {
        if (onSelect) {
            e.preventDefault();
            e.stopPropagation();
            if (vendor.id) onSelect(vendor.id);
        }
    };

    const handleSaveContact = () => {
        const data: { email?: string; phone?: string } = {};
        if (emailInput.includes('@')) data.email = emailInput;
        if (phoneInput.trim()) data.phone = phoneInput.trim();

        if (data.email || data.phone) {
            if (data.email && isNeedsContact && onAddEmailAndRetrigger) {
                onAddEmailAndRetrigger(vendor.id!, data.email);
                if (data.phone && onUpdateContact) {
                    onUpdateContact(vendor.id!, { phone: data.phone });
                }
            } else if (onUpdateContact) {
                onUpdateContact(vendor.id!, data);
            }
        }

        setShowContactInputs(false);
        setEmailInput('');
        setPhoneInput('');
    };

    const engagement = getEngagementSignal(vendor);

    return (
        <TableRow
            className={`transition-colors border-b border-border text-foreground 
                ${isGrayedOut ? 'opacity-50 grayscale' : ''} 
                ${isActive ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary' : 'hover:bg-muted/50'}
            `}
        >
            {onSelectChange && (
                <TableCell className="text-center py-2 w-8" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onSelectChange}
                        aria-label="Select vendor"
                    />
                </TableCell>
            )}
            {/* Vendor Name + Contact + Capabilities */}
            <TableCell className="py-2">
                <Link href={detailLink} onClick={handleRowClick} className="block group cursor-pointer">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            {!isRecruitmentMode && vendor.preferredLanguage === 'es' ? (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 px-1 py-0 h-4 text-[9px]">ES</Badge>
                            ) : null}
                            <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{vendor.businessName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate block">
                            {vendor.contactName || vendor.email || "No contact info"}
                        </span>
                        {/* Inline capabilities */}
                        {vendor.capabilities?.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {vendor.capabilities.slice(0, 3).map((cap, i) => (
                                    <span key={i} className="text-[9px] text-muted-foreground bg-muted px-1 py-0 rounded">
                                        {cap}
                                    </span>
                                ))}
                                {vendor.capabilities.length > 3 && (
                                    <span className="text-[9px] text-muted-foreground">+{vendor.capabilities.length - 3}</span>
                                )}
                            </div>
                        )}
                    </div>
                </Link>
            </TableCell>
            {/* Location (merged City, State, Zip) */}
            <TableCell className="py-2 text-center hidden lg:table-cell">
                <span className="text-sm">{locationStr}</span>
            </TableCell>
            {/* AI Score */}
            <TableCell className="py-2 text-center w-16">
                <div className={`${getScoreColor(vendor.fitScore)} text-xs font-medium`}>
                    {vendor.fitScore ? `${vendor.fitScore}` : "—"}
                </div>
            </TableCell>
            {/* Status + Engagement Signal */}
            <TableCell className="py-2 text-center">
                <div className="flex flex-col items-center gap-1">
                    <Badge className={`${getStatusColor(vendor.status, vendor.outreachStatus)} shadow-none text-[10px] px-1.5 py-0 h-5`}>
                        {getStatusLabel(vendor.status, vendor.outreachStatus)}
                    </Badge>
                    {/* Engagement signal badge */}
                    {engagement && (
                        <div className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${engagement.color}`}>
                            <engagement.icon className="w-3 h-3" />
                            {engagement.label}
                            {vendor.emailEngagement?.lastEventAt && (
                                <span className="opacity-70">{timeAgo(vendor.emailEngagement.lastEventAt)}</span>
                            )}
                        </div>
                    )}
                </div>
            </TableCell>
            {/* Actions */}
            <TableCell className="text-right py-2">
                {isGrayedOut ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-slate-300">
                        Already in CRM
                    </Badge>
                ) : showActions && (
                    <div className="flex justify-end gap-1.5">
                        {(vendor.status || 'pending_review').toLowerCase() === 'pending_review' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'qualified', { onboardingTrack: 'STANDARD', hasActiveContract: false })}
                                    className="h-7 px-2 border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white transition-all font-medium text-xs"
                                    title="Standard Network Invite"
                                >
                                    <Check className="w-3 h-3 mr-1" /> Standard
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'qualified', { onboardingTrack: 'FAST_TRACK', hasActiveContract: true })}
                                    className="h-7 px-2 border-purple-200 text-purple-700 hover:bg-purple-600 hover:text-white transition-all font-medium text-xs"
                                    title="Urgent Contract Invite"
                                >
                                    <Zap className="w-3 h-3 mr-1" /> Urgent
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateStatus(vendor.id!, 'rejected')}
                                    className="h-7 px-2 border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition-all font-medium text-xs"
                                    title="Reject Vendor"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </>
                        ) : isNeedsContact && !isRecruitmentMode ? (
                            /* NEEDS_CONTACT: show email + phone inputs */
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {showContactInputs ? (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1">
                                            <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                            <input
                                                type="email"
                                                placeholder="email@company.com"
                                                value={emailInput}
                                                onChange={(e) => setEmailInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveContact();
                                                }}
                                                className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground w-[150px] focus:outline-none focus:ring-1 focus:ring-primary"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                            <input
                                                type="tel"
                                                placeholder="(555) 123-4567"
                                                value={phoneInput}
                                                onChange={(e) => setPhoneInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveContact();
                                                }}
                                                className="h-7 px-2 text-xs border border-border rounded-md bg-background text-foreground w-[150px] focus:outline-none focus:ring-1 focus:ring-primary"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={!emailInput.includes('@') && !phoneInput.trim()}
                                                onClick={handleSaveContact}
                                                className="h-6 px-2 border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white text-[10px]"
                                            >
                                                <Send className="w-3 h-3 mr-0.5" /> Save
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setShowContactInputs(false); setEmailInput(''); setPhoneInput(''); }}
                                                className="h-6 px-1.5 text-muted-foreground text-[10px]"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowContactInputs(true)}
                                        className="h-7 px-2 border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white text-xs font-medium"
                                    >
                                        <Send className="w-3 h-3 mr-1" /> Add Contact
                                    </Button>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}
