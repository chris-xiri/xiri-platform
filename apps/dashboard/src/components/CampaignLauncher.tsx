"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, Loader2, Database, MapPin } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Vendor } from "@xiri/shared";

import ReactGoogleAutocomplete from "react-google-autocomplete";

interface CampaignLauncherProps {
    onResults?: (vendors: Vendor[], meta: { query: string; location: string; sourced: number; qualified: number }) => void;
}

export default function CampaignLauncher({ onResults }: CampaignLauncherProps) {
    const [query, setQuery] = useState("");
    const [location, setLocation] = useState("");
    const [provider, setProvider] = useState<'google_maps' | 'nyc_open_data' | 'all'>('google_maps');
    const [dcaCategory, setDcaCategory] = useState<string>('');
    const [dcaCategories, setDcaCategories] = useState<{ name: string; count: number }[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Fetch DCA categories when NYC Open Data is selected
    useEffect(() => {
        if ((provider === 'nyc_open_data' || provider === 'all') && dcaCategories.length === 0) {
            setLoadingCategories(true);
            const url = new URL('https://data.cityofnewyork.us/resource/w7w3-xahh.json');
            url.searchParams.set('$select', 'business_category, count(*) as cnt');
            url.searchParams.set('$group', 'business_category');
            url.searchParams.set('$order', 'cnt DESC');
            url.searchParams.set('$limit', '100');
            url.searchParams.set('$where', "license_status='Active'");
            fetch(url.toString())
                .then(r => r.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setDcaCategories(data.map((d: any) => ({ name: d.business_category, count: parseInt(d.cnt) })));
                    }
                })
                .catch(err => console.error('Failed to fetch DCA categories:', err))
                .finally(() => setLoadingCategories(false));
        }
    }, [provider]);

    const handleLaunch = async () => {
        const needsQuery = provider === 'google_maps'; // SODA can search by category alone
        if ((needsQuery && !query.trim()) || !location.trim()) {
            setMessage(needsQuery ? 'Please fill in both fields' : 'Please enter a location');
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const generateLeads = httpsCallable(functions, 'generateLeads', { timeout: 60000 });

            const result = await generateLeads({
                query: query || undefined,
                location,
                hasActiveContract: false,
                previewOnly: true,
                provider,
                dcaCategory: dcaCategory || undefined,
            });

            const data = result.data as any;
            console.log("Campaign Result:", data);

            if (data.analysis && data.analysis.errors && data.analysis.errors.length > 0) {
                console.error("Backend Analysis Errors:", data.analysis.errors);
            }

            const vendors: Vendor[] = data.vendors || [];
            const sourced = data.sourced || 0;
            const qualified = data.analysis?.qualified || 0;

            if (onResults && vendors.length > 0) {
                onResults(vendors, { query, location, sourced, qualified });
            }

            setMessage(`Campaign completed. Found ${sourced} vendors. Qualified ${qualified}.`);
            setQuery("");
            setLocation("");
        } catch (error: any) {
            console.error("Error launching campaign:", error);
            setMessage(`Error: ${error.message || "Failed to launch campaign"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="mb-4 shadow-md border-border relative overflow-hidden bg-card text-card-foreground">
            {loading && (
                <div className="absolute top-0 left-0 w-full h-1 bg-muted">
                    <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
                </div>
            )}

            <CardContent className="p-3">
                <div className="flex flex-col md:flex-row gap-3 items-end">
                    {/* Inputs Group */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                        <div className="space-y-2">
                            <label htmlFor="query" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Search Query
                            </label>
                            <Input
                                id="query"
                                type="text"
                                placeholder="e.g., HVAC contractors"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-9 text-sm bg-background"
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="location" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Location
                            </label>
                            <ReactGoogleAutocomplete
                                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                onPlaceSelected={(place) => {
                                    if (place && (place.formatted_address || place.name)) {
                                        setLocation(place.formatted_address || place.name || '');
                                    } else {
                                        console.warn("Invalid place selected:", place);
                                    }
                                }}
                                options={{
                                    types: ["geocode"],
                                    componentRestrictions: { country: "us" },
                                }}
                                placeholder="e.g., 11040 or New York, NY"
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={(e: any) => setLocation(e.target.value)}
                                value={location}
                            />
                        </div>
                    </div>

                    {/* Source Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Source
                        </label>
                        <select
                            value={provider}
                            onChange={(e) => { setProvider(e.target.value as any); setDcaCategory(''); }}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="google_maps">🗺️ Google Maps</option>
                            <option value="nyc_open_data">🏛️ NYC Open Data</option>
                            <option value="all">🔄 All Sources</option>
                        </select>
                    </div>

                    {/* DCA Category Dropdown — only shown for NYC Open Data */}
                    {(provider === 'nyc_open_data' || provider === 'all') && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                DCA Category
                            </label>
                            <select
                                value={dcaCategory}
                                onChange={(e) => setDcaCategory(e.target.value)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                disabled={loadingCategories}
                            >
                                <option value="">{loadingCategories ? 'Loading...' : 'All Categories'}</option>
                                {dcaCategories.map(c => (
                                    <option key={c.name} value={c.name}>
                                        {c.name} ({c.count.toLocaleString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Launch Button */}
                    <Button
                        onClick={handleLaunch}
                        disabled={loading}
                        className="h-9 text-sm px-6 whitespace-nowrap transition-colors bg-primary hover:bg-primary/90 focus:ring-ring"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Rocket className="mr-2 h-3.5 w-3.5" />
                                Launch
                            </>
                        )}
                    </Button>
                </div>

                {message && (
                    <p className={`text-xs mt-2 ${message.includes("Error") ? "text-red-500 dark:text-red-400" : "text-green-500"}`}>
                        {message}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

