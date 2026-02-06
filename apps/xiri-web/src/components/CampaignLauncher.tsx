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
    const [campaignType, setCampaignType] = useState<"supply" | "urgent">("supply");

    const handleLaunch = async () => {
        if (!query.trim() || !location.trim()) {
            setMessage("Please fill in both fields");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            // Directly call the Cloud Function
            const generateLeads = httpsCallable(functions, 'generateLeads');
            const result = await generateLeads({ 
                query, 
                location, 
                hasActiveContract: campaignType === 'urgent' 
            });
            
            // Result data is in result.data
            const data = result.data as any;
            console.log("Campaign Result:", data);

            setMessage("Campaign launched successfully! Check the vendor list below.");
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
        <Card className="mb-4 shadow-md border-indigo-100 relative overflow-hidden">
            {loading && (
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-100">
                    <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
                </div>
            )}
            
            <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    {/* Inputs Group */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                        <div className="space-y-1">
                            <label htmlFor="query" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Search Query
                            </label>
                            <Input
                                id="query"
                                type="text"
                                placeholder="e.g., HVAC contractors"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="location" className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Location
                            </label>
                            <ReactGoogleAutocomplete
                                apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                onPlaceSelected={(place) => {
                                    setLocation(place.formatted_address || place.name || "");
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

                    {/* Urgency Slider */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg h-9">
                        <button
                            onClick={() => setCampaignType("supply")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                campaignType === "supply" 
                                    ? "bg-white text-indigo-700 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Supply Building
                        </button>
                        <button
                            onClick={() => setCampaignType("urgent")}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                campaignType === "urgent" 
                                    ? "bg-red-50 text-red-700 shadow-sm border border-red-100" 
                                    : "text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Urgent
                        </button>
                    </div>

                    {/* Launch Button */}
                    <Button
                        onClick={handleLaunch}
                        disabled={loading}
                        className="h-9 bg-indigo-600 hover:bg-indigo-700 text-sm px-6 whitespace-nowrap"
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
                    <p className={`text-xs mt-2 ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                        {message}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
