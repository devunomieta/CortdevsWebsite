import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useConfig } from "../../app/context/ConfigContext";

const navLinks = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
];

export function EventsNavbar() {
    const { config } = useConfig();
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
                <Link to="/" className="flex items-center gap-3 group">
                    <img
                        src={config.headerLogo}
                        alt="CortDevs"
                        className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
                    />
                    <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground border-l border-border pl-3">
                        Events
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-10">
                    {navLinks.map((link) => {
                        const active = location.pathname === link.to;
                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`text-xs tracking-[0.2em] uppercase transition-colors ${active ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <Link
                    to="/contact"
                    className="hidden md:inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all"
                >
                    Talk to Us
                </Link>
            </div>
        </header>
    );
}
