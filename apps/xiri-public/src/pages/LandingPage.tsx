import { Link } from 'react-router-dom';
import { ArrowRight, Building, Briefcase } from 'lucide-react';

export function LandingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center p-6">
            <div className="max-w-4xl w-full text-center space-y-12">
                <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
                    Xiri <span className="text-indigo-600">Public</span>
                </h1>
                <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    Connecting businesses with top-tier facility service providers.
                </p>

                <div className="grid md:grid-cols-2 gap-8 w-full max-w-2xl mx-auto">
                    {/* Customer Card */}
                    <Link to="/get-started" className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border border-transparent hover:border-indigo-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Building className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">I Need Services</h2>
                        <p className="text-gray-500 mb-6">Find qualified vendors for your facility needs.</p>
                        <div className="mt-auto flex items-center gap-2 text-indigo-600 font-semibold">
                            Get Started <ArrowRight className="w-4 h-4" />
                        </div>
                    </Link>

                    {/* Vendor Card */}
                    <div className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border border-transparent hover:border-emerald-100 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Briefcase className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">I Offer Services</h2>
                        <p className="text-gray-500 mb-6">Join our preferred vendor network.</p>
                        <button className="mt-auto px-6 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium cursor-not-allowed opacity-75">
                            Invite Only
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
