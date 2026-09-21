import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { SplitSubsLogo } from "./SplitSubsLogo";

const navLinks = [
    { to: "/", label: "Browse" },
    { to: "/how-it-works", label: "How it works" },
    { to: "/contact", label: "Contact" },
];

export function SplitSubsNavbar() {
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all ${scrolled ? "bg-nav-fallback backdrop-blur-md border-b border-border py-4" : "py-6"
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

                <Link
                    to="/dashboard"
                    className="px-5 py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all"
                >
                    Dashboard
                </Link>
            </div>
        </header>
    );
}
