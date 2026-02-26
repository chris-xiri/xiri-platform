"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    User, Mail, Lock, Shield, Loader2, Check, AlertTriangle, Key
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    sales: "bg-blue-100 text-blue-800 border-blue-200 dark:border-blue-800",
    sales_exec: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    sales_mgr: "bg-indigo-100 text-indigo-800 border-indigo-200",
    fsm: "bg-green-100 text-green-800 border-green-200",
    night_manager: "bg-purple-100 text-purple-800 dark:text-purple-300 border-purple-200",
    night_mgr: "bg-purple-100 text-purple-800 dark:text-purple-300 border-purple-200",
    recruiter: "bg-amber-100 text-amber-800 border-amber-200",
    accounting: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function ProfilePage() {
    const { user, profile } = useAuth();

    // Display name editing
    const [editingName, setEditingName] = useState(false);
    const [displayName, setDisplayName] = useState(profile?.displayName || "");
    const [savingName, setSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);

    // Password change
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [passwordError, setPasswordError] = useState("");

    const handleSaveName = async () => {
        if (!displayName.trim() || !profile) return;
        setSavingName(true);
        try {
            await updateDoc(doc(db, "users", profile.uid), {
                displayName: displayName.trim(),
                updatedAt: serverTimestamp(),
            });
            // Sync to Firebase Auth
            try {
                const syncAuth = httpsCallable(functions, 'adminUpdateAuthUser');
                await syncAuth({ uid: profile.uid, displayName: displayName.trim() });
            } catch { /* Auth sync is best-effort for non-admins */ }
            setNameSaved(true);
            setEditingName(false);
            setTimeout(() => setNameSaved(false), 2000);
        } catch (err) {
            console.error("Failed to update name:", err);
        } finally {
            setSavingName(false);
        }
    };

    const handleChangePassword = async () => {
        setPasswordError("");
        if (newPassword.length < 6) {
            setPasswordError("Password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("Passwords don't match");
            return;
        }
        setSavingPassword(true);
        try {
            const changePassword = httpsCallable(functions, 'changeMyPassword');
            await changePassword({ newPassword });
            setPasswordSuccess(true);
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setPasswordSuccess(false), 3000);
        } catch (err: any) {
            setPasswordError(err.message || "Failed to change password");
        } finally {
            setSavingPassword(false);
        }
    };

    if (!profile) return null;

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-bold mb-1">My Profile</h2>
                <p className="text-muted-foreground">Manage your account and security settings</p>
            </div>

            {/* Account Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Account Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Display Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                        {editingName ? (
                            <div className="flex gap-2">
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setDisplayName(profile.displayName); setEditingName(false); } }}
                                    autoFocus
                                    className="max-w-xs"
                                />
                                <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setDisplayName(profile.displayName); setEditingName(false); }}>
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <p className="text-sm font-medium">{profile.displayName}</p>
                                {nameSaved ? (
                                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
                                ) : (
                                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingName(true)}>
                                        Edit
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Email (read-only for non-admin) */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm">{profile.email}</p>
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Login credential</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Contact an admin to change your login email</p>
                    </div>

                    {/* Firebase UID */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-muted-foreground">User ID</label>
                        <p className="text-xs font-mono text-muted-foreground select-all">{user?.uid}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Roles */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Roles & Permissions
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {profile.roles.map((role) => (
                            <Badge key={role} variant="outline" className={`text-xs font-medium ${ROLE_COLORS[role] || 'bg-gray-100 dark:bg-gray-800 text-gray-800'}`}>
                                {role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Roles determine what you can access in the dashboard. Contact an admin to request role changes.</p>
                </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Change Password
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">New Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Confirm Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword(); }}
                            />
                        </div>
                    </div>

                    {passwordError && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> {passwordError}
                        </p>
                    )}
                    {passwordSuccess && (
                        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> Password updated successfully!
                        </p>
                    )}

                    <Button
                        onClick={handleChangePassword}
                        disabled={savingPassword || !newPassword || !confirmPassword}
                        className="gap-2"
                    >
                        {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Update Password
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
