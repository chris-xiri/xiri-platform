'use client';

import { useState } from 'react';
import { Location } from './types';
import { quoteLogger } from './logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import GooglePlacesAutocomplete from 'react-google-places-autocomplete';

interface StepLocationsProps {
    locations: Location[];
    onAddLocation: (loc: Location) => void;
    onRemoveLocation: (id: string) => void;
    selectedLeadName?: string;
}

export default function StepLocations({
    locations, onAddLocation, onRemoveLocation, selectedLeadName,
}: StepLocationsProps) {
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationAddress, setNewLocationAddress] = useState<any>(null);
    const [newLocationCity, setNewLocationCity] = useState('');
    const [newLocationState, setNewLocationState] = useState('');
    const [newLocationZip, setNewLocationZip] = useState('');

    const handleAddressSelect = (selected: any) => {
        setNewLocationAddress(selected);

        if (selected?.value?.place_id) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ placeId: selected.value.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const components = results[0].address_components;
                    components.forEach((component: any) => {
                        if (component.types.includes('locality')) {
                            setNewLocationCity(component.long_name);
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                            setNewLocationState(component.short_name);
                        }
                        if (component.types.includes('postal_code')) {
                            setNewLocationZip(component.long_name);
                        }
                    });

                    if (!newLocationName && results[0].formatted_address) {
                        const namePart = results[0].formatted_address.split(',')[0];
                        setNewLocationName(namePart);
                    }
                }
            });
        }
    };

    const addLocation = () => {
        if (!newLocationName || !newLocationAddress || !newLocationZip) return;
        const loc: Location = {
            id: `loc_${Date.now()}`,
            name: newLocationName,
            address: newLocationAddress.label || '',
            city: newLocationCity,
            state: newLocationState,
            zip: newLocationZip,
        };
        onAddLocation(loc);
        quoteLogger.locationAdded(loc.id, loc.name);
        // Reset form
        setNewLocationName('');
        setNewLocationAddress(null);
        setNewLocationCity('');
        setNewLocationState('');
        setNewLocationZip('');
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
                Add all service locations for <span className="font-medium text-foreground">{selectedLeadName}</span>.
            </p>

            {/* Existing Locations */}
            {locations.map((loc) => (
                <Card key={loc.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">{loc.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {loc.address}{loc.city ? `, ${loc.city}` : ''}{loc.state ? `, ${loc.state}` : ''} {loc.zip}
                                </p>
                                {loc.id.startsWith('loc_') && parseInt(loc.id.split('_')[1]) < 100 && (
                                    <p className="text-[10px] text-primary/70">📍 Pre-filled from {selectedLeadName}</p>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => {
                            onRemoveLocation(loc.id);
                            quoteLogger.locationRemoved(loc.id);
                        }}>
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                    </CardContent>
                </Card>
            ))}

            <Separator />

            {/* Add New Location */}
            <Card className="border-dashed">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Add Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <Label className="text-xs">Location Name</Label>
                        <Input
                            placeholder="e.g. Main Office, Suite 200"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Address</Label>
                        <GooglePlacesAutocomplete
                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                            autocompletionRequest={{
                                componentRestrictions: { country: ['us'] },
                            }}
                            selectProps={{
                                value: newLocationAddress,
                                onChange: handleAddressSelect,
                                placeholder: "Start typing address...",
                                className: "react-select-container",
                                classNamePrefix: "react-select",
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label className="text-xs">City</Label>
                            <Input placeholder="City" value={newLocationCity} onChange={(e) => setNewLocationCity(e.target.value)} />
                        </div>
                        <div>
                            <Label className="text-xs">State</Label>
                            <Input placeholder="NY" value={newLocationState} onChange={(e) => setNewLocationState(e.target.value)} maxLength={2} />
                        </div>
                        <div>
                            <Label className="text-xs">Zip <span className="text-red-500">*</span></Label>
                            <Input placeholder="11021" value={newLocationZip} onChange={(e) => setNewLocationZip(e.target.value)} maxLength={5} />
                        </div>
                    </div>
                    <Button
                        onClick={addLocation}
                        variant="outline"
                        className="gap-2"
                        disabled={!newLocationName || !newLocationAddress || !newLocationZip}
                    >
                        <Plus className="w-4 h-4" /> Add Location
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
