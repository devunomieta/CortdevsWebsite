import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { SplitSubsLogo } from "./SplitSubsLogo";

const navLinks = [
    { to: "/", label: "Browse" },
    { to: "/how-it-works", label: "How it works" },
    { to: "/contact", label: "Contact" },
];

export function SplitSubsNavbar() {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Close the mobile menu on route change, and stop the page from
    // scrolling behind it while it's open.
    useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);
    useEffect(() => {
        document.body.style.overflow = isMenuOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [isMenuOpen]);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled || isMenuOpen ? "bg-nav-fallback backdrop-blur-md border-b border-border py-4" : "py-6"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
                <SplitSubsLogo className="group" iconClassName="h-8 w-8 text-primary" wordmarkClassName="text-lg text-foreground" />

                <nav className="hidden md:flex items-center gap-10">
                    {navLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`text-xs font-semibold uppercase tracking-widest transition-colors ${location.pathname === link.to ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <Link
                        to="/dashboard"
                        className="hidden sm:inline-block px-5 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all"
                    >
                        Dashboard
                    </Link>
                    <button
                        onClick={() => setIsMenuOpen((v) => !v)}
                        className="md:hidden p-2 -mr-2 text-foreground"
                        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                    >
                        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {isMenuOpen && (
                <nav className="md:hidden border-t border-border bg-background px-6 py-6 flex flex-col gap-1">
                    {navLinks.map((link) => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`px-2 py-3 text-sm font-semibold uppercase tracking-widest transition-colors ${location.pathname === link.to ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <Link
                        to="/dashboard"
                        className="sm:hidden mt-3 px-5 py-3 text-center bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em]"
                    >
                        Dashboard
                    </Link>
                </nav>
            )}
        </header>
    );
}
