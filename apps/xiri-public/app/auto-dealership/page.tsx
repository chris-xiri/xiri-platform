export default function AutoDealershipPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Auto Dealerships</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Your showroom is your first impression. Get dedicated facility management
                            with showroom-ready standards, comprehensive care, and one point of contact
                            - so you can focus on selling cars, not managing contractors.
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

            {/* Why Dealerships Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why Auto Dealerships Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">✨</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Showroom-Ready Standards
                            </h3>
                            <p className="text-gray-600">
                                Spotless showrooms, gleaming floors, and pristine customer areas.
                                We understand the importance of first impressions.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🅿️</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Complete Lot Management
                            </h3>
                            <p className="text-gray-600">
                                From showroom to service bays to parking lots - we handle all
                                your facility needs with one point of contact.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">💳</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Simple Billing
                            </h3>
                            <p className="text-gray-600">
                                One invoice, professional payment processing. No more juggling
                                multiple contractors and invoices.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Complete Dealership Management
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "🏢", title: "Showroom Cleaning", desc: "Daily cleaning, floor care, glass" },
                            { icon: "🚗", title: "Service Bay Cleaning", desc: "Oil cleanup, floor maintenance" },
                            { icon: "🪟", title: "Window Cleaning", desc: "Showroom glass, exterior windows" },
                            { icon: "🚪", title: "Floor Care", desc: "Buffing, waxing, polishing" },
                            { icon: "🅿️", title: "Lot Maintenance", desc: "Sweeping, snow removal, striping" },
                            { icon: "🌿", title: "Landscaping", desc: "Lawn care, seasonal maintenance" },
                            { icon: "💡", title: "Light Maintenance", desc: "Bulb replacement, minor repairs" },
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
                        Ready to Elevate Your Dealership?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a free facility survey for a custom quote.
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
