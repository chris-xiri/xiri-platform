'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, RefreshCw } from 'lucide-react';

interface MonitoringSettings {
    graceMinutes: number;
    noShowMinutes: number;
    lateReminderIntervalMinutes: number;
    escalationReminderIntervalMinutes: number;
    updatedAt?: Date;
}

const DEFAULTS: MonitoringSettings = {
    graceMinutes: 60,
    noShowMinutes: 120,
    lateReminderIntervalMinutes: 15,
    escalationReminderIntervalMinutes: 15,
};

function minutesToLabel(m: number): string {
    if (m >= 60) {
        const h = Math.floor(m / 60);
        const rem = m % 60;
        return rem ? `${h}h ${rem}m` : `${h}h`;
    }
    return `${m}m`;
}

export default function MonitoringSettingsPage() {
    const [settings, setSettings] = useState<MonitoringSettings>(DEFAULTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const snap = await getDoc(doc(db, 'settings', 'monitoring'));
                if (snap.exists()) {
                    const data = snap.data();
                    setSettings({
                        graceMinutes: data.graceMinutes ?? DEFAULTS.graceMinutes,
                        noShowMinutes: data.noShowMinutes ?? DEFAULTS.noShowMinutes,
                        lateReminderIntervalMinutes: data.lateReminderIntervalMinutes ?? DEFAULTS.lateReminderIntervalMinutes,
                        escalationReminderIntervalMinutes: data.escalationReminderIntervalMinutes ?? DEFAULTS.escalationReminderIntervalMinutes,
                        updatedAt: data.updatedAt?.toDate?.() || undefined,
                    });
                }
            } catch (err) {
                console.error('Failed to load monitoring settings:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleSave() {
        setSaving(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'settings', 'monitoring'), {
                graceMinutes: settings.graceMinutes,
                noShowMinutes: settings.noShowMinutes,
                lateReminderIntervalMinutes: settings.lateReminderIntervalMinutes,
                escalationReminderIntervalMinutes: settings.escalationReminderIntervalMinutes,
                updatedAt: new Date(),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Failed to save monitoring settings:', err);
            alert('Failed to save settings. Check console for details.');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading settings...
            </div>
        );
    }

    // Compute reminder schedule for the timeline preview
    const lateReminders: number[] = [];
    for (let t = settings.lateReminderIntervalMinutes; t < settings.graceMinutes; t += settings.lateReminderIntervalMinutes) {
        lateReminders.push(t);
    }
    const escalationReminders: number[] = [];
    for (let t = settings.graceMinutes + settings.escalationReminderIntervalMinutes; t < settings.noShowMinutes; t += settings.escalationReminderIntervalMinutes) {
        escalationReminders.push(t);
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings className="w-6 h-6" />
                    Monitoring Settings
                </h1>
                <p className="text-muted-foreground mt-1">
                    Configure global thresholds for the nightly compliance monitoring system.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Alert Thresholds</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Grace Period */}
                    <div className="space-y-2">
                        <Label htmlFor="graceMinutes" className="text-sm font-medium">
                            ⏱️ Grace Period
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Minutes after scheduled start before a <strong>Late Warning</strong> card is sent. Tags NM + FSM.
                        </p>
                        <div className="flex items-center gap-3">
                            <Input id="graceMinutes" type="number" min={5} max={360}
                                value={settings.graceMinutes}
                                onChange={(e) => setSettings(prev => ({ ...prev, graceMinutes: parseInt(e.target.value) || 0 }))}
                                className="w-32" />
                            <span className="text-sm text-muted-foreground">minutes = {minutesToLabel(settings.graceMinutes)}</span>
                        </div>
                    </div>

                    {/* Late Reminder Interval */}
                    <div className="space-y-2 ml-6 border-l-2 border-amber-300 pl-4">
                        <Label htmlFor="lateReminderInterval" className="text-sm font-medium">
                            🔔 Late Reminders (during grace period)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Send a &quot;crew is late&quot; reminder every X minutes <em>before</em> the Late Warning fires.
                        </p>
                        <div className="flex items-center gap-3">
                            <Input id="lateReminderInterval" type="number" min={5} max={120}
                                value={settings.lateReminderIntervalMinutes}
                                onChange={(e) => setSettings(prev => ({ ...prev, lateReminderIntervalMinutes: parseInt(e.target.value) || 15 }))}
                                className="w-32" />
                            <span className="text-sm text-muted-foreground">
                                minutes → {lateReminders.length > 0
                                    ? `${lateReminders.length} reminder${lateReminders.length > 1 ? 's' : ''} at ${lateReminders.map(minutesToLabel).join(', ')}`
                                    : 'no reminders (interval ≥ grace period)'}
                            </span>
                        </div>
                    </div>

                    {/* No-Show Threshold */}
                    <div className="space-y-2">
                        <Label htmlFor="noShowMinutes" className="text-sm font-medium">
                            🔴 No-Show Threshold
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Minutes after scheduled start before a <strong>No-Show</strong> is declared. Red alert card sent, tags NM + FSM.
                        </p>
                        <div className="flex items-center gap-3">
                            <Input id="noShowMinutes" type="number" min={15} max={720}
                                value={settings.noShowMinutes}
                                onChange={(e) => setSettings(prev => ({ ...prev, noShowMinutes: parseInt(e.target.value) || 0 }))}
                                className="w-32" />
                            <span className="text-sm text-muted-foreground">minutes = {minutesToLabel(settings.noShowMinutes)}</span>
                        </div>
                    </div>

                    {/* Escalation Reminder Interval */}
                    <div className="space-y-2 ml-6 border-l-2 border-red-300 pl-4">
                        <Label htmlFor="escalationReminderInterval" className="text-sm font-medium">
                            🚨 Escalation Reminders (between grace &amp; no-show)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Send &quot;prepare backup vendor&quot; reminders every X minutes after the Late Warning and before the No-Show declaration.
                        </p>
                        <div className="flex items-center gap-3">
                            <Input id="escalationReminderInterval" type="number" min={5} max={120}
                                value={settings.escalationReminderIntervalMinutes}
                                onChange={(e) => setSettings(prev => ({ ...prev, escalationReminderIntervalMinutes: parseInt(e.target.value) || 15 }))}
                                className="w-32" />
                            <span className="text-sm text-muted-foreground">
                                minutes → {escalationReminders.length > 0
                                    ? `${escalationReminders.length} reminder${escalationReminders.length > 1 ? 's' : ''} at ${escalationReminders.map(minutesToLabel).join(', ')}`
                                    : 'no reminders'}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline Preview */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Timeline Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative space-y-0 text-sm">
                        <div className="flex items-center gap-3 py-2">
                            <span className="w-16 text-right font-mono text-xs text-muted-foreground">+0m</span>
                            <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                            <span>Scheduled start time</span>
                        </div>
                        {lateReminders.map((t) => (
                            <div key={`late-${t}`} className="flex items-center gap-3 py-1.5">
                                <span className="w-16 text-right font-mono text-xs text-muted-foreground">+{minutesToLabel(t)}</span>
                                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                                <span className="text-muted-foreground">🔔 Late reminder → NM + FSM</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 py-2">
                            <span className="w-16 text-right font-mono text-xs text-muted-foreground">+{minutesToLabel(settings.graceMinutes)}</span>
                            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                            <span className="font-medium">⚠️ Late Warning card → NM + FSM</span>
                        </div>
                        {escalationReminders.map((t) => (
                            <div key={`esc-${t}`} className="flex items-center gap-3 py-1.5">
                                <span className="w-16 text-right font-mono text-xs text-muted-foreground">+{minutesToLabel(t)}</span>
                                <span className="w-3 h-3 rounded-full bg-orange-400 shrink-0" />
                                <span className="text-muted-foreground">🚨 Escalation reminder → FSM: prepare backup</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 py-2">
                            <span className="w-16 text-right font-mono text-xs text-muted-foreground">+{minutesToLabel(settings.noShowMinutes)}</span>
                            <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                            <span className="font-medium">🔴 No-Show declared → NM + FSM</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving} size="lg">
                    {saving ? (
                        <><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save Settings</>
                    )}
                </Button>
                {saved && <span className="text-sm text-green-600 font-medium">✅ Saved!</span>}
            </div>

            {settings.updatedAt && (
                <p className="text-xs text-muted-foreground">
                    Last updated: {settings.updatedAt.toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                </p>
            )}
        </div>
    );
}
