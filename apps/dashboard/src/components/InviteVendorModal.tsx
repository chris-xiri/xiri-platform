import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, Network } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Vendor } from "@xiri/shared";

interface InviteVendorModalProps {
    vendor: Vendor | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function InviteVendorModal({ vendor, open, onOpenChange, onSuccess }: InviteVendorModalProps) {
    const [loading, setLoading] = useState(false);
    const [inviteType, setInviteType] = useState<"URGENT" | "STANDARD">("STANDARD");

    const handleInvite = async () => {
        if (!vendor?.id) return;

        setLoading(true);
        try {
            await updateDoc(doc(db, "vendors", vendor.id), {
                status: "qualified", // Or 'approved' depending on workflow, sticking to shared types
                hasActiveContract: inviteType === "URGENT",
                onboardingTrack: inviteType === "URGENT" ? "FAST_TRACK" : "STANDARD",
                updatedAt: serverTimestamp(),
                outreachStatus: "PENDING" // Trigger the AI agent
            });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Error inviting vendor:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Invite Vendor to Network</DialogTitle>
                    <DialogDescription>
                        Select the engagement track for <span className="font-semibold text-foreground">{vendor?.businessName}</span>.
                        This determines the urgency and onboarding requirements.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup value={inviteType} onValueChange={(v) => setInviteType(v as "URGENT" | "STANDARD")} className="gap-4">
                        <div className={`flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors ${inviteType === "URGENT" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="URGENT" id="urgent" className="mt-1" />
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="urgent" className="font-medium cursor-pointer flex items-center gap-2">
                                    <Briefcase className="h-4 w-4 text-red-500 dark:text-red-400" />
                                    Urgent Contract Coverage
                                    <Badge variant="destructive" className="ml-auto text-xs">Fast Track</Badge>
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Vendor is needed for an active contract. System will send "Job Ready" messaging and require immediate COI/W9 upload.
                                </p>
                            </div>
                        </div>

                        <div className={`flex items-start space-x-3 space-y-0 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors ${inviteType === "STANDARD" ? "border-primary bg-primary/5" : "border-input"}`}>
                            <RadioGroupItem value="STANDARD" id="standard" className="mt-1" />
                            <div className="flex-1 space-y-1">
                                <Label htmlFor="standard" className="font-medium cursor-pointer flex items-center gap-2">
                                    <Network className="h-4 w-4 text-blue-500" />
                                    Standard Network Build
                                    <Badge variant="secondary" className="ml-auto text-xs">Standard</Badge>
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Inviting vendor to join the bench. System will send "Partnership" messaging and request basic self-attestation.
                                </p>
                            </div>
                        </div>
                    </RadioGroup>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={loading} className={inviteType === "URGENT" ? "bg-red-600 hover:bg-red-700" : ""}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {inviteType === "URGENT" ? "Send Urgent Invite" : "Send Standard Invite"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
