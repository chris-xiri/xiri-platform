interface ValueProp {
    icon: string;
    title: string;
    description: string;
}

interface ValuePropsSectionProps {
    title?: string;
    items?: ValueProp[];
}

const DEFAULT_ITEMS: ValueProp[] = [
    {
        icon: "👤",
        title: "Dedicated Facility Manager",
        description: "Personal account manager with regular site visits"
    },
    {
        icon: "🌙",
        title: "Night Manager Quality Audits",
        description: "We audit contractor work to ensure standards"
    },
    {
        icon: "📊",
        title: "Data-Driven Insights",
        description: "Track facility health, issues, and resolutions"
    },
    {
        icon: "💳",
        title: "Easy Payments",
        description: "One invoice, professional processing"
    },
    {
        icon: "💬",
        title: "Simple Feedback (Text Us!)",
        description: "Report issues via text, email, or chat"
    },
    {
        icon: "⚡",
        title: "Fast Response & Resolution",
        description: "Quick issue resolution, no phone trees"
    },
    {
        icon: "🏢",
        title: "Total Facility Management",
        description: "Foundation to roof, bathroom to parking lot"
    },
    {
        icon: "📱",
        title: "24/7 Virtual Support",
        description: "Get help anytime through our chat assistant"
    }
];

export function ValuePropsSection({
    title = "Why Leading Facilities Choose XIRI",
    items = DEFAULT_ITEMS
}: ValuePropsSectionProps) {
    return (
        <section className="bg-gray-50/50 py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-heading font-bold text-gray-900 mb-4 tracking-tight">
                        {title}
                    </h2>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        We bring hospital-grade standards to your facility management.
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {items.map((item, index) => (
                        <div key={index} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-sky-100 transition-all duration-300 group">
                            <div className="w-14 h-14 bg-sky-50 rounded-xl flex items-center justify-center text-3xl mb-6 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300">
                                {item.icon}
                            </div>
                            <h3 className="text-xl font-bold font-heading text-gray-900 mb-3 group-hover:text-sky-700 transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed text-sm">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
