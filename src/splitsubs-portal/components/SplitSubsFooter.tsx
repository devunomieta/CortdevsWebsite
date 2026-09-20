import { Link } from "react-router";
import { useConfig } from "../../app/context/ConfigContext";

export function SplitSubsFooter() {
    const { config } = useConfig();

    return (
        <footer className="bg-neutral-900 text-white">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                    <div className="lg:col-span-2">
                        <img src={config.footerLogo} alt="CortDevs" className="h-9 w-auto object-contain mb-6" />
                        <p className="text-neutral-400 text-sm leading-relaxed max-w-sm mb-6">
                            Split the cost of the premium plans you already use. Every seat is
                            escrow-protected — a host only gets paid once you've confirmed access works.
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center justify-center px-6 py-3 bg-white text-neutral-900 text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all"
                        >
                            Get Started
                        </Link>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4">SplitSubs</p>
                        <ul className="space-y-3 text-sm text-neutral-400">
                            <li><Link to="/" className="hover:text-white transition-colors">Browse Seats</Link></li>
                            <li><Link to="/how-it-works" className="hover:text-white transition-colors">How it Works</Link></li>
                            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
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
                    <p className="text-xs text-neutral-500">Every seat is escrow-protected.</p>
                </div>
            </div>
        </footer>
    );
}
