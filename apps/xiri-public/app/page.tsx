export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Professional Facility Management<br />
            <span className="text-blue-600">That Actually Works</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Beyond just cleaning - your complete facility management partner.
            Dedicated facility managers, night audits, and comprehensive care
            so you can focus on your business, not facility headaches.
          </p>
          <a
            href="/medical-offices#survey"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Schedule Free Facility Survey
          </a>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            What Makes XIRI Different
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
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
            ].map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Elevate Your Facility Management?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Schedule a free facility survey to see how we can help maintain
            the highest standards for your medical office.
          </p>
          <a
            href="/medical-offices#survey"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Get Started Today
          </a>
        </div>
      </section>
    </div>
  );
}
