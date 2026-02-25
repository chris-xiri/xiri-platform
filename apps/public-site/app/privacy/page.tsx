import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'XIRI Facility Solutions privacy policy — how we collect, use, and protect your information.',
    alternates: {
        canonical: 'https://xiri.ai/privacy',
    },
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h1 className="text-3xl font-bold font-heading text-gray-900 mb-2">Privacy Policy</h1>
                <p className="text-sm text-gray-500 mb-10">Last updated: February 20, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-[15px] leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mt-0">1. Introduction</h2>
                        <p>
                            XIRI Facility Solutions (&quot;XIRI,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to
                            protecting the personal information you share with us. This Privacy Policy explains how we
                            collect, use, disclose, and safeguard your information when you visit our website at{' '}
                            <a href="https://xiri.ai" className="text-sky-600 hover:underline">xiri.ai</a> or use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">2. Information We Collect</h2>
                        <p>We collect information in the following ways:</p>
                        <h3 className="text-lg font-semibold text-gray-900 mt-4">Information You Provide</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Business name, contact name, email address, and phone number (via lead forms and audit requests)</li>
                            <li>Facility address, type, and square footage</li>
                            <li>Service preferences and scheduling information</li>
                            <li>Contractor application information (business details, insurance, qualifications)</li>
                        </ul>
                        <h3 className="text-lg font-semibold text-gray-900 mt-4">Information Collected Automatically</h3>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>IP address, browser type, and device information</li>
                            <li>Pages visited, time spent, and referring URLs</li>
                            <li>Cookies and similar tracking technologies (see Section 5)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">3. How We Use Your Information</h2>
                        <p>We use the information we collect to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide, operate, and improve our facility management services</li>
                            <li>Respond to your inquiries and audit requests</li>
                            <li>Match your facility with qualified, vetted contractors</li>
                            <li>Send service-related communications (scheduling, invoices, audit reports)</li>
                            <li>Send marketing communications with your consent (you can opt out at any time)</li>
                            <li>Analyze website usage to improve our services</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">4. How We Share Your Information</h2>
                        <p>We do not sell your personal information. We may share your information with:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Service Providers:</strong> Contractors assigned to your facility will receive your business name, address, and service requirements</li>
                            <li><strong>Technology Partners:</strong> We use Google Cloud (Firebase) for data storage, Google Analytics for website analytics, and email service providers for communications</li>
                            <li><strong>Legal Requirements:</strong> We may disclose information to comply with applicable law, regulation, or legal process</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">5. Cookies & Tracking</h2>
                        <p>
                            We use cookies and similar technologies to improve your browsing experience and analyze site traffic.
                            These include:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Essential Cookies:</strong> Required for site functionality</li>
                            <li><strong>Analytics Cookies:</strong> Google Analytics to understand how visitors use our site</li>
                            <li><strong>UTM Parameters:</strong> We track marketing attribution (source, medium, campaign) to measure our outreach effectiveness</li>
                        </ul>
                        <p>You can control cookies through your browser settings.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">6. Data Security</h2>
                        <p>
                            We implement industry-standard security measures to protect your information, including
                            encrypted data transmission (HTTPS), secure cloud infrastructure (Google Cloud), and
                            role-based access controls for our internal team. However, no internet transmission is
                            100% secure, and we cannot guarantee absolute security.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">7. Data Retention</h2>
                        <p>
                            We retain your information for as long as necessary to provide our services and fulfill the
                            purposes described in this policy. Lead and contractor data is retained for the duration of
                            our business relationship and for a reasonable period thereafter for legal and operational purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">8. Your Rights</h2>
                        <p>Depending on your location, you may have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Access the personal information we hold about you</li>
                            <li>Request correction of inaccurate information</li>
                            <li>Request deletion of your information</li>
                            <li>Opt out of marketing communications</li>
                        </ul>
                        <p>
                            To exercise any of these rights, contact us at{' '}
                            <a href="mailto:chris@xiri.ai" className="text-sky-600 hover:underline">chris@xiri.ai</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">9. Children&apos;s Privacy</h2>
                        <p>
                            Our services are not directed to individuals under 18 years of age. We do not knowingly
                            collect personal information from children.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">10. Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. We will notify you of any material
                            changes by posting the updated policy on this page with a revised &quot;Last updated&quot; date.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">11. Contact Us</h2>
                        <p>
                            If you have questions about this Privacy Policy or our data practices, contact us at:
                        </p>
                        <p className="font-medium">
                            XIRI Facility Solutions<br />
                            Email: <a href="mailto:chris@xiri.ai" className="text-sky-600 hover:underline">chris@xiri.ai</a>
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
