'use client';

import { useEffect, useRef, useState } from 'react';

interface AddressAutocompleteInputProps {
    id?: string;
    name?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
    ariaInvalid?: boolean;
}

interface PlaceSuggestionItem {
    id: string;
    text: string;
    mainText?: string;
    secondaryText?: string;
}

let mapsBootstrapPromise: Promise<any> | null = null;

function loadGooglePlacesLibrary(apiKey: string): Promise<any> {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }

    const existingGoogle = (window as any).google;
    if (existingGoogle?.maps?.importLibrary) {
        return existingGoogle.maps.importLibrary('places');
    }

    if (mapsBootstrapPromise) {
        return mapsBootstrapPromise;
    }

    mapsBootstrapPromise = new Promise((resolve, reject) => {
        const scriptId = 'xiri-google-maps-js';
        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

        const finish = async () => {
            try {
                const g = (window as any).google;
                if (g?.maps?.importLibrary) {
                    const placesLib = await g.maps.importLibrary('places');
                    resolve(placesLib);
                } else {
                    resolve(null);
                }
            } catch (err) {
                reject(err);
            }
        };

        if (existingScript) {
            if ((window as any).google?.maps?.importLibrary) {
                void finish();
                return;
            }
            existingScript.addEventListener('load', () => void finish(), { once: true });
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => void finish();
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });

    return mapsBootstrapPromise;
}

export default function AddressAutocompleteInput({
    id,
    name,
    value,
    onChange,
    placeholder = 'Building street address, city, NY',
    required = false,
    className = '',
    ariaInvalid = false,
}: AddressAutocompleteInputProps) {
    const [suggestions, setSuggestions] = useState<PlaceSuggestionItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const placesLibRef = useRef<any>(null);
    const sessionTokenRef = useRef<any>(null);
    const fetchIdRef = useRef(0);
    const suppressNextFetchRef = useRef(false);

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // Load modern Google Places library asynchronously (loading=async, AutocompleteSuggestion)
    useEffect(() => {
        if (!apiKey) return;
        let cancelled = false;

        loadGooglePlacesLibrary(apiKey)
            .then((lib) => {
                if (cancelled || !lib) return;
                placesLibRef.current = lib;
                if (lib.AutocompleteSessionToken) {
                    sessionTokenRef.current = new lib.AutocompleteSessionToken();
                }
            })
            .catch(() => {
                // Gracefully degrade to manual text entry
            });

        return () => {
            cancelled = true;
        };
    }, [apiKey]);

    // Close suggestions on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch suggestions using Places API (New) AutocompleteSuggestion
    useEffect(() => {
        if (suppressNextFetchRef.current) {
            suppressNextFetchRef.current = false;
            return;
        }

        const trimmed = value.trim();
        if (trimmed.length < 3 || !placesLibRef.current?.AutocompleteSuggestion) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        const currentFetchId = ++fetchIdRef.current;
        const timer = setTimeout(async () => {
            try {
                const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLibRef.current;
                if (!sessionTokenRef.current && AutocompleteSessionToken) {
                    sessionTokenRef.current = new AutocompleteSessionToken();
                }

                const request: Record<string, any> = {
                    input: trimmed,
                    includedRegionCodes: ['us'],
                };
                if (sessionTokenRef.current) {
                    request.sessionToken = sessionTokenRef.current;
                }

                const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
                if (currentFetchId !== fetchIdRef.current) return;

                const nextItems: PlaceSuggestionItem[] = (response?.suggestions || [])
                    .map((item: any, idx: number) => {
                        const prediction = item?.placePrediction;
                        const fullText = prediction?.text?.text || prediction?.text?.toString?.() || '';
                        if (!fullText) return null;
                        return {
                            id: prediction?.placeId || `${idx}-${fullText}`,
                            text: fullText,
                            mainText: prediction?.mainText?.text || undefined,
                            secondaryText: prediction?.secondaryText?.text || undefined,
                        };
                    })
                    .filter(Boolean) as PlaceSuggestionItem[];

                setSuggestions(nextItems);
                setHighlightedIndex(-1);
                setIsOpen(nextItems.length > 0);
            } catch {
                // Silent fallback: user can always type address manually
                if (currentFetchId === fetchIdRef.current) {
                    setSuggestions([]);
                    setIsOpen(false);
                }
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [value]);

    const handleSelect = (item: PlaceSuggestionItem) => {
        suppressNextFetchRef.current = true;
        onChange(item.text);
        setSuggestions([]);
        setIsOpen(false);
        setHighlightedIndex(-1);

        // Rotate session token after a selection
        if (placesLibRef.current?.AutocompleteSessionToken) {
            sessionTokenRef.current = new placesLibRef.current.AutocompleteSessionToken();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                type="text"
                id={id}
                name={name}
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => {
                    if (suggestions.length > 0) setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoComplete="street-address"
                aria-invalid={ariaInvalid}
                aria-autocomplete="list"
                aria-expanded={isOpen}
                className={className}
            />

            {isOpen && suggestions.length > 0 && (
                <ul
                    role="listbox"
                    className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-60 overflow-auto py-1"
                >
                    {suggestions.map((item, idx) => (
                        <li
                            key={item.id}
                            role="option"
                            aria-selected={idx === highlightedIndex}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(item);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                idx === highlightedIndex
                                    ? 'bg-emerald-50 text-emerald-900'
                                    : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {item.mainText ? (
                                <div>
                                    <span className="font-medium text-slate-900">{item.mainText}</span>
                                    {item.secondaryText && (
                                        <span className="text-slate-500 text-xs block">{item.secondaryText}</span>
                                    )}
                                </div>
                            ) : (
                                item.text
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
