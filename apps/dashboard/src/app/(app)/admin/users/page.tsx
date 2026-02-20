"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Loader2, Users, Plus, Pencil, Trash2, X, Save, Shield, ShoppingCart,
    Briefcase, Moon, UserCheck
} from "lucide-react";

interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    roles: string[];
    createdAt: unknown;
    updatedAt: unknown;
    lastLogin: unknown;
}

const ALL_ROLES = [
    { value: "admin", label: "Admin", icon: Shield, color: "bg-red-100 text-red-800" },
    { value: "sales", label: "Sales", icon: ShoppingCart, color: "bg-blue-100 text-blue-800" },
    { value: "fsm", label: "FSM", icon: Briefcase, color: "bg-green-100 text-green-800" },
    { value: "night_manager", label: "Night Manager", icon: Moon, color: "bg-purple-100 text-purple-800" },
    { value: "recruiter", label: "Recruiter", icon: UserCheck, color: "bg-amber-100 text-amber-800" },
];

function getRoleBadge(role: string) {
    const config = ALL_ROLES.find(r => r.value === role);
    return config || { value: role, label: role, color: "bg-gray-100 text-gray-800" };
}

// ─── Empty State Form ─────────────────────────────────────────────────────────

function UserForm({
    initialData,
    onSave,
    onCancel,
    saving,
}: {
    initialData?: Partial<UserProfile>;
    onSave: (data: { email: string; displayName: string; roles: string[] }) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [email, setEmail] = useState(initialData?.email || "");
    const [displayName, setDisplayName] = useState(initialData?.displayName || "");
    const [roles, setRoles] = useState<string[]>(initialData?.roles || []);

    const toggleRole = (role: string) => {
        setRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
    };

    return (
        <Card className="border-primary">
            <CardHeader>
                <CardTitle className="text-lg">{initialData?.uid ? "Edit User" : "Add User"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Display Name</label>
                        <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Full Name"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">Email</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@xiri.ai"
                            disabled={!!initialData?.uid}
                        />
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium mb-2 block">Roles</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map(role => {
                            const isSelected = roles.includes(role.value);
                            return (
                                <button
                                    key={role.value}
                                    type="button"
                                    onClick={() => toggleRole(role.value)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isSelected
                                        ? `${role.color} border-current ring-1 ring-current/20`
                                        : "bg-muted text-muted-foreground border-transparent hover:border-border"
                                        }`}
                                >
                                    <role.icon className="w-3 h-3" />
                                    {role.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-2 pt-2">
                    <Button
                        onClick={() => onSave({ email, displayName, roles })}
                        disabled={!email || !displayName || roles.length === 0 || saving}
                        className="gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {initialData?.uid ? "Update User" : "Create User"}
                    </Button>
                    <Button onClick={onCancel} variant="outline" className="gap-2">
                        <X className="w-4 h-4" /> Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UserManagerPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [deletingUid, setDeletingUid] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const snap = await getDocs(collection(db, "users"));
            const data = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
            data.sort((a, b) => a.displayName.localeCompare(b.displayName));
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleSave = async (data: { email: string; displayName: string; roles: string[] }) => {
        setSaving(true);
        try {
            if (editingUser) {
                // Update existing user profile
                await updateDoc(doc(db, "users", editingUser.uid), {
                    displayName: data.displayName,
                    roles: data.roles,
                    updatedAt: serverTimestamp(),
                });
            } else {
                // Create new user profile in Firestore
                // Note: This writes the Firestore profile only. Auth user creation
                // is handled via the seed script or Firebase Console.
                const newUid = `manual-${Date.now()}`;
                await setDoc(doc(db, "users", newUid), {
                    uid: newUid,
                    email: data.email,
                    displayName: data.displayName,
                    roles: data.roles,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    lastLogin: null,
                });
            }
            await fetchUsers();
            setShowForm(false);
            setEditingUser(null);
        } catch (error) {
            console.error("Error saving user:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (uid: string) => {
        setDeletingUid(uid);
        try {
            await deleteDoc(doc(db, "users", uid));
            await fetchUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
        } finally {
            setDeletingUid(null);
        }
    };

    const handleEdit = (user: UserProfile) => {
        setEditingUser(user);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingUser(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <ProtectedRoute resource="admin/users">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">User Manager</h2>
                        <p className="text-muted-foreground">Manage team members and their roles</p>
                    </div>
                    {!showForm && (
                        <Button onClick={() => setShowForm(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> Add User
                        </Button>
                    )}
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <UserForm
                        initialData={editingUser || undefined}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        saving={saving}
                    />
                )}

                {/* User List */}
                <div className="grid gap-3">
                    {users.map(user => (
                        <Card key={user.uid}>
                            <CardContent className="py-4 px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-sm font-bold text-primary">
                                                {user.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-semibold">{user.displayName}</p>
                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1.5">
                                            {user.roles?.map(role => {
                                                const config = getRoleBadge(role);
                                                return (
                                                    <Badge key={role} variant="secondary" className={`${config.color} text-xs`}>
                                                        {config.label}
                                                    </Badge>
                                                );
                                            })}
                                        </div>

                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(user)}
                                                className="h-8 w-8"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(user.uid)}
                                                disabled={deletingUid === user.uid}
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                                {deletingUid === user.uid
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Trash2 className="w-4 h-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}

                    {users.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p className="font-medium">No users found</p>
                                <p className="text-sm">Click &quot;Add User&quot; to create a team member.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
