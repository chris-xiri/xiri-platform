'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, addDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { functions, db, storage } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Send, Clock, Loader2, ThumbsUp, MessageCircle, Share2,
    Trash2, Calendar, Image as ImageIcon, Link2, RefreshCw, ExternalLink,
    Facebook, Settings, Sparkles, Check, X, Edit3, TrendingUp, Users, Eye,
    Zap, AlertTriangle, Timer, Film, Linkedin, Video, Upload,
    Plus, Search, MapPin
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
    error?: string;
    failedAt?: any;
    facebookPlaceId?: string;
    engagementContext?: {
        avgLikes: number;
        avgComments: number;
        avgShares: number;
        topPostThemes: string[];
    };
    createdAt: any;
}

interface SocialCampaign {
    id: string;
    name: string;
    channel: string;
    audience: 'client' | 'contractor';
    location: string;
    facebookPlaceId: string | null;
    hookOverride?: string;
    startDate: any; // Firestore Timestamp
    endDate: any;   // Firestore Timestamp
    status: 'active' | 'paused' | 'completed';
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
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Helper to update URL query params without full navigation
    const updateQueryParams = useCallback((updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => params.set(key, value));
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [searchParams, router, pathname]);

    // Channel state — persisted in URL as ?channel=
    const activeChannel = (searchParams.get('channel') as Channel) || 'facebook_posts';
    const setActiveChannel = useCallback((ch: Channel) => {
        updateQueryParams({ channel: ch });
    }, [updateQueryParams]);

    // Tab state — persisted in URL as ?subtab=
    const activeTab = (searchParams.get('subtab') as 'feed' | 'drafts' | 'campaigns' | 'settings') || 'feed';
    const setActiveTab = useCallback((tab: 'feed' | 'drafts' | 'campaigns' | 'settings') => {
        updateQueryParams({ subtab: tab });
    }, [updateQueryParams]);

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

    // Lightbox state for image/video zoom
    const [lightboxMedia, setLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

    // Campaigns state
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [newCampaign, setNewCampaign] = useState<Partial<SocialCampaign>>({
        status: 'active',
        audience: 'contractor'
    });
    const [placeSearchResults, setPlaceSearchResults] = useState<any[]>([]);
    const [searchingPlaces, setSearchingPlaces] = useState(false);

    // Video upload state
    const [uploading, setUploading] = useState(false);
    const videoInputRef = useRef<HTMLInputElement>(null);

    // Publish now state
    const [publishingId, setPublishingId] = useState<string | null>(null);

    // Regeneration state
    const [regenImageId, setRegenImageId] = useState<string | null>(null);
    const [regenCaptionId, setRegenCaptionId] = useState<string | null>(null);
    const [regenFeedback, setRegenFeedback] = useState('');
    const [regenFeedbackTarget, setRegenFeedbackTarget] = useState<{ id: string; type: 'image' | 'caption' } | null>(null);

    // Location picker state
    const [locationPickerDraftId, setLocationPickerDraftId] = useState<string | null>(null);
    const [locationQuery, setLocationQuery] = useState('');
    const [locationResults, setLocationResults] = useState<any[]>([]);
    const [searchingLocation, setSearchingLocation] = useState(false);
    const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                where('status', 'in', ['draft', 'approved', 'rejected', 'failed']),
                orderBy('scheduledFor', 'asc'),
                limit(20)
            );
            const snapshot = await getDocs(q);
            const items: DraftPost[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as DraftPost));
            // Sort: draft/approved first, failed next, rejected last
            items.sort((a, b) => {
                const order: Record<string, number> = { draft: 0, approved: 1, failed: 2, rejected: 3 };
                return (order[a.status] ?? 4) - (order[b.status] ?? 4);
            });
            setDrafts(items);
        } catch (err: any) {
            console.error('Error fetching drafts:', err);
        } finally {
            setLoadingDrafts(false);
        }
    }, [activeChannel]);

    const fetchCampaigns = useCallback(async () => {
        try {
            setLoadingCampaigns(true);
            const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
            const q = query(
                collection(db, 'social_campaigns'),
                where('channel', '==', activeChannel),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialCampaign)));
        } catch (err: any) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoadingCampaigns(false);
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
        fetchCampaigns();
        fetchConfig();
    }, [fetchPosts, fetchDrafts, fetchCampaigns, fetchConfig]);

    // Auto-clear feedback
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    // ── Handlers ──

    const handleSearchPlaces = async (query: string) => {
        if (!query.trim()) {
            setPlaceSearchResults([]);
            return;
        }
        setSearchingPlaces(true);
        try {
            const searchFn = httpsCallable(functions, 'searchPlaces');
            const result: any = await searchFn({ query });
            setPlaceSearchResults(result.data?.places || []);
        } catch (err) {
            console.error(err);
        } finally {
            setSearchingPlaces(false);
        }
    };

    const handleSaveCampaign = async () => {
        if (!newCampaign.name || !newCampaign.location || !newCampaign.facebookPlaceId || !newCampaign.startDate || !newCampaign.endDate) {
            setErrorMessage('Please fill in all required fields and select a valid location');
            return;
        }
        try {
            const { collection, addDoc, Timestamp } = await import('firebase/firestore');
            await addDoc(collection(db, 'social_campaigns'), {
                ...newCampaign,
                channel: activeChannel,
                startDate: Timestamp.fromDate(new Date(`${newCampaign.startDate}T00:00:00`)),
                endDate: Timestamp.fromDate(new Date(`${newCampaign.endDate}T23:59:59`)),
                createdAt: Timestamp.now(),
            });
            setShowCampaignModal(false);
            setNewCampaign({ status: 'active', audience: 'contractor' });
            setPlaceSearchResults([]);
            setSuccessMessage('Campaign created successfully!');
            fetchCampaigns();
        } catch (err: any) {
            setErrorMessage('Failed to save campaign: ' + err.message);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm('Delete this campaign?')) return;
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'social_campaigns', id));
            setSuccessMessage('Campaign deleted');
            fetchCampaigns();
        } catch (err) {
            setErrorMessage('Failed to delete campaign');
        }
    };

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

    const handleDeleteDraft = async (postId: string) => {
        if (!confirm('Delete this draft permanently?')) return;
        try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'social_posts', postId));
            setDrafts(prev => prev.filter(d => d.id !== postId));
            setSuccessMessage('Draft deleted');
        } catch (err: any) {
            setErrorMessage('Failed to delete draft');
        }
    };

    const handlePublishNow = async (postId: string) => {
        if (!confirm('Publish this post to Facebook right now?')) return;
        setPublishingId(postId);
        try {
            const publishNow = httpsCallable(functions, 'publishPostNow', { timeout: 120000 });
            const result: any = await publishNow({ postId });
            setSuccessMessage(`Published! ${result.data?.postUrl ? `View: ${result.data.postUrl}` : ''}`);
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage('Publish failed: ' + (err.message || 'Unknown error'));
        } finally {
            setPublishingId(null);
        }
    };

    const handleLocationSearch = useCallback(async (query: string) => {
        if (!query || query.length < 2) {
            setLocationResults([]);
            return;
        }
        setSearchingLocation(true);
        try {
            const searchFn = httpsCallable(functions, 'searchPlaces');
            const result: any = await searchFn({ query });
            setLocationResults(result.data?.places || []);
        } catch (err: any) {
            console.error('Place search failed:', err);
            setLocationResults([]);
        } finally {
            setSearchingLocation(false);
        }
    }, []);

    const handleLocationQueryChange = useCallback((query: string) => {
        setLocationQuery(query);
        if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
        locationDebounceRef.current = setTimeout(() => handleLocationSearch(query), 400);
    }, [handleLocationSearch]);

    const handleSelectPlace = async (postId: string, place: any) => {
        try {
            const { doc: docRef, updateDoc } = await import('firebase/firestore');
            await updateDoc(docRef(db, 'social_posts', postId), {
                location: `${place.name}${place.location?.city ? `, ${place.location.city}` : ''}`,
                facebookPlaceId: place.id,
            });
            setSuccessMessage(`📍 Location set: ${place.name}`);
            setLocationPickerDraftId(null);
            setLocationQuery('');
            setLocationResults([]);
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage('Failed to set location: ' + (err.message || 'Unknown error'));
        }
    };

    const handleClearLocation = async (postId: string) => {
        try {
            const { doc: docRef, updateDoc } = await import('firebase/firestore');
            await updateDoc(docRef(db, 'social_posts', postId), {
                location: null,
                facebookPlaceId: null,
            });
            setSuccessMessage('Location removed');
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage('Failed to clear location: ' + (err.message || 'Unknown error'));
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

    // ── Regeneration Handlers ──
    const handleRegenImage = async (postId: string, feedback: string) => {
        setRegenImageId(postId);
        setRegenFeedbackTarget(null);
        setRegenFeedback('');
        try {
            const regenFn = httpsCallable(functions, 'regeneratePostImage', { timeout: 300000 });
            await regenFn({ postId, feedback: feedback || undefined });
            setSuccessMessage('Image regenerated!');
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage('Image regen failed: ' + (err.message || 'Unknown error'));
        } finally {
            setRegenImageId(null);
        }
    };

    const handleRegenCaption = async (postId: string, feedback: string) => {
        setRegenCaptionId(postId);
        setRegenFeedbackTarget(null);
        setRegenFeedback('');
        try {
            const regenFn = httpsCallable(functions, 'regeneratePostCaption', { timeout: 120000 });
            await regenFn({ postId, feedback: feedback || undefined });
            setSuccessMessage('Caption regenerated!');
            fetchDrafts();
        } catch (err: any) {
            setErrorMessage('Caption regen failed: ' + (err.message || 'Unknown error'));
        } finally {
            setRegenCaptionId(null);
        }
    };

    // ── Video Upload for Reels ──
    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('video/')) {
            setErrorMessage('Please select a video file (MP4, MOV, etc.)');
            return;
        }

        // Validate file size (100MB max)
        if (file.size > 100 * 1024 * 1024) {
            setErrorMessage('Video must be under 100MB');
            return;
        }

        setUploading(true);
        try {
            const fileId = `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const storageRef = ref(storage, `social-videos/${fileId}.mp4`);

            // Upload to Firebase Storage
            await uploadBytes(storageRef, file, { contentType: file.type });
            const videoUrl = await getDownloadURL(storageRef);

            // Create a draft in Firestore
            await addDoc(collection(db, 'social_posts'), {
                platform: 'facebook',
                channel: 'facebook_reels',
                audience: 'client',
                message: '',
                videoUrl,
                videoStoragePath: `social-videos/${fileId}.mp4`,
                videoDurationSeconds: null,
                status: 'draft',
                generatedBy: 'upload',
                scheduledFor: Timestamp.fromDate(new Date()),
                createdAt: Timestamp.now(),
            });

            setSuccessMessage('Video uploaded! Edit the caption in the Drafts tab.');
            setActiveTab('drafts');
            setTimeout(fetchDrafts, 1000);
        } catch (err: any) {
            setErrorMessage('Upload failed: ' + (err.message || 'Unknown error'));
        } finally {
            setUploading(false);
            // Reset the file input
            if (videoInputRef.current) videoInputRef.current.value = '';
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
        <>
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
                        {/* Hidden file input for video uploads */}
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleVideoUpload}
                        />
                        {isReels && (
                            <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={uploading}>
                                {uploading
                                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</>
                                    : <><Upload className="w-4 h-4 mr-1" /> Upload Video</>
                                }
                            </Button>
                        )}
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
                    {(['feed', 'drafts', 'campaigns', 'settings'] as const).map(tab => (
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
                            {tab === 'campaigns' && <Zap className="w-3.5 h-3.5 inline mr-1.5" />}
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
                                ) : (<div className="space-y-4">{posts.map(post => (
                                    <Card key={post.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                        <CardContent className="p-0">
                                            <div className="flex">
                                                {/* Left: Image thumbnail */}
                                                <div className="w-80 shrink-0 bg-muted/30">
                                                    {post.full_picture ? (
                                                        <img src={post.full_picture} alt="Post" className="w-full aspect-square object-contain bg-muted/50 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightboxMedia({ url: post.full_picture!, type: 'image' })} />
                                                    ) : (
                                                        <div className="w-full aspect-square flex items-center justify-center">
                                                            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Right: Content */}
                                                <div className="flex-1 p-3 flex flex-col min-w-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[10px]">X</div>
                                                            <div>
                                                                <p className="text-xs font-semibold">XIRI Facility Solutions</p>
                                                                <p className="text-[10px] text-muted-foreground">{formatDate(post.created_time)}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-0.5">
                                                            {post.permalink_url && (
                                                                <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                                                                    <a href={post.permalink_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => handleDelete(post.id)} disabled={deleting === post.id}>
                                                                {deleting === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {post.message && (
                                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed flex-1 mb-2">
                                                            {post.message}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3 pt-2 border-t text-[10px] text-muted-foreground mt-auto">
                                                        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{post.likes?.summary?.total_count || 0}</span>
                                                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comments?.summary?.total_count || 0}</span>
                                                        <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{post.shares?.count || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}</div>)
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
                                        {activeChannel === 'facebook_reels' ? (
                                            <>
                                                <Upload className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No reel drafts yet. Upload a video or generate one with AI.</p>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>No drafts yet. Click &quot;Generate Draft&quot; to create one.</p>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {drafts.map(draft => (
                                        <Card key={draft.id} className={`overflow-hidden transition-shadow hover:shadow-md ${draft.status === 'draft' ? 'border-purple-200 dark:border-purple-800' :
                                            draft.status === 'rejected' ? 'opacity-50 border-dashed' : ''
                                            }`}>
                                            <CardContent className="p-0">
                                                <div className="flex">
                                                    {/* ── Left: Media Thumbnail ── */}
                                                    <div className="w-80 shrink-0 bg-muted/30 relative">
                                                        {activeChannel === 'facebook_reels' && (draft as any).videoUrl ? (
                                                            <video
                                                                src={(draft as any).videoUrl}
                                                                className="w-full aspect-square object-contain bg-muted/50 cursor-pointer"
                                                                preload="metadata"
                                                                controls
                                                                muted
                                                                onClick={(e) => { e.stopPropagation(); setLightboxMedia({ url: (draft as any).videoUrl, type: 'video' }); }}
                                                            />
                                                        ) : activeChannel === 'facebook_posts' && draft.imageUrl ? (
                                                            <img src={draft.imageUrl} alt="Post image" className="w-full aspect-square object-contain bg-muted/50 cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setLightboxMedia({ url: draft.imageUrl!, type: 'image' })} />
                                                        ) : (
                                                            <div className="w-full aspect-square flex items-center justify-center">
                                                                {activeChannel === 'facebook_reels'
                                                                    ? <Film className="w-8 h-8 text-muted-foreground/30" />
                                                                    : <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                                                                }
                                                            </div>
                                                        )}
                                                        {/* Duration badge for reels */}
                                                        {(draft as any).videoDurationSeconds && (
                                                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                                {(draft as any).videoDurationSeconds}s
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* ── Right: Content + Actions ── */}
                                                    <div className="flex-1 p-3 flex flex-col min-w-0">
                                                        {/* Top row: badges + countdown */}
                                                        <div className="flex items-center justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <Badge variant={
                                                                    draft.status === 'draft' ? 'secondary' :
                                                                        draft.status === 'approved' ? 'default' : 'destructive'
                                                                } className={`text-[10px] ${draft.status === 'draft' ? 'bg-purple-100 text-purple-700' :
                                                                    draft.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                        draft.status === 'failed' ? 'bg-red-100 text-red-700' : ''
                                                                    }`}>
                                                                    {draft.status === 'draft' && <Sparkles className="w-2.5 h-2.5 mr-0.5" />}
                                                                    {draft.status === 'approved' && <Check className="w-2.5 h-2.5 mr-0.5" />}
                                                                    {draft.status === 'failed' && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
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
                                                            </div>
                                                            {draft.status === 'draft' && draft.scheduledFor && (() => {
                                                                const remaining = getTimeRemaining(draft.scheduledFor);
                                                                if (!remaining) return null;
                                                                return (
                                                                    <div className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium shrink-0 ${remaining.urgent
                                                                        ? 'bg-red-100 text-red-700'
                                                                        : remaining.hours < 12
                                                                            ? 'bg-amber-100 text-amber-700'
                                                                            : 'bg-blue-50 text-blue-600'
                                                                        }`}>
                                                                        <Timer className="w-2.5 h-2.5" />
                                                                        {remaining.text}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>

                                                        {/* Message preview */}
                                                        {editingDraft === draft.id ? (
                                                            <textarea
                                                                value={editedMessage}
                                                                onChange={(e) => setEditedMessage(e.target.value)}
                                                                className="w-full min-h-[80px] p-2 text-xs border rounded-lg bg-muted/20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                                            />
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap mb-2 leading-relaxed flex-1">
                                                                {draft.message}
                                                            </p>
                                                        )}

                                                        {/* Location tag — inline picker */}
                                                        <div className="mb-2">
                                                            {locationPickerDraftId === draft.id ? (
                                                                <div className="relative">
                                                                    <div className="flex items-center gap-1">
                                                                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 h-7 text-xs px-2 border rounded-md bg-background dark:bg-neutral-900"
                                                                            placeholder="Search Facebook Places (e.g. Great Neck, NY)"
                                                                            value={locationQuery}
                                                                            onChange={(e) => handleLocationQueryChange(e.target.value)}
                                                                            autoFocus
                                                                        />
                                                                        {searchingLocation && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                                                        <button className="text-muted-foreground hover:text-foreground" onClick={() => { setLocationPickerDraftId(null); setLocationQuery(''); setLocationResults([]); }}>
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    {locationResults.length > 0 && (
                                                                        <div className="absolute z-20 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                                                            {locationResults.map((place: any) => (
                                                                                <button
                                                                                    key={place.id}
                                                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2 border-b last:border-b-0"
                                                                                    onClick={() => handleSelectPlace(draft.id, place)}
                                                                                >
                                                                                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                                    <div>
                                                                                        <div className="font-medium">{place.name}</div>
                                                                                        {place.location?.city && (
                                                                                            <div className="text-[10px] text-muted-foreground">
                                                                                                {[place.location.city, place.location.state].filter(Boolean).join(', ')}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-auto border-emerald-200 text-emerald-600 shrink-0">FB Place</Badge>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {locationQuery.length >= 2 && !searchingLocation && locationResults.length === 0 && (
                                                                        <div className="absolute z-20 left-0 right-0 mt-1 bg-background border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
                                                                            No Facebook Places found for "{locationQuery}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1">
                                                                    {(draft as any).location ? (
                                                                        <button
                                                                            className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-0.5"
                                                                            onClick={() => { setLocationPickerDraftId(draft.id); setLocationQuery(''); setLocationResults([]); }}
                                                                        >
                                                                            📍 {(draft as any).location}
                                                                            {(draft as any).facebookPlaceId && (
                                                                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-1 border-emerald-200 text-emerald-600">FB Tagged</Badge>
                                                                            )}
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-0.5"
                                                                            onClick={() => { setLocationPickerDraftId(draft.id); setLocationQuery(''); setLocationResults([]); }}
                                                                        >
                                                                            📍 Add Location
                                                                        </button>
                                                                    )}
                                                                    {(draft as any).location && (
                                                                        <button className="text-[10px] text-muted-foreground hover:text-red-500 ml-1" onClick={() => handleClearLocation(draft.id)} title="Remove location">
                                                                            <X className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Outro CTA selector — only for reels */}
                                                        {(draft as any).videoUrl && draft.status === 'draft' && (
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <span className="text-[10px] text-muted-foreground">🎬 Outro:</span>
                                                                <select
                                                                    className="text-[10px] h-6 px-1.5 border rounded bg-background dark:bg-neutral-900 cursor-pointer"
                                                                    value={(draft as any).outroPresetId || ''}
                                                                    onChange={async (e) => {
                                                                        const { doc: docRef, updateDoc } = await import('firebase/firestore');
                                                                        await updateDoc(docRef(db, 'social_posts', draft.id), {
                                                                            outroPresetId: e.target.value || null,
                                                                        });
                                                                        fetchDrafts();
                                                                    }}
                                                                >
                                                                    <option value="">None</option>
                                                                    <option value="hiring">🧹 We're Hiring</option>
                                                                    <option value="quote">💼 Get a Quote</option>
                                                                    <option value="coverage">📍 Service Areas</option>
                                                                    <option value="partner">🤝 Become a Partner</option>
                                                                    <option value="brand">✨ Brand Only</option>
                                                                </select>
                                                                {(draft as any).outroPresetId && (
                                                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-sky-200 text-sky-600">+3s outro</Badge>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Error display for failed posts */}
                                                        {draft.status === 'failed' && draft.error && (
                                                            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-2.5 py-2 rounded-md text-[11px] mb-2 leading-relaxed">
                                                                <span className="font-semibold">Error:</span> {draft.error}
                                                            </div>
                                                        )}

                                                        {/* Retry + Delete for failed posts */}
                                                        {draft.status === 'failed' && (
                                                            <div className="flex gap-1.5 pt-2 border-t mt-auto">
                                                                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2" onClick={async () => {
                                                                    // Reset to approved so user can try Post Now
                                                                    const { doc: docRef, updateDoc } = await import('firebase/firestore');
                                                                    await updateDoc(docRef(db, 'social_posts', draft.id), {
                                                                        status: 'approved',
                                                                        error: null,
                                                                        failedAt: null,
                                                                    });
                                                                    setSuccessMessage('Post reset — click Post Now to retry.');
                                                                    fetchDrafts();
                                                                }}>
                                                                    <RefreshCw className="w-3 h-3 mr-0.5" /> Retry
                                                                </Button>
                                                                <Button size="sm" className="h-7 text-xs px-2" variant="destructive" onClick={() => handleDeleteDraft(draft.id)}>
                                                                    <Trash2 className="w-3 h-3 mr-0.5" /> Delete
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* Actions for draft status */}
                                                        {draft.status === 'draft' && (
                                                            <div className="flex flex-col gap-2 pt-2 border-t mt-auto">
                                                                <div className="flex gap-1.5 flex-wrap">
                                                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 px-2" onClick={() => handleReview(draft.id, 'approve')}
                                                                        disabled={reviewingId === draft.id}>
                                                                        {reviewingId === draft.id ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <Check className="w-3 h-3 mr-0.5" />}
                                                                        Approve
                                                                    </Button>
                                                                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2" onClick={() => handlePublishNow(draft.id)}
                                                                        disabled={publishingId === draft.id}>
                                                                        {publishingId === draft.id ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <Send className="w-3 h-3 mr-0.5" />}
                                                                        Post Now
                                                                    </Button>
                                                                    {editingDraft === draft.id ? (
                                                                        <Button size="sm" className="h-7 text-xs px-2" variant="outline" onClick={() => { setEditingDraft(null); setEditedMessage(''); }}>
                                                                            Cancel
                                                                        </Button>
                                                                    ) : (
                                                                        <Button size="sm" className="h-7 text-xs px-2" variant="outline" onClick={() => { setEditingDraft(draft.id); setEditedMessage(draft.message); }}>
                                                                            <Edit3 className="w-3 h-3 mr-0.5" /> Edit
                                                                        </Button>
                                                                    )}
                                                                    <Button size="sm" className="h-7 text-xs px-2" variant="destructive" onClick={() => handleReview(draft.id, 'reject')}
                                                                        disabled={reviewingId === draft.id}>
                                                                        <X className="w-3 h-3 mr-0.5" /> Reject
                                                                    </Button>
                                                                </div>

                                                                {/* Regen buttons row */}
                                                                <div className="flex gap-1.5 flex-wrap">
                                                                    <Button size="sm" className="h-7 text-xs px-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950" variant="outline"
                                                                        disabled={regenImageId === draft.id}
                                                                        onClick={() => {
                                                                            if (regenFeedbackTarget?.id === draft.id && regenFeedbackTarget?.type === 'image') {
                                                                                handleRegenImage(draft.id, regenFeedback);
                                                                            } else {
                                                                                setRegenFeedbackTarget({ id: draft.id, type: 'image' });
                                                                                setRegenFeedback('');
                                                                            }
                                                                        }}>
                                                                        {regenImageId === draft.id ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <ImageIcon className="w-3 h-3 mr-0.5" />}
                                                                        {regenFeedbackTarget?.id === draft.id && regenFeedbackTarget?.type === 'image' ? 'Go' : 'Regen Image'}
                                                                    </Button>
                                                                    <Button size="sm" className="h-7 text-xs px-2 text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950" variant="outline"
                                                                        disabled={regenCaptionId === draft.id}
                                                                        onClick={() => {
                                                                            if (regenFeedbackTarget?.id === draft.id && regenFeedbackTarget?.type === 'caption') {
                                                                                handleRegenCaption(draft.id, regenFeedback);
                                                                            } else {
                                                                                setRegenFeedbackTarget({ id: draft.id, type: 'caption' });
                                                                                setRegenFeedback('');
                                                                            }
                                                                        }}>
                                                                        {regenCaptionId === draft.id ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <Sparkles className="w-3 h-3 mr-0.5" />}
                                                                        {regenFeedbackTarget?.id === draft.id && regenFeedbackTarget?.type === 'caption' ? 'Go' : 'Regen Caption'}
                                                                    </Button>
                                                                    {regenFeedbackTarget?.id === draft.id && (
                                                                        <Button size="sm" className="h-7 text-xs px-2" variant="ghost"
                                                                            onClick={() => { setRegenFeedbackTarget(null); setRegenFeedback(''); }}>
                                                                            <X className="w-3 h-3" />
                                                                        </Button>
                                                                    )}
                                                                    {(draft as any).videoUrl && (
                                                                        <Button size="sm" className="h-7 text-xs px-2 ml-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50" variant="outline"
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

                                                                {/* Feedback input for regen */}
                                                                {regenFeedbackTarget?.id === draft.id && (
                                                                    <div className="flex gap-1.5 items-center">
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 h-7 text-xs px-2 border rounded-md bg-background dark:bg-neutral-900"
                                                                            placeholder={regenFeedbackTarget.type === 'image'
                                                                                ? 'e.g. "show a medical office" or "brighter colors"'
                                                                                : 'e.g. "more urgency" or "mention Queens"'}
                                                                            value={regenFeedback}
                                                                            onChange={(e) => setRegenFeedback(e.target.value)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') {
                                                                                    if (regenFeedbackTarget.type === 'image') handleRegenImage(draft.id, regenFeedback);
                                                                                    else handleRegenCaption(draft.id, regenFeedback);
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                        />
                                                                        <Button size="sm" className="h-7 text-xs px-2"
                                                                            onClick={() => {
                                                                                if (regenFeedbackTarget.type === 'image') handleRegenImage(draft.id, regenFeedback);
                                                                                else handleRegenCaption(draft.id, regenFeedback);
                                                                            }}>
                                                                            <Send className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Delete button for any draft */}
                                                        {(draft.status === 'rejected' || draft.status === 'draft' || draft.status === 'approved') && (
                                                            <div className={`flex gap-1.5 pt-2 border-t ${draft.status === 'draft' ? '' : 'mt-auto'}`}>
                                                                {/* Post Now for approved posts that haven't been published yet */}
                                                                {draft.status === 'approved' && (
                                                                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2" onClick={() => handlePublishNow(draft.id)}
                                                                        disabled={publishingId === draft.id}>
                                                                        {publishingId === draft.id ? <Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> : <Send className="w-3 h-3 mr-0.5" />}
                                                                        Post Now
                                                                    </Button>
                                                                )}
                                                                <Button size="sm" className="h-7 text-xs px-2" variant="destructive" onClick={() => handleDeleteDraft(draft.id)}>
                                                                    <Trash2 className="w-3 h-3 mr-0.5" /> Delete
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {/* ── Campaigns Tab ── */}
                {
                    activeTab === 'campaigns' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> Recruitment Drive Campaigns</h2>
                                    <p className="text-sm text-muted-foreground">Active campaigns override standard AI generic generation to focus exclusively on specific recruitment goals and verified locations.</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={fetchCampaigns} disabled={loadingCampaigns}>
                                        <RefreshCw className={`w-4 h-4 mr-1 ${loadingCampaigns ? 'animate-spin' : ''}`} /> Refresh
                                    </Button>
                                    <Button size="sm" onClick={() => setShowCampaignModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                        <Plus className="w-4 h-4 mr-1" /> New Campaign
                                    </Button>
                                </div>
                            </div>

                            {loadingCampaigns ? (
                                <div className="space-y-4">{[1, 2].map(i => (
                                    <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
                                ))}</div>
                            ) : campaigns.length === 0 ? (
                                <Card>
                                    <CardContent className="p-10 text-center text-muted-foreground bg-muted/20 border-dashed">
                                        <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium text-foreground">No active campaigns</p>
                                        <p className="text-sm mb-4 mt-1">Create a targeted recruitment drive with specific locations to override the standard baseline AI content schedule.</p>
                                        <Button size="sm" onClick={() => setShowCampaignModal(true)} variant="outline">Create Initial Campaign</Button>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-4">
                                    {campaigns.map(campaign => {
                                        const now = new Date();
                                        const startDt = campaign.startDate.toDate();
                                        const endDt = campaign.endDate.toDate();
                                        const isActive = campaign.status === 'active' && now >= startDt && now <= endDt;
                                        const isUpcoming = campaign.status === 'active' && now < startDt;
                                        const isCompleted = campaign.status === 'completed' || now > endDt;

                                        return (
                                            <Card key={campaign.id} className={isActive ? 'border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-900/10' : ''}>
                                                <CardContent className="p-4 flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className="font-semibold text-lg">{campaign.name}</h3>
                                                            {isActive && <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 pointer-events-none">Active Run</Badge>}
                                                            {isUpcoming && <Badge variant="secondary" className="pointer-events-none">Upcoming</Badge>}
                                                            {isCompleted && <Badge variant="outline" className="opacity-50 pointer-events-none">Completed</Badge>}
                                                            {campaign.status === 'paused' && <Badge variant="destructive" className="pointer-events-none">Paused</Badge>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground flex-wrap">
                                                            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-blue-500" /> {campaign.location} {campaign.facebookPlaceId && <Badge variant="outline" className="text-[9px] h-4 py-0 ml-1">FB ID</Badge>}</span>
                                                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-500" /> {startDt.toLocaleDateString()} to {endDt.toLocaleDateString()}</span>
                                                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-orange-500" /> {campaign.audience === 'client' ? 'Client Target' : 'Contractor Target'}</span>
                                                        </div>
                                                        {campaign.hookOverride && (
                                                            <p className="mt-2 text-xs text-muted-foreground border-l-2 border-muted pl-2 italic">
                                                                "{campaign.hookOverride}"
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteCampaign(campaign.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
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

            {lightboxMedia && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setLightboxMedia(null)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setLightboxMedia(null); }}
                    role="dialog"
                    tabIndex={0}
                >
                    <button
                        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/50 rounded-full p-2 z-10"
                        onClick={() => setLightboxMedia(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    {lightboxMedia.type === 'image' ? (
                        <img
                            src={lightboxMedia.url}
                            alt="Zoomed view"
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg cursor-default"
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <video
                            src={lightboxMedia.url}
                            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg cursor-default"
                            controls
                            autoPlay
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
            )}

            {showCampaignModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-background border rounded-xl shadow-lg w-full max-w-lg p-6 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> New Recruitment Drive</h2>
                            <button onClick={() => setShowCampaignModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Launch a targeted time-bound campaign. All AI-generated content within this timeframe will focus strictly on this drive.</p>

                        <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                            <div>
                                <label className="text-sm font-semibold mb-1.5 block">Campaign internal name</label>
                                <input type="text" className="w-full px-3 py-2 text-sm border bg-muted/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Winter Queens Cleaning Partners" value={newCampaign.name || ''} onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold mb-1.5 block">Start Date</label>
                                    <input type="date" className="w-full px-3 py-2 text-sm border bg-muted/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={newCampaign.startDate || ''} onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold mb-1.5 block">End Date</label>
                                    <input type="date" className="w-full px-3 py-2 text-sm border bg-muted/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={newCampaign.endDate || ''} onChange={e => setNewCampaign({ ...newCampaign, endDate: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1.5 block">Target Audience</label>
                                <select className="w-full px-3 py-2 text-sm border bg-muted/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={newCampaign.audience || 'contractor'} onChange={e => setNewCampaign({ ...newCampaign, audience: e.target.value as 'client' | 'contractor' })}>
                                    <option value="contractor">Contractors (Service / Partner Recruitment)</option>
                                    <option value="client">Clients (Buyer Lead Generation)</option>
                                </select>
                            </div>
                            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900 pointer-events-auto">
                                <label className="text-sm font-semibold mb-1.5 block text-blue-900 dark:text-blue-100">Location Tag (Facebook Place)</label>
                                <p className="text-xs text-blue-700/80 dark:text-blue-200/60 mb-2">Crucial for Reels. Search and explicitly select a tracked Facebook location. This fixes metadata tagging failures.</p>
                                <div className="flex gap-2 mb-2">
                                    <input type="text" className="flex-1 px-3 py-2 text-sm border bg-background rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Flushing, NY" value={newCampaign.location || ''} onChange={e => setNewCampaign({ ...newCampaign, location: e.target.value, facebookPlaceId: null })} onKeyDown={(e) => { if (e.key === 'Enter') handleSearchPlaces(newCampaign.location || ''); }} />
                                    <Button variant="secondary" onClick={() => handleSearchPlaces(newCampaign.location || '')} disabled={searchingPlaces} className="bg-white hover:bg-muted dark:bg-muted/50 border shadow-sm">
                                        <Search className="w-4 h-4 mr-1" /> {searchingPlaces ? '...' : 'Search'}
                                    </Button>
                                </div>
                                {placeSearchResults.length > 0 && !newCampaign.facebookPlaceId && (
                                    <div className="border bg-background rounded-md max-h-[150px] overflow-y-auto mb-2 divide-y shadow-inner">
                                        {placeSearchResults.map(place => (
                                            <button key={place.id} className="w-full p-2.5 text-left hover:bg-muted text-sm flex flex-col items-start transition-colors" onClick={() => {
                                                setNewCampaign({
                                                    ...newCampaign,
                                                    location: `${place.name}${place.location?.city ? `, ${place.location.city}` : ''}`,
                                                    facebookPlaceId: place.id,
                                                });
                                                setPlaceSearchResults([]);
                                            }}>
                                                <span className="font-semibold text-blue-700 dark:text-blue-300">{place.name}</span>
                                                {place.location && <span className="text-xs text-muted-foreground mt-0.5"><MapPin className="w-3 h-3 inline mr-0.5 opacity-50" />{[place.location.city, place.location.state].filter(Boolean).join(', ')}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {newCampaign.facebookPlaceId && (
                                    <div className="flex items-center gap-2 p-2.5 mt-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md text-sm font-medium shadow-sm">
                                        <Check className="w-4 h-4" /> Selected: Verified Facebook Place
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-semibold mb-1.5 block">Custom Override Message (Optional)</label>
                                <p className="text-xs text-muted-foreground mb-2">Provide explicit instructions to the AI on the main pain point/pitch to prioritize for this campaign.</p>
                                <textarea className="w-full px-3 py-2 text-sm border bg-muted/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y" placeholder={`e.g. "We are urgently hiring cleaning crews in ${newCampaign.location || 'your area'}! Priority to experienced crews, fast onboarding."`} value={newCampaign.hookOverride || ''} onChange={e => setNewCampaign({ ...newCampaign, hookOverride: e.target.value })} />
                            </div>
                        </div>
                        <div className="pt-4 border-t flex justify-end gap-2 mt-4 shrink-0 bg-background">
                            <Button variant="ghost" onClick={() => setShowCampaignModal(false)}>Cancel</Button>
                            <Button className="bg-blue-600 hover:bg-blue-700 font-semibold" onClick={handleSaveCampaign}>Deploy Campaign</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
