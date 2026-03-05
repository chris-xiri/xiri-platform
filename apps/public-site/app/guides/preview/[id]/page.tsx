import { notFound } from 'next/navigation';
import { Hero } from '@/components/Hero';
import { CTAButton } from '@/components/CTAButton';
import { CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface GuideData {
    title: string;
    heroTitle: string;
    heroSubtitle: string;
    metaTitle: string;
    metaDescription: string;
    sections: { title: string; content: string; items?: string[] }[];
    calloutTitle?: string;
    calloutContent?: string;
    faqs: { question: string; answer: string }[];
    status: string;
}

type Props = {
    params: Promise<{ id: string }>;
};

export default async function GuidePreviewPage({ params }: Props) {
    const { id } = await params;

    // Fetch guide from Firestore
    const docRef = doc(db, 'guides', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        notFound();
    }

    const guide = docSnap.data() as GuideData;

    return (
        <div className="min-h-screen bg-white">
            {/* Draft Banner */}
            <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 text-center">
                <p className="text-amber-800 font-medium text-sm">
                    ⚠️ DRAFT PREVIEW — This guide is not published yet.
                    {guide.status === 'published' && (
                        <span className="text-green-700 ml-2">✅ This guide is now published.</span>
                    )}
                </p>
            </div>

            {/* Hero */}
            <Hero
                title={guide.heroTitle}
                subtitle={guide.heroSubtitle}
                ctaText="Get a Free Site Audit"
            />

            {/* Guide Content */}
            <article className="py-16 bg-white">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    {guide.sections.map((section, i) => (
                        <div key={i} className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">{section.title}</h2>
                            <p className="text-lg text-slate-600 mb-4 leading-relaxed">{section.content}</p>
                            {section.items && (
                                <ul className="space-y-3 mt-4">
                                    {section.items.map((item, j) => (
                                        <li key={j} className="flex gap-3 items-start">
                                            <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </article>

            {/* XIRI Callout */}
            {guide.calloutTitle && (
                <section className="py-12 bg-sky-50 border-y border-sky-200">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex gap-5 items-start">
                            <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-full flex items-center justify-center text-sky-700">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sky-900 text-lg mb-2">{guide.calloutTitle}</h3>
                                <p className="text-sky-800">{guide.calloutContent}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* FAQs */}
            {guide.faqs && guide.faqs.length > 0 && (
                <section className="py-16 bg-slate-50">
                    <div className="max-w-3xl mx-auto px-4">
                        <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">
                            Frequently Asked Questions
                        </h2>
                        <div className="space-y-4">
                            {guide.faqs.map((faq, i) => (
                                <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                                    <h3 className="font-bold text-slate-900 mb-2">{faq.question}</h3>
                                    <p className="text-slate-600">{faq.answer}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Final CTA */}
            <section className="py-16 bg-slate-900 text-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">Want Expert Help?</h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Book a free site audit. We&apos;ll assess your facility, build a custom cleaning scope, and provide transparent pricing — no obligation.
                    </p>
                    <CTAButton
                        href="/#audit"
                        text="Get Your Free Site Audit"
                        className="inline-block bg-sky-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-sky-400 transition-colors"
                    />
                </div>
            </section>
        </div>
    );
}
