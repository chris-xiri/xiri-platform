'use client';

import { Vendor } from '@xiri/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, MapPin, Calendar, DollarSign, Plus } from 'lucide-react';

interface VendorAssignmentsProps {
    vendor: Vendor;
}

export default function VendorAssignments({ vendor }: VendorAssignmentsProps) {
    // Determine active contract status from vendor record or mock data
    // In a real implementation, we would fetch Jobs where vendorId == vendor.id

    // Mock Data for Visualization
    const activeJobs = [
        {
            id: 'job-123',
            clientName: 'Northwell Health',
            location: 'Garden City Urgent Care',
            title: 'Daily Janitorial',
            status: 'active',
            rate: 2400,
            frequency: 'Daily'
        },
        {
            id: 'job-456',
            clientName: 'Audi Lynbrook',
            location: 'Showroom Main',
            title: 'Floor Waxing',
            status: 'scheduled',
            rate: 850,
            frequency: 'One-Time'
        }
    ];

    if (!vendor.hasActiveContract && activeJobs.length === 0) {
        return (
            <div className="py-12 text-center border-dashed border-2 border-muted rounded-lg bg-muted/5">
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-foreground">No Active Assignments</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-4">
                    This vendor has not been assigned to any client locations yet.
                </p>
                <Button>
                    <Plus className="w-4 h-4 mr-2" /> Assign to Job
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Active Assignments</h3>
                <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" /> Assign New Job
                </Button>
            </div>

            <div className="grid gap-4">
                {activeJobs.map(job => (
                    <Card key={job.id} className="overflow-hidden">
                        <div className="flex flex-col md:flex-row border-l-4 border-green-500">
                            <div className="p-4 flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="font-semibold text-lg">{job.clientName}</h4>
                                        <div className="flex items-center text-sm text-muted-foreground gap-1">
                                            <MapPin className="w-3 h-3" /> {job.location}
                                        </div>
                                    </div>
                                    <Badge variant={job.status === 'active' ? 'default' : 'outline'}>
                                        {job.status}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Service</div>
                                        <div className="text-sm font-medium">{job.title}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Frequency</div>
                                        <div className="text-sm font-medium flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-muted-foreground" /> {job.frequency}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Vendor Cost</div>
                                        <div className="text-sm font-medium flex items-center gap-1">
                                            <DollarSign className="w-3 h-3 text-muted-foreground" /> ${job.rate}/mo
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-end">
                                        <Button variant="ghost" size="sm" className="text-primary h-8">View Details</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Performance Rating</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">4.8<span className="text-lg text-muted-foreground font-normal">/5</span></div>
                        <p className="text-xs text-muted-foreground mt-1">Based on 12 post-service inspections</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium uppercase text-muted-foreground">On-Time Arrival</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">98%</div>
                        <p className="text-xs text-muted-foreground mt-1">Last 30 days (GPS Verified)</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
