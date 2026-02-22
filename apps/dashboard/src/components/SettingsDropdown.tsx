"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function SettingsDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const { setTheme, theme } = useTheme();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            >
                <Settings className="w-5 h-5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-card ring-1 ring-border focus:outline-none z-50 border border-border animate-in fade-in zoom-in-95 duration-200">
                    <div className="py-1" role="menu">
                        <div className="px-4 py-2 text-sm text-foreground font-semibold border-b border-border mb-1">
                            Appearance
                        </div>

                        <div className="p-2 space-y-1">
                            <button
                                onClick={() => setTheme("light")}
                                className={`w-full flex items-center px-2 py-2 text-sm rounded-md transition-colors ${theme === 'light' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                <Sun className="mr-3 h-4 w-4" />
                                Light
                            </button>
                            <button
                                onClick={() => setTheme("dark")}
                                className={`w-full flex items-center px-2 py-2 text-sm rounded-md transition-colors ${theme === 'dark' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                <Moon className="mr-3 h-4 w-4" />
                                Dark
                            </button>
                            <button
                                onClick={() => setTheme("system")}
                                className={`w-full flex items-center px-2 py-2 text-sm rounded-md transition-colors ${theme === 'system' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                                <Monitor className="mr-3 h-4 w-4" />
                                System
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
