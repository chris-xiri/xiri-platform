'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/tracking';

interface CTAButtonProps {
    href: string;
    text: string;
    className?: string;
    location?: string; // Optional context for the click
}

export function CTAButton({ href, text, className, location }: CTAButtonProps) {
    const handleClick = () => {
        trackEvent('click_cta', {
            destination: href,
            text: text,
            location_context: location || 'global',
        });
    };

    return (
        <Link
            href={href}
            onClick={handleClick}
            className={className || "inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"}
        >
            {text}
        </Link>
    );
}
