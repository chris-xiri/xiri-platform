interface FAQItem {
    question: string;
    answer: string;
}

interface FAQProps {
    items: FAQItem[];
    locationName?: string;
}

export function FAQ({ items, locationName }: FAQProps) {
    if (!items || items.length === 0) return null;

    return (
        <section className="py-12 bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
                    Frequently Asked Questions {locationName ? `in ${locationName}` : ''}
                </h2>
                <div className="space-y-6">
                    {items.map((item, index) => (
                        <div key={index} className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {item.question}
                            </h3>
                            <p className="text-gray-600">
                                {item.answer}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
