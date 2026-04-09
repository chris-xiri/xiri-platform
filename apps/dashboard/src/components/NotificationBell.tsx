'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Sparkles, X, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    templateIds?: string[];
    read: boolean;
    createdAt: any;
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Live listener on unread + recent notifications
    useEffect(() => {
        const q = query(
            collection(db, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(20),
        );
        const unsub = onSnapshot(q, (snap) => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
        });
        return () => unsub();
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const markAllRead = async () => {
        const batch = writeBatch(db);
        notifications.filter(n => !n.read).forEach(n => {
            batch.update(doc(db, 'notifications', n.id), { read: true });
        });
        await batch.commit();
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div ref={ref} className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={() => setOpen(!open)}
            >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </Button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <h3 className="text-sm font-semibold">Notifications</h3>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
                                    <CheckCheck className="w-3 h-3" /> Mark all read
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-80 overflow-y-auto divide-y">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}
                                    onClick={() => markAsRead(n.id)}
                                >
                                    <div className="shrink-0 mt-0.5">
                                        {n.type === 'AI_TEMPLATE_OPTIMIZATION' ? (
                                            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                                                <Bell className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-[10px] text-muted-foreground">{formatTime(n.createdAt)}</span>
                                            {n.type === 'AI_TEMPLATE_OPTIMIZATION' && (
                                                <Link
                                                    href="/admin/email-templates"
                                                    className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); setOpen(false); }}
                                                >
                                                    Review <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                    {!n.read && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
