'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Send, Clock, Loader2, ThumbsUp, MessageCircle, Share2,
    Trash2, Calendar, Image as ImageIcon, Link2, RefreshCw, ExternalLink,
    Facebook, Settings, Sparkles, Check, X, Edit3, TrendingUp, Users, Eye,
    Zap, AlertTriangle, Timer, Film, Linkedin, Video,
} from 'lucide-react';

// ── Types ──

interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    full_picture?: string;
    permalink_url?: string;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
}

interface SocialConfig {
    cadence: string;
    preferredDays: string[];
    preferredTime: string;
    tone: string;
    topics: string[];
    hashtagSets: string[];
    enabled: boolean;
    audienceMix?: {
        client: number;
        contractor: number;
    };
}

interface DraftPost {
    id: string;
    message: string;
    status: string;
    generatedBy: string;
    scheduledFor: any;
    channel?: string;
    audience?: 'client' | 'contractor';
    imageUrl?: string;
    videoUrl?: string;
    videoStoragePath?: string;
    videoDurationSeconds?: number;
    location?: string;
    reusedFrom?: string;
    engagementContext?: {
        avgLikes: number;
        avgComments: number;
        avgShares: number;
        topPostThemes: string[];
    };
    createdAt: any;
}

type Channel = 'facebook_posts' | 'facebook_reels' | 'linkedin';

const CHANNELS: { id: Channel; label: string; icon: React.ReactNode; enabled: boolean }[] = [
    { id: 'facebook_posts', label: 'FB Posts', icon: <Facebook className="w-4 h-4" />, enabled: true },
    { id: 'facebook_reels', label: 'FB Reels', icon: <Film className="w-4 h-4" />, enabled: true },
    { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, enabled: false },
];

const DEFAULT_CONFIG: SocialConfig = {
    cadence: '3x_week',
    preferredDays: ['monday', 'wednesday', 'friday'],
    preferredTime: '10:00',
    tone: 'Professional, bold, blue-collar-friendly but executive-grade',
    topics: ['contractor recruitment', 'client success', 'industry tips'],
    hashtagSets: ['#FacilityManagement #CommercialCleaning #LongIsland #Queens #NYContractors'],
    enabled: false,
    audienceMix: { client: 50, contractor: 50 },
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CADENCE_OPTIONS = [
    { value: 'daily', label: 'Daily' },
    { value: '3x_week', label: '3x / week' },
    { value: '2x_week', label: '2x / week' },
    { value: 'weekly', label: 'Weekly' },
];

// ── Main Page ──

export default function SocialMediaPage() {
    // Channel state
    const [activeChannel, setActiveChannel] = useState<Channel>('facebook_posts');
    // Tab state
    const [activeTab, setActiveTab] = useState<'feed' | 'drafts' | 'settings'>('feed');

    // Posts state
    const [posts, setPosts] = useState<FacebookPost[]>([]);
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Drafts state
    const [drafts, setDrafts] = useState<DraftPost[]>([]);
    const [loadingDrafts, setLoadingDrafts] = useState(false);
    const [editingDraft, setEditingDraft] = useState<string | null>(null);
    const [editedMessage, setEditedMessage] = useState('');
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateElapsed, setGenerateElapsed] = useState(0);

    // Config state
    const [config, setConfig] = useState<SocialConfig>(DEFAULT_CONFIG);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    // Compose state (kept for publish handler compatibility)
    const [message, setMessage] = useState('');
    const [link, setLink] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [showSchedule, setShowSchedule] = useState(false);
    const [showLink, setShowLink] = useState(false);
    const [showImage, setShowImage] = useState(false);

    // Feedback
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // ── Data Fetching ──

    const fetchPosts = useCallback(async () => {
        try {
            setLoading(true);
            const getFacebookPosts = httpsCallable(functions, 'getFacebookPosts');
            const result = await getFacebookPosts({ limit: 20 });
            const data = result.data as { posts: FacebookPost[]; insights: any };
            setPosts(data.posts || []);
            setInsights(data.insights || null);
        } catch (err: any) {
            console.error('Error fetching posts:', err);
            setErrorMessage('Failed to load posts');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDrafts = useCallback(async () => {
        try {
            setLoadingDrafts(true);
            const { collection, query, where, orderBy, getDocs, limit } = await import('firebase/firestore');
            const q = query(
                collection(db, 'social_posts'),
                where('channel', '==', activeChannel),
                where('status', 'in', ['draft', 'approved', 'rejected']),
                orderBy('scheduledFor', 'asc'),
                limit(20)
            );
            const snapshot = await getDocs(q);
            const items: DraftPost[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as DraftPost));
            // Sort: draft/approved first (by scheduledFor asc), rejected last
            items.sort((a, b) => {
                const aRejected = a.status === 'rejected' ? 1 : 0;
                const bRejected = b.status === 'rejected' ? 1 : 0;
                if (aRejected !== bRejected) return aRejected - bRejected;
                return 0; // preserve Firestore ordering within each group
            });
            setDrafts(items);
        } catch (err: any) {
            console.error('Error fetching drafts:', err);
        } finally {
            setLoadingDrafts(false);
        }
    }, [activeChannel]);

    const fetchConfig = useCallback(async () => {
        try {
            setLoadingConfig(true);
            const configDoc = await getDoc(doc(db, 'social_config', activeChannel));
            if (configDoc.exists()) {
                setConfig({ ...DEFAULT_CONFIG, ...configDoc.data() as any });
            } else {
                setConfig(DEFAULT_CONFIG);
            }
        } catch (err: any) {
            console.error('Error fetching config:', err);
        } finally {
            setLoadingConfig(false);
        }
    }, [activeChannel]);

    useEffect(() => {
        fetchPosts();
        fetchDrafts();
        fetchConfig();
    }, [fetchPosts, fetchDrafts, fetchConfig]);

    // Auto-clear feedback
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // ── Handlers ──

    const handlePublish = async () => {
        if (!message.trim()) return;
        setPosting(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const publishFacebookPost = httpsCallable(functions, 'publishFacebookPost');
            const payload: Record<string, string> = { message: message.trim() };
            if (link.trim()) payload.link = link.trim();
            if (imageUrl.trim()) payload.imageUrl = imageUrl.trim();
            if (showSchedule && scheduleDate && scheduleTime) {
                payload.scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
            }

            const result = await publishFacebookPost(payload);
            const data = result.data as { success: boolean; error?: string };

            if (data.success) {
                setSuccessMessage(showSchedule ? 'Post scheduled!' : 'Published to Facebook!');
                setMessage(''); setLink(''); setImageUrl('');
                setScheduleDate(''); setScheduleTime('');
                setShowSchedule(false); setShowLink(false); setShowImage(false);
                setTimeout(fetchPosts, 2000);
            } else {
                setErrorMessage(data.error || 'Failed to publish');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Failed to publish');
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = async (postId: string) => {
        if (!confirm('Delete this post permanently?')) return;
        setDeleting(postId);
        try {
            const deleteFacebookPost = httpsCallable(functions, 'deleteFacebookPost');
            await deleteFacebookPost({ postId });
            setPosts(prev => prev.filter(p => p.id !== postId));
            setSuccessMessage('Post deleted');
        } catch (err: any) {
            setErrorMessage('Failed to delete');
        } finally {
            setDeleting(null);
        }
    };

    const handleReview = async (postId: string, action: 'approve' | 'reject') => {
        setReviewingId(postId);
        try {
            const reviewSocialPost = httpsCallable(functions, 'reviewSocialPost');
            await reviewSocialPost({
                postId,
                action,
                editedMessage: editingDraft === postId ? editedMessage : undefined,
            });
            setSuccessMessage(`Post ${action === 'approve' ? 'approved' : 'rejected'}!`);
            setEditingDraft(null);
            setEditedMessage('');
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage(`Failed to ${action} post`);
        } finally {
            setReviewingId(null);
        }
    };

    const handleGenerate = async () => {
        setGenerating(true);
        setGenerateElapsed(0);
        const startTime = Date.now();
        const timer = setInterval(() => {
            setGenerateElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        try {
            const trigger = httpsCallable(functions, 'triggerSocialContentGeneration', { timeout: 540000 });
            await trigger({ channel: activeChannel });
            setSuccessMessage(activeChannel === 'facebook_reels'
                ? 'Reel generated! Check the Drafts tab.'
                : 'AI draft generated! Check the Drafts tab.');
            setActiveTab('drafts');
            setTimeout(fetchDrafts, 2000);
        } catch (err: any) {
            setErrorMessage('Failed to generate: ' + (err.message || 'Unknown error'));
        } finally {
            clearInterval(timer);
            setGenerating(false);
            setGenerateElapsed(0);
        }
    };

    const handleSaveConfig = async () => {
        setSavingConfig(true);
        try {
            const updateConfig = httpsCallable(functions, 'updateSocialConfig');
            await updateConfig({ ...config, channel: activeChannel });
            setSuccessMessage('Settings saved!');
        } catch (err: any) {
            setErrorMessage('Failed to save settings');
        } finally {
            setSavingConfig(false);
        }
    };

    const toggleDay = (day: string) => {
        setConfig(prev => ({
            ...prev,
            preferredDays: prev.preferredDays.includes(day)
                ? prev.preferredDays.filter(d => d !== day)
                : [...prev.preferredDays, day],
        }));
    };

    const formatDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit',
        });

    const getTimeRemaining = (scheduledFor: any) => {
        if (!scheduledFor) return null;
        const target = scheduledFor?.toDate ? scheduledFor.toDate() : new Date(scheduledFor);
        const now = new Date();
        const diff = target.getTime() - now.getTime();
        if (diff <= 0) return { text: 'Auto-publishing soon', urgent: true, hours: 0 };
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return { text: `${days}d ${hours % 24}h left to review`, urgent: false, hours };
        }
        if (hours > 0) return { text: `${hours}h ${minutes}m left to review`, urgent: hours < 3, hours };
        return { text: `${minutes}m left to review`, urgent: true, hours: 0 };
    };

    // ── Metrics ──
    const totalPosts = posts.length;
    const avgLikes = totalPosts > 0 ? Math.round(posts.reduce((s, p) => s + (p.likes?.summary?.total_count || 0), 0) / totalPosts) : 0;
    const avgComments = totalPosts > 0 ? Math.round(posts.reduce((s, p) => s + (p.comments?.summary?.total_count || 0), 0) / totalPosts) : 0;
    const avgShares = totalPosts > 0 ? Math.round(posts.reduce((s, p) => s + (p.shares?.count || 0), 0) / totalPosts) : 0;
    const pendingDrafts = drafts.filter(d => d.status === 'draft').length;
    const totalReels = drafts.filter(d => d.status === 'approved' && d.channel === 'facebook_reels').length;
    const isReels = activeChannel === 'facebook_reels';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Share2 className="w-6 h-6 text-blue-600" />
                        Social Media
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage content across platforms — post, schedule, and review AI-generated content
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating || !CHANNELS.find(c => c.id === activeChannel)?.enabled}>
                        {generating
                            ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {isReels ? 'Generating Reel' : 'Generating'}... {generateElapsed > 0 && <span className="ml-1 text-xs text-muted-foreground">({generateElapsed}s)</span>}</>
                            : isReels
                                ? <><Video className="w-4 h-4 mr-1" /> Generate Reel</>
                                : <><Sparkles className="w-4 h-4 mr-1" /> Generate Draft</>
                        }
                    </Button>
                    {activeChannel.startsWith('facebook') && (
                        <Button variant="outline" size="sm" asChild>
                            <a href="https://facebook.com/profile.php?id=61586963125764" target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-1" /> View Page
                            </a>
                        </Button>
                    )}
                </div>
            </div>

            {/* Channel Selector */}
            <div className="flex gap-2">
                {CHANNELS.map(ch => (
                    <button
                        key={ch.id}
                        onClick={() => ch.enabled && setActiveChannel(ch.id)}
                        disabled={!ch.enabled}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all
                            ${activeChannel === ch.id
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : ch.enabled
                                    ? 'bg-card hover:bg-muted border-border text-foreground'
                                    : 'bg-muted/30 border-border text-muted-foreground cursor-not-allowed opacity-50'
                            }`}
                    >
                        {ch.icon}
                        {ch.label}
                        {!ch.enabled && <Badge variant="outline" className="text-[9px] h-4 px-1">Soon</Badge>}
                    </button>
                ))}
            </div>

            {/* Feedback */}
            {successMessage && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                    {successMessage}
                    <button onClick={() => setSuccessMessage('')}>✕</button>
                </div>
            )}
            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                    {errorMessage}
                    <button onClick={() => setErrorMessage('')}>✕</button>
                </div>
            )}

            {/* Metrics Bar */}
            {generating && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            <span className="text-sm font-medium">
                                {isReels ? '🎬 Generating Reel with Veo 3...' : '✨ Generating AI Draft...'}
                            </span>
                            <span className="ml-auto text-sm font-mono text-muted-foreground">{generateElapsed}s</span>
                        </div>
                        <div className="w-full bg-blue-200/50 dark:bg-blue-800/30 rounded-full h-1.5">
                            <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${Math.min((generateElapsed / (isReels ? 300 : 60)) * 100, 95)}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">
                            {isReels
                                ? 'Video generation can take 2-5 minutes. Generating video with audio, captions, and visuals...'
                                : 'Generating post copy and branded image...'}
                        </p>
                    </CardContent>
                </Card>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {isReels ? (
                    <>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950"><Film className="w-4 h-4 text-purple-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Total Reels</p><p className="text-xl font-bold">{totalReels}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950"><Eye className="w-4 h-4 text-blue-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Total Views</p><p className="text-xl font-bold">—</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-950"><Video className="w-4 h-4 text-pink-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Avg Plays</p><p className="text-xl font-bold">—</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950"><Share2 className="w-4 h-4 text-green-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Avg Shares</p><p className="text-xl font-bold">—</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950"><Sparkles className="w-4 h-4 text-amber-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Pending Drafts</p><p className="text-xl font-bold">{pendingDrafts}</p></div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950"><Eye className="w-4 h-4 text-blue-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Posts</p><p className="text-xl font-bold">{totalPosts}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-950"><ThumbsUp className="w-4 h-4 text-pink-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Avg Likes</p><p className="text-xl font-bold">{avgLikes}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950"><MessageCircle className="w-4 h-4 text-amber-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Avg Comments</p><p className="text-xl font-bold">{avgComments}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950"><Share2 className="w-4 h-4 text-green-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Avg Shares</p><p className="text-xl font-bold">{avgShares}</p></div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950"><Sparkles className="w-4 h-4 text-purple-600" /></div>
                                <div><p className="text-xs text-muted-foreground">Pending Drafts</p><p className="text-xl font-bold">{pendingDrafts}</p></div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b">
                {(['feed', 'drafts', 'settings'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize
                            ${activeTab === tab
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {tab === 'drafts' && pendingDrafts > 0 && (
                            <Badge variant="secondary" className="mr-1.5 h-5 px-1.5 text-[10px] bg-purple-100 text-purple-700">{pendingDrafts}</Badge>
                        )}
                        {tab === 'feed' && <Send className="w-3.5 h-3.5 inline mr-1.5" />}
                        {tab === 'drafts' && <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />}
                        {tab === 'settings' && <Settings className="w-3.5 h-3.5 inline mr-1.5" />}
                        {tab}
                    </button>
                ))}
            </div>

            {/* ── Feed Tab ── */}
            {
                activeTab === 'feed' && (
                    <div className="space-y-4">
                        {/* Published Posts/Reels Feed */}
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {isReels ? '📽️ Published Reels' : 'Recent Posts'}
                            </h2>
                            <Button variant="ghost" size="sm" onClick={isReels ? fetchDrafts : fetchPosts} disabled={loading}>
                                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                            </Button>
                        </div>

                        {isReels ? (
                            /* ── Reels Feed (from Firestore published reels) ── */
                            (() => {
                                const publishedReels = drafts.filter(d => d.status === 'approved' || d.status === 'published');
                                return publishedReels.length === 0 ? (
                                    <Card><CardContent className="p-8 text-center text-muted-foreground">
                                        <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No published reels yet.</p>
                                        <p className="text-xs mt-1">Generate a reel and approve it to see it here.</p>
                                    </CardContent></Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {publishedReels.map(reel => (
                                            <Card key={reel.id} className="overflow-hidden">
                                                <CardContent className="p-0">
                                                    {reel.videoUrl ? (
                                                        <div className="relative aspect-[9/16] max-h-[320px] bg-black">
                                                            <video src={reel.videoUrl} className="w-full h-full object-cover" controls muted />
                                                            {reel.videoDurationSeconds && (
                                                                <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                                    {reel.videoDurationSeconds}s
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-[9/16] max-h-[200px] bg-muted flex items-center justify-center">
                                                            <Film className="w-10 h-10 text-muted-foreground opacity-30" />
                                                        </div>
                                                    )}
                                                    <div className="p-3">
                                                        <p className="text-sm line-clamp-2 mb-2">{reel.message}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            {reel.audience && (
                                                                <Badge variant="outline" className="text-[9px] h-4">
                                                                    {reel.audience === 'client' ? '🏢 Client' : '🔧 Contractor'}
                                                                </Badge>
                                                            )}
                                                            {reel.location && (
                                                                <Badge variant="outline" className="text-[9px] h-4">📍 {reel.location}</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                );
                            })()
                        ) : (
                            /* ── Posts Feed (from Facebook Graph API) ── */
                            loading ? (
                                <div className="space-y-4">{[1, 2, 3].map(i => (
                                    <Card key={i}><CardContent className="p-4 space-y-3">
                                        <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-[200px] w-full rounded-lg" />
                                    </CardContent></Card>
                                ))}</div>
                            ) : posts.length === 0 ? (
                                <Card><CardContent className="p-8 text-center text-muted-foreground">
                                    <Facebook className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No posts yet.</p>
                                </CardContent></Card>
                            ) : posts.map(post => (
                                <Card key={post.id} className="overflow-hidden">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">X</div>
                                                <div>
                                                    <p className="text-sm font-semibold">XIRI Facility Solutions</p>
                                                    <p className="text-xs text-muted-foreground">{formatDate(post.created_time)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {post.permalink_url && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                        <a href={post.permalink_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(post.id)} disabled={deleting === post.id}>
                                                    {deleting === post.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                </Button>
                                            </div>
                                        </div>
                                        {post.message && (
                                            <p className="text-sm whitespace-pre-wrap mb-3 leading-relaxed">
                                                {post.message.length > 300 ? post.message.slice(0, 300) + '...' : post.message}
                                            </p>
                                        )}
                                        {post.full_picture && (
                                            <div className="rounded-lg overflow-hidden border mb-3">
                                                <img src={post.full_picture} alt="Post" className="w-full max-h-[400px] object-cover" />
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><ThumbsUp className="w-3.5 h-3.5" />{post.likes?.summary?.total_count || 0}</span>
                                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{post.comments?.summary?.total_count || 0}</span>
                                            <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" />{post.shares?.count || 0}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                )
            }

            {/* ── Drafts Tab ── */}
            {
                activeTab === 'drafts' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">
                                {activeChannel === 'facebook_reels' ? 'Reel Drafts' : 'AI-Generated Drafts'}
                            </h2>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={fetchDrafts} disabled={loadingDrafts}>
                                    <RefreshCw className={`w-4 h-4 mr-1 ${loadingDrafts ? 'animate-spin' : ''}`} /> Refresh
                                </Button>
                            </div>
                        </div>

                        {loadingDrafts ? (
                            <div className="space-y-4">{[1, 2].map(i => (
                                <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
                            ))}</div>
                        ) : drafts.length === 0 ? (
                            <Card>
                                <CardContent className="p-8 text-center text-muted-foreground">
                                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No drafts yet. Click &quot;{activeChannel === 'facebook_reels' ? 'Generate Reel' : 'Generate Draft'}&quot; to create one.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className={activeChannel === 'facebook_reels' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                                {drafts.map(draft => (
                                    <Card key={draft.id} className={`overflow-hidden ${draft.status === 'draft' ? 'border-purple-200 dark:border-purple-800' : ''}`}>
                                        <CardContent className="p-4">
                                            {/* Header badges */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant={
                                                        draft.status === 'draft' ? 'secondary' :
                                                            draft.status === 'approved' ? 'default' : 'destructive'
                                                    } className={
                                                        draft.status === 'draft' ? 'bg-purple-100 text-purple-700' :
                                                            draft.status === 'approved' ? 'bg-green-100 text-green-700' : ''
                                                    }>
                                                        {draft.status === 'draft' && <Sparkles className="w-3 h-3 mr-1" />}
                                                        {draft.status === 'approved' && <Check className="w-3 h-3 mr-1" />}
                                                        {draft.status}
                                                    </Badge>
                                                    {draft.audience && (
                                                        <Badge variant="outline" className={`text-[10px] ${draft.audience === 'client'
                                                            ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300'
                                                            : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300'
                                                            }`}>
                                                            {draft.audience === 'client' ? '🏢 Client' : '🔧 Contractor'}
                                                        </Badge>
                                                    )}
                                                    {(draft as any).location && (
                                                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                                                            📍 {(draft as any).location}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {/* Deadline countdown */}
                                                {draft.status === 'draft' && draft.scheduledFor && (() => {
                                                    const remaining = getTimeRemaining(draft.scheduledFor);
                                                    if (!remaining) return null;
                                                    return (
                                                        <div className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 font-medium shrink-0 ${remaining.urgent
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                                            : remaining.hours < 12
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                                : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
                                                            }`}>
                                                            <Timer className="w-3 h-3" />
                                                            {remaining.text}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Video Preview (Reels) */}
                                            {activeChannel === 'facebook_reels' && (draft as any).videoUrl && (
                                                <div className="mb-3 rounded-lg overflow-hidden border bg-black aspect-[9/16] max-h-[320px] relative group">
                                                    <video
                                                        src={(draft as any).videoUrl}
                                                        className="w-full h-full object-cover"
                                                        controls
                                                        preload="metadata"
                                                        poster={(draft as any).videoUrl + '#t=0.5'}
                                                    />
                                                    {(draft as any).videoDurationSeconds && (
                                                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                            {(draft as any).videoDurationSeconds}s
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Image Preview (Posts) */}
                                            {activeChannel === 'facebook_posts' && draft.imageUrl && (
                                                <div className="mb-3 rounded-lg overflow-hidden border">
                                                    <img src={draft.imageUrl} alt="AI-generated post image" className="w-full h-48 object-cover" />
                                                </div>
                                            )}

                                            {/* Caption / Message */}
                                            {editingDraft === draft.id ? (
                                                <textarea
                                                    value={editedMessage}
                                                    onChange={(e) => setEditedMessage(e.target.value)}
                                                    className="w-full min-h-[100px] p-3 text-sm border rounded-lg bg-muted/20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                                                />
                                            ) : (
                                                <p className={`text-sm whitespace-pre-wrap mb-3 leading-relaxed ${activeChannel === 'facebook_reels' ? 'line-clamp-4' : ''}`}>
                                                    {draft.message}
                                                </p>
                                            )}

                                            {/* Location Tag Input */}
                                            {draft.status === 'draft' && (
                                                <div className="mb-3">
                                                    <input
                                                        type="text"
                                                        placeholder="📍 Add location (e.g. New Hyde Park)"
                                                        defaultValue={(draft as any).location || ''}
                                                        className="w-full px-3 py-1.5 text-xs border rounded-lg bg-muted/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        onBlur={async (e) => {
                                                            const loc = e.target.value.trim();
                                                            if (loc !== ((draft as any).location || '')) {
                                                                const { doc, updateDoc } = await import('firebase/firestore');
                                                                await updateDoc(doc(db, 'social_posts', draft.id), { location: loc || null });
                                                                fetchDrafts();
                                                            }
                                                        }}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                    />
                                                </div>
                                            )}

                                            {/* Actions */}
                                            {draft.status === 'draft' && (
                                                <div className="flex gap-2 pt-2 border-t flex-wrap">
                                                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleReview(draft.id, 'approve')}
                                                        disabled={reviewingId === draft.id}>
                                                        {reviewingId === draft.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                                                        Approve
                                                    </Button>
                                                    {editingDraft === draft.id ? (
                                                        <Button size="sm" variant="outline" onClick={() => { setEditingDraft(null); setEditedMessage(''); }}>
                                                            Cancel
                                                        </Button>
                                                    ) : (
                                                        <Button size="sm" variant="outline" onClick={() => { setEditingDraft(draft.id); setEditedMessage(draft.message); }}>
                                                            <Edit3 className="w-4 h-4 mr-1" /> Edit
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="destructive" onClick={() => handleReview(draft.id, 'reject')}
                                                        disabled={reviewingId === draft.id}>
                                                        <X className="w-4 h-4 mr-1" /> Reject
                                                    </Button>
                                                    {/* Reuse Button (clone with new location) */}
                                                    {(draft as any).videoUrl && (
                                                        <Button size="sm" variant="outline" className="ml-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                            onClick={async () => {
                                                                const newLoc = prompt('Enter location for the reused reel (e.g. Great Neck, NY):');
                                                                if (!newLoc) return;
                                                                const { collection, addDoc } = await import('firebase/firestore');
                                                                await addDoc(collection(db, 'social_posts'), {
                                                                    ...draft,
                                                                    id: undefined,
                                                                    location: newLoc,
                                                                    status: 'draft',
                                                                    reusedFrom: draft.id,
                                                                    reviewedBy: null,
                                                                    reviewedAt: null,
                                                                    createdAt: new Date(),
                                                                });
                                                                fetchDrafts();
                                                            }}>
                                                            ♻️ Reuse
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )
            }

            {/* ── Settings Tab ── */}
            {
                activeTab === 'settings' && (
                    <div className="max-w-2xl space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-amber-500" /> AI Content Engine
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Enable/Disable */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                    <div>
                                        <p className="font-medium text-sm">Auto-generate drafts</p>
                                        <p className="text-xs text-muted-foreground">AI will create Facebook post drafts for your review</p>
                                    </div>
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-blue-600' : 'bg-muted'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Cadence */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Posting Cadence</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {CADENCE_OPTIONS.map(opt => (
                                            <button key={opt.value}
                                                onClick={() => setConfig(prev => ({ ...prev, cadence: opt.value }))}
                                                className={`px-3 py-2 text-sm rounded-lg border transition-colors
                                                ${config.cadence === opt.value
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'hover:bg-muted border-border'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preferred Days */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Preferred Days</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => (
                                            <button key={day}
                                                onClick={() => toggleDay(day)}
                                                className={`px-3 py-1.5 text-xs rounded-full border transition-colors capitalize
                                                ${config.preferredDays.includes(day)
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'hover:bg-muted border-border'
                                                    }`}
                                            >
                                                {day.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Preferred Time */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Posting Time (ET)</label>
                                    <input type="time" value={config.preferredTime}
                                        onChange={(e) => setConfig(prev => ({ ...prev, preferredTime: e.target.value }))}
                                        className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-[140px]" />
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Tone</label>
                                    <input type="text" value={config.tone}
                                        onChange={(e) => setConfig(prev => ({ ...prev, tone: e.target.value }))}
                                        placeholder="e.g. Professional, bold, blue-collar-friendly"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>

                                {/* Audience Mix */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Audience Mix</label>
                                    <p className="text-xs text-muted-foreground mb-3">Balance content between clients (lead gen) and contractors (recruitment)</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-medium text-sky-600 w-20">🏢 Client</span>
                                        <input
                                            type="range" min="0" max="100" step="10"
                                            value={config.audienceMix?.client ?? 50}
                                            onChange={(e) => {
                                                const clientVal = Number(e.target.value);
                                                setConfig(prev => ({
                                                    ...prev,
                                                    audienceMix: { client: clientVal, contractor: 100 - clientVal },
                                                }));
                                            }}
                                            className="flex-1 accent-blue-600"
                                        />
                                        <span className="text-xs font-medium text-orange-600 w-24 text-right">🔧 Contractor</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>{config.audienceMix?.client ?? 50}%</span>
                                        <span>{config.audienceMix?.contractor ?? 50}%</span>
                                    </div>
                                </div>

                                {/* Topics */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Topics</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {config.topics.map((topic, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                {topic}
                                                <button onClick={() => setConfig(prev => ({ ...prev, topics: prev.topics.filter((_, idx) => idx !== i) }))}
                                                    className="hover:text-red-500 ml-0.5">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input type="text" placeholder="Type a topic and press Enter"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                if (val && !config.topics.includes(val)) {
                                                    setConfig(prev => ({ ...prev, topics: [...prev.topics, val] }));
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }} />
                                </div>

                                {/* Hashtags */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Hashtags</label>
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {config.hashtagSets.map((tag, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                {tag}
                                                <button onClick={() => setConfig(prev => ({ ...prev, hashtagSets: prev.hashtagSets.filter((_, idx) => idx !== i) }))}
                                                    className="hover:text-red-500 ml-0.5">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input type="text" placeholder="Type a hashtag and press Enter"
                                        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                let val = (e.target as HTMLInputElement).value.trim();
                                                if (val && !val.startsWith('#')) val = '#' + val;
                                                if (val && !config.hashtagSets.includes(val)) {
                                                    setConfig(prev => ({ ...prev, hashtagSets: [...prev.hashtagSets, val] }));
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }
                                        }} />
                                </div>

                                {/* Save */}
                                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSaveConfig} disabled={savingConfig}>
                                    {savingConfig ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Settings'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )
            }
        </div >
    );
}
