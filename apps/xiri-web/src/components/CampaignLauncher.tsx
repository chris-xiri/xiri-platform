"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, Loader2 } from "lucide-react";

export default function CampaignLauncher() {
    const [query, setQuery] = useState("");
    const [location, setLocation] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleLaunch = async () => {
        if (!query.trim() || !location.trim()) {
            setMessage("Please fill in both fields");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/generate-leads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query, location }),
            });

            if (!response.ok) {
                throw new Error("Failed to launch campaign");
            }

            setMessage("Campaign launched successfully! Check the vendor list below.");
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
        <Card className="mb-6 shadow-lg border-indigo-100">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                    <Rocket className="w-5 h-5" />
                    Launch Recruitment Campaign
                </CardTitle>
                <CardDescription>
                    Automated vendor sourcing powered by AI
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label htmlFor="query" className="text-sm font-medium text-gray-700">
                            Search Query
                        </label>
                        <Input
                            id="query"
                            type="text"
                            placeholder="e.g., HVAC contractors"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="location" className="text-sm font-medium text-gray-700">
                            Location
                        </label>
                        <Input
                            id="location"
                            type="text"
                            placeholder="e.g., New York, NY"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <Button
                        onClick={handleLaunch}
                        disabled={loading}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Launching...
                            </>
                        ) : (
                            <>
                                <Rocket className="mr-2 h-4 w-4" />
                                Launch Campaign
                            </>
                        )}
                    </Button>
                    {message && (
                        <p className={`text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
                            {message}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
