"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";

interface BookCallDialogProps {
    open: boolean;
    onClose: () => void;
    entityId: string;
    entityName: string;
    entityEmail: string;
    entityType: "lead" | "vendor";
    onBooked?: (booking: any) => void;
}

const TIDYCAL_EMBED_URLS: Record<string, string> = {
    vendor: "https://tidycal.com/xiri-facility-solutions/xiri-contractors-30-minutes",
    lead: "https://tidycal.com/xiri-facility-solutions/xiri-leads-30-minutes",
};

export default function BookCallDialog({
    open,
    onClose,
    entityId,
    entityName,
    entityEmail,
    entityType,
}: BookCallDialogProps) {
    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const embedUrl = `${TIDYCAL_EMBED_URLS[entityType] || TIDYCAL_EMBED_URLS.lead}?name=${encodeURIComponent(entityName || '')}&email=${encodeURIComponent(entityEmail || '')}`;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Dialog */}
            <div
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 relative z-10 bg-white">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-sky-600" />
                            {entityType === "vendor" ? "Book Onboarding Call" : "Book Discovery Call"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            with {entityName} • {entityEmail}
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* TidyCal Embed */}
                <div style={{ overflow: 'hidden', marginBottom: '-40px' }}>
                    <iframe
                        src={embedUrl}
                        width="100%"
                        frameBorder="0"
                        title={`Schedule ${entityType === "vendor" ? "Onboarding" : "Discovery"} Call`}
                        style={{ border: "none", height: "calc(88vh - 80px)", minHeight: "600px", marginBottom: "-50px" }}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
}
