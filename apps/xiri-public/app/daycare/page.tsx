export default function DaycarePage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Daycares & Preschools</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Children deserve clean, safe environments. Get dedicated facility management
                            with child-safe protocols, daily deep cleaning, and comprehensive care
                            - so you can focus on education, not facility management.
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

            {/* Why Daycares Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why Daycares & Preschools Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">👶</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Child-Safe Protocols
                            </h3>
                            <p className="text-gray-600">
                                Non-toxic, child-safe cleaning products and protocols. We understand
                                the unique needs of facilities serving young children.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🧹</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Daily Deep Cleaning
                            </h3>
                            <p className="text-gray-600">
                                High-touch surfaces, play areas, restrooms, and nap rooms cleaned
                                daily to maintain health and safety standards.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">✅</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Licensing Compliance
                            </h3>
                            <p className="text-gray-600">
                                We help you maintain state licensing requirements for cleanliness
                                and facility maintenance.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Complete Daycare Facility Management
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { icon: "🧸", title: "Play Area Cleaning", desc: "Toys, mats, equipment sanitization" },
                            { icon: "🛏️", title: "Nap Room Care", desc: "Bedding, floors, air quality" },
                            { icon: "🚽", title: "Restroom Sanitization", desc: "Child-height fixtures, deep cleaning" },
                            { icon: "🍽️", title: "Kitchen/Dining", desc: "Food prep areas, high chairs, tables" },
                            { icon: "🚪", title: "Floor Care", desc: "Safe, non-slip floor maintenance" },
                            { icon: "🪟", title: "Window Cleaning", desc: "Interior and exterior" },
                            { icon: "🌿", title: "Outdoor Areas", desc: "Playground, lawn care" },
                            { icon: "📊", title: "Data Tracking", desc: "Issue logs, compliance documentation" }
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
                        Ready to Elevate Your Daycare Facility?
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
