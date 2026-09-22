import { Link } from "react-router";
import { SplitSubsLogo } from "./SplitSubsLogo";

export function SplitSubsFooter() {
    return (
        <footer className="bg-neutral-900 text-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                    <div className="lg:col-span-2">
                        <SplitSubsLogo className="mb-6" iconClassName="h-9 w-9 text-white" wordmarkClassName="text-xl text-white" />
                        <p className="text-neutral-400 text-sm leading-relaxed max-w-sm mb-6">
                            Stop carrying the full bill alone. Split Netflix, Spotify and more with real
                            people — your money stays safe with us until your access is confirmed working.
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center justify-center px-6 py-3 bg-white text-neutral-900 text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all"
                        >
                            Join Free Today
                        </Link>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4">SplitSubs</p>
                        <ul className="space-y-3 text-sm text-neutral-400">
                            <li><Link to="/" className="hover:text-white transition-colors">Browse Seats</Link></li>
                            <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
                            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                            <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                            <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                        </ul>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4">Cortdevs</p>
                        <ul className="space-y-3 text-sm text-neutral-400">
                            <li><a href="https://cortdevs.com" className="hover:text-white transition-colors">Main Site</a></li>
                            <li><Link to="/admin/login" className="hover:text-white transition-colors">Staff Login</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-neutral-800 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-neutral-500">© 2026 CortDevs Group. SplitSubs.</p>
                    <p className="text-xs text-neutral-500">Your money dey safe — every seat is escrow-protected.</p>
                </div>
            </div>
        </footer>
    );
}
