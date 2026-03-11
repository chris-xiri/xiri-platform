import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { getPost, getAllSlugs } from '@/data/blog-posts';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';
import { LeadMagnet } from '@/components/LeadMagnet';
import { SITE } from '@/lib/constants';

type Props = {
    params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
    return getAllSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const post = getPost(slug);
    if (!post) return {};

    return {
        title: post.title,
        description: post.description,
        alternates: {
            canonical: `${SITE.url}/blog/${slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            url: `${SITE.url}/blog/${slug}`,
            siteName: SITE.name,
            type: 'article',
            publishedTime: post.publishDate,
        },
    };
}

export default async function BlogPost({ params }: Props) {
    const { slug } = await params;
    const post = getPost(slug);

    if (!post) notFound();

    // Simple markdown-to-JSX rendering
    const renderContent = (content: string) => {
        const lines = content.trim().split('\n');
        const elements: React.JSX.Element[] = [];
        let i = 0;
        let key = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            // Table detection
            if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|---')) {
                const headers = line.split('|').filter(Boolean).map(h => h.trim());
                const rows: string[][] = [];
                i += 2;
                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()));
                    i++;
                }
                elements.push(
                    <div key={key++} className="overflow-x-auto my-6">
                        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                            <thead className="bg-slate-50">
                                <tr>
                                    {headers.map((h, j) => (
                                        <th key={j} className="px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, j) => (
                                    <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {row.map((cell, k) => (
                                            <td key={k} className="px-4 py-2.5 border-b border-slate-100 text-slate-600"
                                                dangerouslySetInnerHTML={{ __html: cell.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
                                            />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                continue;
            }

            // Headings
            if (line.startsWith('## ')) {
                elements.push(<h2 key={key++} className="text-2xl font-heading font-bold text-slate-900 mt-10 mb-4">{line.slice(3)}</h2>);
                i++;
                continue;
            }

            // Checklist items
            if (line.startsWith('- [ ]')) {
                elements.push(
                    <div key={key++} className="flex items-start gap-2 my-1.5 ml-2">
                        <span className="w-4 h-4 mt-0.5 rounded border border-slate-300 flex-shrink-0" />
                        <span className="text-slate-600">{line.slice(5).trim()}</span>
                    </div>
                );
                i++;
                continue;
            }

            // Bold list items
            if (line.startsWith('- **') || line.startsWith('- ')) {
                elements.push(
                    <li key={key++} className="text-slate-600 ml-4 my-1"
                        dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900">$1</strong>') }}
                    />
                );
                i++;
                continue;
            }

            // Numbered items
            if (/^\d+\.\s/.test(line)) {
                elements.push(
                    <li key={key++} className="text-slate-600 ml-4 my-1.5 list-decimal"
                        dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900">$1</strong>') }}
                    />
                );
                i++;
                continue;
            }

            // CTA link paragraphs
            if (line.startsWith('[**')) {
                const match = line.match(/\[\*\*(.+?)\*\*\]\((.+?)\)/);
                if (match) {
                    elements.push(
                        <p key={key++} className="my-6">
                            <Link href={match[2]} className="inline-flex items-center bg-sky-600 text-white px-6 py-3 rounded-full font-medium hover:bg-sky-700 transition-all">
                                {match[1]}
                            </Link>
                        </p>
                    );
                    i++;
                    continue;
                }
            }

            // Regular paragraph
            if (line.length > 0) {
                elements.push(
                    <p key={key++} className="text-slate-600 leading-relaxed my-4"
                        dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900">$1</strong>').replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-sky-600 hover:underline">$1</a>') }}
                    />
                );
            }
            i++;
        }
        return elements;
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Article Schema — Enhanced with E-E-A-T signals */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Article",
                    "headline": post.title,
                    "description": post.description,
                    "datePublished": post.publishDate,
                    "dateModified": new Date().toISOString().split('T')[0],
                    "wordCount": post.content.split(/\s+/).length,
                    "mainEntityOfPage": {
                        "@type": "WebPage",
                        "@id": `${SITE.url}/blog/${slug}`
                    },
                    "author": {
                        "@type": "Person",
                        "name": "Chris Leung",
                        "jobTitle": "Founder & CEO",
                        "worksFor": { "@type": "Organization", "@id": `${SITE.url}/#organization` },
                        "url": `${SITE.url}/about`
                    },
                    "publisher": {
                        "@type": "Organization",
                        "@id": `${SITE.url}/#organization`,
                        "name": SITE.name,
                        "logo": { "@type": "ImageObject", "url": `${SITE.url}/icon.png` }
                    },
                    "image": `${SITE.url}/og-image.png`
                }}
            />
            {/* BreadcrumbList Schema */}
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE.url },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": `${SITE.url}/blog` },
                        { "@type": "ListItem", "position": 3, "name": post.title, "item": `${SITE.url}/blog/${slug}` },
                    ]
                }}
            />

            <AuthorityBreadcrumb items={[{ label: 'Blog', href: '/blog' }, { label: post.title }]} />

            <article className="pt-32 pb-20">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">{post.category}</span>
                            <span className="text-xs text-slate-400">{post.readTime} read</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 leading-tight mb-4">
                            {post.title}
                        </h1>
                        <p className="text-lg text-slate-500 mb-4">{post.description}</p>
                        {/* Author byline + last updated — E-E-A-T signals */}
                        <div className="flex items-center gap-4 text-sm text-slate-500 border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">CL</div>
                                <div>
                                    <span className="font-medium text-slate-700">Chris Leung</span>
                                    <span className="text-slate-400"> · Founder & CEO</span>
                                </div>
                            </div>
                            <span className="text-slate-300">|</span>
                            <span>Published {new Date(post.publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <span className="text-slate-300">|</span>
                            <span className="text-green-600 font-medium">✓ Last updated March 2026</span>
                        </div>
                    </div>

                    <div className="prose-container">
                        {renderContent(post.content)}
                    </div>

                    {/* Lead Magnet — renders for posts with a leadMagnet config */}
                    {post.leadMagnet && (
                        <LeadMagnet
                            magnetName={post.leadMagnet.magnetName}
                            title={post.leadMagnet.title}
                            description={post.leadMagnet.description}
                            ctaText={post.leadMagnet.ctaText}
                            variant={post.leadMagnet.variant}
                            downloadUrl={post.leadMagnet.downloadUrl}
                        />
                    )}

                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <Link href="/blog" className="text-sm text-sky-600 font-medium hover:underline">
                            ← Back to all articles
                        </Link>
                    </div>
                </div>
            </article>
        </div>
    );
}
