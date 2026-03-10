// ─── Citation ────────────────────────────────────────────────────
// Renders a subtle, footnote-style citation linking to the data source.
// Used alongside Census/BLS statistics to provide E-E-A-T credibility.

interface CitationProps {
    source: string;
    dataset?: string;
    year?: number;
    url?: string;
    className?: string;
}

export function Citation({ source, dataset, year, url, className = '' }: CitationProps) {
    const label = [source, dataset, year ? `(${year})` : ''].filter(Boolean).join(', ');

    return (
        <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
            <span className="select-none">—</span>
            {url ? (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-sky-500 underline decoration-dotted underline-offset-2 transition-colors"
                >
                    {label}
                </a>
            ) : (
                <span>{label}</span>
            )}
        </span>
    );
}
