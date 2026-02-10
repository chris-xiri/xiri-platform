export default function SurgeryCenterPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Ambulatory Surgery Centers</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Surgery centers require the highest standards of cleanliness and compliance.
                            Get dedicated facility management with specialized protocols, night audits,
                            and comprehensive care - so you can focus on surgical excellence.
                        </p>
                        <a
                            href="#survey"
                            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Schedule Free Facility Survey
                        </a>
                    </div>
                </div>
            </section>

            {/* Why Surgery Centers Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why Surgery Centers Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🏥</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Surgical-Grade Standards
                            </h3>
                            <p className="text-gray-600">
                                We understand sterile environments, infection control protocols,
                                and the critical importance of surgical suite cleanliness.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">✅</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Compliance Focused
                            </h3>
                            <p className="text-gray-600">
                                Familiar with CMS, Joint Commission, and state regulations.
                                We help you maintain accreditation standards.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🌙</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Night Manager Audits
                            </h3>
                            <p className="text-gray-600">
                                We audit contractor work after hours to ensure your surgical
                                suites meet the highest standards before procedures.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services for Surgery Centers */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Specialized Facility Management
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "🏥", title: "Surgical Suite Cleaning", desc: "Sterile protocols, specialized equipment" },
                            { icon: "🦠", title: "Infection Control", desc: "EPA-approved disinfectants, protocols" },
                            { icon: "🗑️", title: "Medical Waste", desc: "Biohazard disposal, compliance" },
                            { icon: "🧪", title: "Pre-Op/Recovery Areas", desc: "Patient-ready standards" },
                            { icon: "🚪", title: "Floor Care", desc: "Specialized flooring maintenance" },
                            { icon: "💡", title: "Light Maintenance", desc: "Critical systems support" },
                            { icon: "🅿️", title: "Parking Lot", desc: "Patient and staff safety" },
                            { icon: "📊", title: "Compliance Tracking", desc: "Documentation and reporting" }
                        ].map((item, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                                <div className="text-3xl mb-2">{item.icon}</div>
                                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                                <p className="text-sm text-gray-600">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section id="survey" className="bg-blue-600 py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Elevate Your Surgery Center?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a free facility survey to see how we can help maintain
                        the highest standards for your surgical facility.
                    </p>
                    <a
                        href="#contact-form"
                        className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                        Get Started Today
                    </a>
                </div>
            </section>
        </div>
    );
}
