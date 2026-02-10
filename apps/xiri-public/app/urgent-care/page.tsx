export default function UrgentCarePage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Urgent Care & Walk-In Clinics</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            High-traffic urgent care facilities need more than standard cleaning.
                            Get dedicated facility management with rapid response, night audits,
                            and comprehensive care - so you can focus on patients, not facility issues.
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

            {/* Why Urgent Care Chooses XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why Urgent Care Facilities Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">⚡</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Fast Response Times
                            </h3>
                            <p className="text-gray-600">
                                Urgent care means urgent needs. Text us an issue and get resolution
                                fast - no phone trees, no delays.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🏥</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                High-Traffic Ready
                            </h3>
                            <p className="text-gray-600">
                                We understand the unique challenges of high-volume facilities.
                                Multiple daily cleanings, rapid turnover, and infection control.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🌙</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Night Manager Audits
                            </h3>
                            <p className="text-gray-600">
                                We audit contractor work after hours to ensure your facility
                                is perfect before opening each morning.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services for Urgent Care */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Comprehensive Facility Management
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "🧹", title: "Multiple Daily Cleanings", desc: "Exam rooms, waiting areas, restrooms" },
                            { icon: "🦠", title: "Infection Control", desc: "EPA-approved disinfectants, protocols" },
                            { icon: "🗑️", title: "Medical Waste", desc: "Proper disposal and compliance" },
                            { icon: "🪟", title: "Window Cleaning", desc: "Interior and exterior" },
                            { icon: "🚪", title: "Floor Care", desc: "High-traffic area maintenance" },
                            { icon: "💡", title: "Light Maintenance", desc: "Bulb replacement, minor repairs" },
                            { icon: "🅿️", title: "Parking Lot", desc: "Sweeping, snow removal, striping" },
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

            {/* CTA Section */}
            <section id="survey" className="bg-blue-600 py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Elevate Your Urgent Care Facility?
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
