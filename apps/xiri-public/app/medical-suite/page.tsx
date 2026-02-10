export default function MedicalSuitePage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Medical Suites & Condos</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Your medical suite deserves more than just cleaning. Get dedicated facility
                            management with regular site visits, night audits, and comprehensive care -
                            so you can focus on patient care, not facility headaches.
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

            {/* Why Medical Suites Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why Medical Suites Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🏥</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Healthcare-Focused
                            </h3>
                            <p className="text-gray-600">
                                We understand medical facility requirements, HIPAA compliance, and
                                the importance of maintaining a clean, professional environment for patients.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">👤</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Dedicated Facility Manager
                            </h3>
                            <p className="text-gray-600">
                                Your personal account manager visits your suite regularly, knows your
                                specific needs, and ensures consistent quality standards.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🌙</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Night Manager Audits
                            </h3>
                            <p className="text-gray-600">
                                We audit contractor work after hours to ensure your suite is perfect
                                before patients arrive each morning.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* What We Manage */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Total Facility Management
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "🧹", title: "Daily Cleaning", desc: "Exam rooms, waiting areas, restrooms" },
                            { icon: "🗑️", title: "Medical Waste", desc: "Proper disposal and compliance" },
                            { icon: "🪟", title: "Window Cleaning", desc: "Interior and exterior" },
                            { icon: "🚪", title: "Floor Care", desc: "Mopping, buffing, carpet cleaning" },
                            { icon: "💡", title: "Light Maintenance", desc: "Bulb replacement, minor repairs" },
                            { icon: "🅿️", title: "Parking Lot", desc: "Sweeping, snow removal" },
                            { icon: "🌿", title: "Landscaping", desc: "Lawn care, seasonal maintenance" },
                            { icon: "📊", title: "Data Tracking", desc: "Issue logs, resolution tracking" }
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

            {/* How It Works */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        How It Works
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                                1
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Free Facility Survey
                            </h3>
                            <p className="text-gray-600">
                                We visit your medical suite, assess your needs, and provide a
                                custom quote based on size, frequency, and services required.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                                2
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Assign Your Team
                            </h3>
                            <p className="text-gray-600">
                                Meet your dedicated facility manager and vetted contractors.
                                We handle all coordination and quality control.
                            </p>
                        </div>
                        <div className="text-center">
                            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                                3
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Ongoing Management
                            </h3>
                            <p className="text-gray-600">
                                Regular visits, night audits, easy communication via text,
                                and one simple monthly invoice. No hassle.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section id="survey" className="bg-blue-600 py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Elevate Your Medical Suite?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a free facility survey to see how we can help maintain
                        the highest standards for your practice.
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
