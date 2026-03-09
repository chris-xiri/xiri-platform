import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { getPost, getAllSlugs } from '@/data/blog-posts';
import { AuthorityBreadcrumb } from '@/components/AuthorityBreadcrumb';

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
            canonical: `https://xiri.ai/blog/${slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.description,
            url: `https://xiri.ai/blog/${slug}`,
            siteName: 'XIRI Facility Solutions',
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
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Article",
                    "headline": post.title,
                    "description": post.description,
                    "datePublished": post.publishDate,
                    "author": { "@type": "Organization", "@id": "https://xiri.ai/#organization" },
                    "publisher": { "@type": "Organization", "@id": "https://xiri.ai/#organization" }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://xiri.ai" },
                        { "@type": "ListItem", "position": 2, "name": "Commercial Cleaning Services", "item": "https://xiri.ai/services/commercial-cleaning" },
                        { "@type": "ListItem", "position": 3, "name": "Blog", "item": "https://xiri.ai/blog" },
                        { "@type": "ListItem", "position": 4, "name": post.title, "item": `https://xiri.ai/blog/${slug}` },
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
                            <span className="text-xs text-slate-400">{new Date(post.publishDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-heading font-bold text-slate-900 leading-tight mb-4">
                            {post.title}
                        </h1>
                        <p className="text-lg text-slate-500">{post.description}</p>
                    </div>

                    <div className="prose-container">
                        {renderContent(post.content)}
                    </div>

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
