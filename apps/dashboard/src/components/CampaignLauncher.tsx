"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, Loader2 } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

import ReactGoogleAutocomplete from "react-google-autocomplete";

export default function CampaignLauncher() {
    const [query, setQuery] = useState("");
    const [location, setLocation] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    // const [campaignType, setCampaignType] = useState<"supply" | "urgent">("supply"); // Removed

    const handleLaunch = async () => {
        if (!query.trim() || !location.trim()) {
            setMessage("Please fill in both fields");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            // Directly call the Cloud Function with 60s timeout
            // Directly call the Cloud Function with 60s timeout
            // Note: The function name 'generateLeads' must match exactly what is exported in packages/functions/src/index.ts
            const generateLeads = httpsCallable(functions, 'generateLeads', { timeout: 60000 });

            const result = await generateLeads({
                query,
                location,
                hasActiveContract: false // Default to standard building mode
            });

            // Result data is in result.data
            const data = result.data as any;
            console.log("Campaign Result:", data);

            if (data.analysis && data.analysis.errors && data.analysis.errors.length > 0) {
                console.error("Backend Analysis Errors:", data.analysis.errors);
            }

            setMessage(`Campaign completed. Found ${data.sourced} vendors. Qualified ${data.analysis?.qualified || 0}.`);
            setQuery("");
            setLocation("");
            // Reset autocomplete input value if possible, tough with Uncontrolled component pattern.
            // We'll rely on key change or simple reset if needed, but for now state reset works for logic.
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
                                        setLocation(place.formatted_address || place.name);
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

                    {/* Urgency Slider Removed as per user request */}

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
                    <p className={`text-xs mt-2 ${message.includes("Error") ? "text-red-500" : "text-green-500"}`}>
                        {message}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
