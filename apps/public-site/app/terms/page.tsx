import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Terms of Service',
    description: 'XIRI Facility Solutions terms of service — rules governing use of our website and platform.',
    alternates: {
        canonical: 'https://xiri.ai/terms',
    },
};

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h1 className="text-3xl font-bold font-heading text-gray-900 mb-2">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-10">Last updated: February 20, 2026</p>

                <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-[15px] leading-relaxed">
                    <section>
                        <h2 className="text-xl font-bold text-gray-900 mt-0">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using the XIRI Facility Solutions website at{' '}
                            <a href="https://xiri.ai" className="text-sky-600 hover:underline">xiri.ai</a> (&quot;the Site&quot;),
                            you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these
                            Terms, please do not use the Site.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">2. Description of Services</h2>
                        <p>
                            XIRI Facility Solutions provides facility management services for single-tenant commercial
                            buildings, including but not limited to janitorial services, floor care, consumable
                            procurement, and maintenance coordination. We connect facility owners with vetted,
                            insured independent contractors and oversee service quality through nightly audits and
                            weekly site visits.
                        </p>
                        <p>
                            The Site allows prospective clients to request facility audits, review service quotes, and
                            manage invoices. Independent contractors may apply to join our network through the Site.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">3. Eligibility</h2>
                        <p>
                            You must be at least 18 years old and have the legal authority to enter into these Terms
                            on behalf of yourself or the business entity you represent. By using the Site, you
                            represent that you meet these requirements.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">4. User Responsibilities</h2>
                        <p>When using the Site, you agree to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Provide accurate, current, and complete information in any forms or submissions</li>
                            <li>Not use the Site for any unlawful purpose or in violation of these Terms</li>
                            <li>Not attempt to gain unauthorized access to any part of the Site or its systems</li>
                            <li>Not interfere with or disrupt the Site&apos;s operation or infrastructure</li>
                            <li>Not submit false, misleading, or fraudulent information</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">5. Quotes & Proposals</h2>
                        <p>
                            Quotes and proposals provided through the Site are estimates based on information you
                            provide. Final pricing may vary based on on-site assessments and actual service scope.
                            All quotes are valid for 30 days from the date of issuance unless otherwise stated.
                            Acceptance of a quote does not constitute a binding service agreement until a separate
                            service contract is executed.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">6. Independent Contractors & Quality Management</h2>
                        <p>
                            Service providers in the XIRI network are independent contractors, not employees of XIRI.
                            While we vet all contractors for insurance, licensing, and quality standards, each contractor
                            remains the Licensed Operator responsible for the execution of services and compliance with
                            applicable trade regulations.
                        </p>
                        <p className="mt-3">
                            XIRI provides the <strong>Quality Management System (QMS)</strong> — a governance framework
                            that includes nightly verification audits, protocol checklists aligned with CDC Guidelines for
                            Healthcare Facilities and OSHA&apos;s Bloodborne Pathogen Standard (29 CFR 1910.1030), and digital
                            proof-of-service documentation. The QMS establishes the standard of care; the Vendor delivers
                            the service. XIRI is not liable for the acts or omissions of individual contractors beyond the
                            scope of our Quality Management System.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">7. Intellectual Property</h2>
                        <p>
                            All content on the Site — including text, graphics, logos, images, and software — is the
                            property of XIRI Facility Solutions or its licensors and is protected by applicable
                            intellectual property laws. You may not reproduce, distribute, modify, or create
                            derivative works from any Site content without our prior written consent.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">8. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, XIRI Facility Solutions shall not be liable for
                            any indirect, incidental, special, consequential, or punitive damages arising out of or
                            related to your use of the Site or our services. Our total liability for any claim
                            related to the Site shall not exceed the fees paid by you to XIRI in the twelve (12)
                            months preceding the claim.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">9. Disclaimer of Warranties</h2>
                        <p>
                            The Site is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
                            express or implied. We do not warrant that the Site will be uninterrupted, error-free,
                            or free of viruses or other harmful components.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">10. Indemnification</h2>
                        <p>
                            You agree to indemnify, defend, and hold harmless XIRI Facility Solutions and its
                            officers, directors, employees, and agents from any claims, losses, damages, liabilities,
                            costs, or expenses (including reasonable attorneys&apos; fees) arising out of your use of the
                            Site, your violation of these Terms, or your violation of any rights of a third party.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">11. Governing Law</h2>
                        <p>
                            These Terms shall be governed by and construed in accordance with the laws of the State
                            of New York, without regard to its conflict of law principles. Any legal action arising
                            from these Terms shall be brought exclusively in the state or federal courts located in
                            Nassau County, New York.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">12. Changes to These Terms</h2>
                        <p>
                            We reserve the right to modify these Terms at any time. Changes will be effective
                            immediately upon posting to the Site. Your continued use of the Site after changes
                            constitutes acceptance of the revised Terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-gray-900">13. Contact</h2>
                        <p>
                            Questions about these Terms? Contact us at:
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
