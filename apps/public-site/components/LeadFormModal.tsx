"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ClientLeadForm } from "./ClientLeadForm";

interface LeadFormModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeadFormModal({ isOpen, onClose }: LeadFormModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted) return null;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Form Wrapper - Remove redundant shadow since modal has it */}
                <ClientLeadForm
                    className="shadow-none border-none p-6 md:p-8"
                    onStart={onClose} // Optional: close modal immediately on submit (or keep open for check?)
                // Actually, ClientLeadForm redirects. Closing immediately is fine as it navigates away.
                />
            </div>
        </div>
    );
}
