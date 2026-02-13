import Link from 'next/link';

interface HeroProps {
    title: React.ReactNode;
    subtitle: string;
    ctaText?: string;
    ctaLink?: string;
}

export function Hero({
    title,
    subtitle,
    ctaText = "Schedule Free Facility Survey",
    ctaLink = "#audit"
}: HeroProps) {
    return (
        <section className="relative overflow-hidden bg-gradient-to-br from-sky-50 to-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Text Content */}
                    <div className="max-w-2xl">
                        <h1 className="text-4xl md:text-6xl font-heading font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
                            {title}
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed max-w-lg">
                            {subtitle}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                href={ctaLink}
                                className="inline-flex justify-center items-center bg-sky-600 text-white px-8 py-4 rounded-full text-lg font-medium shadow-lg shadow-sky-600/20 hover:bg-sky-700 hover:shadow-xl hover:shadow-sky-600/30 transition-all duration-300 transform hover:-translate-y-0.5"
                            >
                                {ctaText}
                            </Link>
                            <Link
                                href="/contractors"
                                className="inline-flex justify-center items-center px-8 py-4 rounded-full text-lg font-medium text-gray-600 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300"
                            >
                                Vendor Portal
                            </Link>
                        </div>

                        <div className="mt-8 flex items-center gap-6 text-sm text-gray-500 font-medium">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Nightly Audits
                            </div>
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                100% Insured
                            </div>
                        </div>
                    </div>

                    {/* Visual / Graphic (Right Side) */}
                    <div className="hidden lg:block relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-sky-100/50 to-transparent rounded-3xl transform rotate-3 scale-105 -z-10"></div>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/5 border border-gray-100 aspect-[4/3] flex items-center justify-center relative group">
                            <div className="text-center p-8">
                                <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-500">🏥</div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Facility Solutions</h3>
                                <p className="text-gray-500">Medical • Auto • Education</p>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute top-6 right-6 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-100 animate-pulse">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-xs font-bold text-gray-700">System Operational</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
