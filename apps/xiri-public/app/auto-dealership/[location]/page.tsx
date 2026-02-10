import { LOCATIONS, getLocationBySlug } from '@/lib/locations';

export async function generateStaticParams() {
    return LOCATIONS.map((location) => ({
        location: location.slug,
    }));
}

export default async function AutoDealershipLocationPage({
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
                            <span className="text-blue-600">For Auto Dealerships in {location.city}, {location.state}</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                            Your {location.city} dealership showroom is your brand. Get dedicated facility
                            management that keeps your showroom, service areas, and lot pristine -
                            so you can focus on selling cars, not managing vendors.
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
                            Serving Auto Dealerships Throughout {location.city}
                        </h2>
                        <p className="text-gray-700 mb-4">
                            Accessible to dealerships throughout {location.county} County, including
                            facilities in {location.city} and surrounding areas. Our {location.county}-based
                            facility management team understands automotive retail environments.
                        </p>
                        <p className="text-gray-700">
                            <strong>Local Coverage:</strong> We're familiar with {location.city} dealership
                            needs and provide comprehensive showroom and lot maintenance.
                        </p>
                    </div>
                </div>
            </section>

            {/* Why Dealerships Choose XIRI */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        Why {location.city} Dealerships Choose XIRI
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">✨</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Showroom-Ready Standards
                            </h3>
                            <p className="text-gray-600">
                                Your showroom represents your brand. We maintain pristine conditions
                                that impress every customer who walks through your doors.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                            <div className="text-4xl mb-4">🚗</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Lot Management
                            </h3>
                            <p className="text-gray-600">
                                Keep your lot clean and presentable with regular sweeping, snow removal,
                                and maintenance that showcases your inventory.
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
                                Professional cleaning for showrooms, offices, customer lounges, and restrooms.
                                Keep your dealership spotless and welcoming for every customer.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Daily showroom cleaning</li>
                                <li>✓ Glass & window polishing</li>
                                <li>✓ Customer lounge maintenance</li>
                                <li>✓ Office area cleaning</li>
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
                                Safe, effective solutions for your showroom and service areas.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Monthly inspections</li>
                                <li>✓ Preventive treatments</li>
                                <li>✓ Safe for customers & staff</li>
                                <li>✓ Service documentation</li>
                            </ul>
                        </div>

                        {/* Dealership-Specific Service 1: Lot Maintenance */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🅿️</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Parking Lot Maintenance
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Keep your lot clean and presentable with regular sweeping, power washing,
                                and snow removal. First impressions start in the parking lot.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Regular lot sweeping</li>
                                <li>✓ Power washing services</li>
                                <li>✓ Snow & ice removal</li>
                                <li>✓ Line striping coordination</li>
                            </ul>
                        </div>

                        {/* Dealership-Specific Service 2: Window Cleaning */}
                        <div className="bg-white p-8 rounded-lg shadow-md">
                            <div className="text-5xl mb-4">🪟</div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                                Window & Glass Cleaning
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Spotless showroom windows and glass surfaces. Let customers see your
                                inventory clearly with professional window cleaning.
                            </p>
                            <ul className="text-sm text-gray-600 space-y-2">
                                <li>✓ Showroom window cleaning</li>
                                <li>✓ Interior glass polishing</li>
                                <li>✓ Streak-free finish</li>
                                <li>✓ Regular maintenance schedule</li>
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
                            "Carpet Cleaning",
                            "Floor Waxing & Buffing",
                            "Upholstery Cleaning",
                            "Tile & Grout Cleaning",
                            "Pressure Washing",
                            "Snow Removal",
                            "Landscaping",
                            "Lawn Care",
                            "Tree Trimming",
                            "HVAC Maintenance",
                            "Plumbing Services",
                            "Electrical Services",
                            "Painting",
                            "Drywall Repair",
                            "Door Repair",
                            "Lock Services",
                            "Signage Installation",
                            "Light Bulb Replacement",
                            "Graffiti Removal",
                            "Trash Removal",
                            "Recycling Services",
                            "Emergency Cleanup",
                            "Water Damage Restoration",
                            "Handyman Services",
                            "General Maintenance",
                            "Parking Lot Sweeping",
                            "Asphalt Repair",
                            "Concrete Repair",
                            "Fence Repair",
                            "Awning Cleaning"
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
                        Ready to Elevate Your {location.city} Dealership?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Schedule a free facility survey to see how we can help maintain
                        showroom-ready standards for your dealership.
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
