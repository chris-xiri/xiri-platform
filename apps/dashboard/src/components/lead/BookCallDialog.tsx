"use client";

import { Calendar, X } from "lucide-react";

interface BookCallDialogProps {
    open: boolean;
    onClose: () => void;
    /** Entity to book for */
    entityId: string;
    entityName: string;
    entityEmail: string;
    /** "lead" or "vendor" */
    entityType: "lead" | "vendor";
    /** Called after successful booking */
    onBooked?: (booking: any) => void;
}

/** TidyCal embed URLs by entity type */
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
    if (!open) return null;

    const embedUrl = `${TIDYCAL_EMBED_URLS[entityType] || TIDYCAL_EMBED_URLS.lead}?name=${encodeURIComponent(entityName || '')}&email=${encodeURIComponent(entityEmail || '')}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            {/* Dialog */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-sky-600" />
                            {entityType === "vendor" ? "Book Onboarding Call" : "Book Discovery Call"}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            with {entityName} • {entityEmail}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* TidyCal Embed — clip bottom to hide branding */}
                <div style={{ overflow: 'hidden', marginBottom: '-40px' }}>
                    <iframe
                        src={embedUrl}
                        width="100%"
                        frameBorder="0"
                        title={`Schedule ${entityType === "vendor" ? "Onboarding" : "Discovery"} Call`}
                        style={{ border: "none", height: "calc(80vh - 80px)", minHeight: "550px", marginBottom: "-50px" }}
                    />
                </div>
            </div>
        </div>
    );
}
