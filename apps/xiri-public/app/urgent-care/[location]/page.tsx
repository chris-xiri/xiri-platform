import { LOCATIONS, getLocationBySlug } from '@/lib/locations';

export async function generateStaticParams() {
    return LOCATIONS.map((location) => ({
        location: location.slug,
    }));
}

export default async function UrgentCareLocationPage({
    params,
}: {
    params: Promise<{ location: string }>;
}) {
    const { location: locationSlug } = await params;
    const location = getLocationBySlug(locationSlug);

    if (!location) {
        return <div>Location not found</div>;
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-blue-50 to-white py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Professional Facility Management<br />
                            <span className="text-blue-600">For Urgent Care Centers in {location.city}, {location.state}</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Your {location.city} urgent care center needs to be spotless 24/7.
                            Get dedicated facility management that keeps your center clean, compliant,
                            and ready for patients around the clock.
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

            {/* Local Context */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-blue-50 p-8 rounded-lg">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Serving Urgent Care Centers Throughout {location.city}
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Accessible to urgent care facilities throughout {location.county} County, including
                            centers in {location.city} and surrounding areas. Our {location.county}-based
                            facility management team provides rapid response for your 24/7 operations.
                        </p>
                        <p className="text-gray-700">
                            <strong>Local Coverage:</strong> We understand {location.city} urgent care
                            facility requirements and provide around-the-clock support.
                        </p>
                    </div>
                </div>
            </section>

            {/* Why Urgent Care Centers Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why {location.city} Urgent Care Centers Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">⚡</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                24/7 Readiness
                            </h3>
                            <p className="text-gray-600">
                                Urgent care never sleeps, and neither do we. Our team ensures your facility
                                is always clean and ready for the next patient.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🧪</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Medical-Grade Standards
                            </h3>
                            <p className="text-gray-600">
                                We maintain healthcare facility standards with proper disinfection protocols
                                and compliance documentation.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">💳</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Simple Billing
                            </h3>
                            <p className="text-gray-600">
                                One invoice for all your facility needs. No more juggling multiple
                                vendor contracts and payments.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Top Services */}
            <section className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Our Most Popular Services in {location.city}
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Core Service 1: Janitorial */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🧹</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Janitorial Cleaning
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Professional cleaning for exam rooms, waiting areas, and restrooms.
                                HIPAA-compliant protocols with medical-grade disinfection for high patient volume.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Multiple daily cleaning rounds</li>
                                <li>✓ Medical-grade disinfection</li>
                                <li>✓ High-touch surface sanitization</li>
                                <li>✓ Waiting room maintenance</li>
                            </ul>
                        </div>

                        {/* Core Service 2: Consumables */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">📦</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Consumables Procurement
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Never run out of essential supplies. We track inventory and automatically
                                restock toilet paper, paper towels, soap, and cleaning supplies.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Automatic inventory tracking</li>
                                <li>✓ Scheduled restocking</li>
                                <li>✓ Bulk pricing discounts</li>
                                <li>✓ Single invoice for all supplies</li>
                            </ul>
                        </div>

                        {/* Core Service 3: Pest Control */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🐛</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Pest Control
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Regular inspections and treatments to maintain a pest-free environment.
                                Safe, effective solutions that meet healthcare facility standards.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Monthly inspections</li>
                                <li>✓ Preventive treatments</li>
                                <li>✓ Healthcare-safe products</li>
                                <li>✓ Compliance documentation</li>
                            </ul>
                        </div>

                        {/* Urgent Care-Specific Service 1: Medical Waste */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🗑️</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Medical Waste Disposal
                            </h3>
                            <p className="text-gray-600 mb-4">
                                High-volume biohazard waste removal for busy urgent care centers.
                                Frequent pickups to handle your patient volume safely.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Frequent pickup schedules</li>
                                <li>✓ Sharps container service</li>
                                <li>✓ Biohazard waste removal</li>
                                <li>✓ OSHA compliance tracking</li>
                            </ul>
                        </div>

                        {/* Urgent Care-Specific Service 2: Disinfection */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🧪</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Deep Disinfection Services
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Enhanced disinfection protocols for high-traffic urgent care environments.
                                Keep patients and staff safe with hospital-grade sanitization.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Electrostatic disinfection</li>
                                <li>✓ High-touch surface focus</li>
                                <li>✓ Waiting room sanitization</li>
                                <li>✓ CDC-compliant protocols</li>
                            </ul>
                        </div>

                        {/* 6th Card: More Services */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-lg shadow-md border-2 border-blue-200 flex flex-col items-center justify-center text-center">
                            <div className="text-5xl mb-4">➕</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                More Services
                            </h3>
                            <p className="text-gray-600 mb-4">
                                We coordinate 30+ additional services through our vetted contractor network.
                            </p>
                            <a
                                href="#additional-services"
                                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                            >
                                View All Services
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Additional Services for SEO */}
            <section id="additional-services" className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
                        Additional Services Available in {location.city}
                    </h2>
                    <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
                        As your complete facility management partner, we coordinate all your building needs through our network of vetted contractors.
                    </p>
                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[
                            "Window Cleaning",
                            "Carpet Cleaning",
                            "Floor Waxing & Buffing",
                            "Upholstery Cleaning",
                            "Tile & Grout Cleaning",
                            "Pressure Washing",
                            "Snow Removal",
                            "HVAC Maintenance",
                            "Plumbing Services",
                            "Electrical Services",
                            "Painting",
                            "Drywall Repair",
                            "Door Repair",
                            "Lock Services",
                            "Signage Installation",
                            "Light Bulb Replacement",
                            "Air Duct Cleaning",
                            "Graffiti Removal",
                            "Trash Removal",
                            "Recycling Services",
                            "Emergency Cleanup",
                            "Water Damage Restoration",
                            "Mold Remediation",
                            "Handyman Services",
                            "General Maintenance",
                            "Parking Lot Maintenance",
                            "Parking Lot Sweeping",
                            "Landscaping",
                            "Common Area Cleaning",
                            "Elevator Maintenance"
                        ].map((service, index) => (
                            <div key={index} className="bg-gray-50 px-4 py-3 rounded-lg text-sm text-gray-700 text-center hover:bg-blue-50 transition-colors">
                                {service}
                            </div>
                        ))}
                    </div>
                    <p className="text-center text-gray-600 mt-8">
                        <strong>Need something else?</strong> We can coordinate virtually any facility service through our contractor network.
                    </p>
                </div>
            </section>

            {/* CTA Section */}
            <section id="survey" className="bg-blue-600 py-16">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Elevate Your {location.city} Urgent Care Center?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a free facility survey to see how we can help maintain
                        the highest standards for your urgent care facility.
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
