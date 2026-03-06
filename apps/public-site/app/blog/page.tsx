import { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { getPublishedPosts } from '@/data/blog-posts';

export const metadata: Metadata = {
    title: 'Blog | XIRI Facility Solutions',
    description: 'Facility management guides, cost comparisons, compliance tips, and cleaning best practices from the XIRI team.',
    alternates: {
        canonical: 'https://xiri.ai/blog',
    },
};

export default function BlogIndex() {
    const posts = getPublishedPosts();

    return (
        <div className="min-h-screen bg-white">
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Blog",
                    "name": "XIRI Facility Solutions Blog",
                    "description": "Facility management guides, cost comparisons, compliance tips, and best practices.",
                    "publisher": {
                        "@type": "Organization",
                        "@id": "https://xiri.ai/#organization"
                    }
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://xiri.ai" },
                        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://xiri.ai/blog" },
                    ]
                }}
            />

            {/* Hero */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-sky-50 to-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm font-bold text-sky-600 tracking-widest uppercase mb-3">Blog</p>
                    <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
                        Facility Management Insights
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        Practical guides on cleaning costs, compliance requirements, and building operations.
                    </p>
                </div>
            </section>

            {/* Posts */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="space-y-8">
                        {posts.map(post => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}`}
                                className="group block p-6 rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all"
                            >
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">{post.category}</span>
                                    <span className="text-xs text-slate-400">{post.readTime} read</span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(post.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>
                                <h2 className="text-xl font-heading font-bold text-slate-900 group-hover:text-sky-600 transition-colors mb-2">
                                    {post.title}
                                </h2>
                                <p className="text-slate-600">{post.description}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-16 bg-sky-900 text-white text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <h2 className="text-3xl font-heading font-bold mb-4">Ready to simplify your facility management?</h2>
                    <p className="text-sky-100 text-lg mb-8">
                        Get a free building scope — we&apos;ll walk your facility and build a custom plan.
                    </p>
                    <Link
                        href="/#audit"
                        className="inline-flex items-center bg-white text-sky-900 px-8 py-4 rounded-full text-lg font-medium shadow-lg hover:bg-sky-50 transition-all"
                    >
                        Get Your Building Scope
                    </Link>
                </div>
            </section>
        </div>
    );
}
