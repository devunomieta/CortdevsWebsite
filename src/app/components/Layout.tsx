import { Outlet, Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function Layout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location]);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/work", label: "Work" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 lg:h-24">
            {/* Logo */}
            <Link to="/" className="text-2xl font-light tracking-tight">
              <span className="font-normal">APEX</span>
              <span className="text-neutral-400">DIGITAL</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-12">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm tracking-wide transition-colors relative group ${
                    location.pathname === link.to
                      ? "text-black"
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-[1px] bg-black transition-all duration-300 ${
                      location.pathname === link.to ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              ))}
              <Link
                to="/contact"
                className="px-6 py-3 bg-black text-white text-sm tracking-wide hover:bg-neutral-800 transition-colors"
              >
                Start Project
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 -mr-2"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-t border-neutral-100"
            >
              <div className="px-6 py-8 space-y-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block text-lg ${
                      location.pathname === link.to
                        ? "text-black"
                        : "text-neutral-500"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/contact"
                  className="flex items-center gap-2 text-lg text-black"
                >
                  Start Project <ArrowRight size={20} />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="text-3xl font-light tracking-tight mb-6">
                <span className="font-normal">APEX</span>
                <span className="text-neutral-500">DIGITAL</span>
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-md mb-8">
                Crafting digital excellence through innovative web solutions. 
                Transforming visions into powerful, scalable digital experiences.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm tracking-wide hover:bg-neutral-100 transition-colors"
              >
                Start Your Project <ArrowRight size={18} />
              </Link>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm tracking-wider mb-6 text-neutral-400">NAVIGATION</h3>
              <ul className="space-y-4">
                {navLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-neutral-300 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-sm tracking-wider mb-6 text-neutral-400">SERVICES</h3>
              <ul className="space-y-4 text-sm text-neutral-300">
                <li>WordPress Development</li>
                <li>Shopify Solutions</li>
                <li>GHL Integration</li>
                <li>Custom Development</li>
              </ul>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-neutral-500">
              © 2026 ApexDigital. All rights reserved.
            </p>
            <div className="flex gap-8 text-sm text-neutral-500">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
