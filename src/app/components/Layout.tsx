import { useNavigate, Outlet, Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "./ui/dialog";
import { ContactForm } from "./ContactForm";
import { useConfig } from "../context/ConfigContext";
import { supabase } from '../../lib/supabase';

export function Layout() {
  const { config, currency, setCurrencyCode, isNigerian } = useConfig();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleMaintenanceRedirect = async () => {
      const isAdminPath = location.pathname.startsWith('/admin');
      const isMaintenancePath = location.pathname === '/maintenance';

      if (config.maintenanceMode && !isAdminPath && !isMaintenancePath) {
        try {
          // Check for admin session
          const { data: { session } } = await supabase.auth.getSession();
          const isAdmin = !!session || localStorage.getItem("admin_auth");

          if (!isAdmin) {
            navigate('/maintenance', { replace: true });
          }
        } catch (err) {
          console.error("Maintenance check error:", err);
          navigate('/maintenance', { replace: true });
        }
      }
    };

    handleMaintenanceRedirect();
  }, [config.maintenanceMode, location.pathname, navigate]);

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
  }, [location.pathname]);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/work", label: "Work" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
  ];

  const quickLinks = navLinks.filter(l => l.to !== "/" && l.to !== "/about");

  const mobileNavVariants: any = {
    closed: { x: "100%", opacity: 0, transition: { type: "spring", stiffness: 300, damping: 35 } },
    open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 35 } }
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled || isMenuOpen ? "bg-white/95 backdrop-blur-md border-b border-neutral-100 py-4" : "py-6"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="text-2xl font-light tracking-tighter flex items-center gap-2 group underline-offset-8">
            <img src={config.headerLogo} alt="CortDevs" className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm tracking-widest uppercase transition-colors relative group ${location.pathname === link.to ? "text-black font-semibold" : "text-neutral-500 hover:text-black"
                  }`}
              >
                {link.label}
                <span className={`absolute -bottom-1 left-0 h-[1px] bg-black transition-all duration-300 ${location.pathname === link.to ? "w-full" : "w-0 group-hover:w-full"}`} />
              </Link>
            ))}
            <button
              onClick={() => setIsDialogOpen(true)}
              className="bg-black text-white px-8 py-3 text-xs tracking-widest uppercase hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
            >
              Start Project
            </button>
          </div>

          {/* Creative Mobile Trigger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden relative z-[110] w-12 h-12 flex flex-col items-center justify-center gap-1.5 focus:outline-none group bg-black rounded-full shadow-lg shadow-black/20"
            aria-label="Toggle Menu"
          >
            <motion.span
              animate={isMenuOpen ? { rotate: 45, y: 3.5, width: 22 } : { rotate: 0, y: 0, width: 16 }}
              className="h-[1.5px] bg-white transition-all origin-center"
            />
            <motion.span
              animate={isMenuOpen ? { rotate: -45, y: -3.5, width: 22 } : { rotate: 0, y: 0, width: 24 }}
              className="h-[1.5px] bg-white transition-all origin-center"
            />
          </button>
        </div>
      </nav>

      {/* Full-height Mobile Navigation Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={mobileNavVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-0 z-[105] bg-white flex flex-col pt-24"
          >
            <div className="flex-1 flex flex-col justify-center px-12 space-y-10">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                >
                  <Link
                    to={link.to}
                    onClick={() => setIsMenuOpen(false)}
                    className={`text-5xl font-light tracking-tight transition-all hover:pl-4 transition-[padding] ${location.pathname === link.to ? "italic font-normal underline underline-offset-8 decoration-1" : "text-black"
                      }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="pt-12"
              >
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDialogOpen(true);
                  }}
                  className="w-full py-8 bg-black text-white text-sm tracking-[0.3em] uppercase font-bold hover:bg-neutral-800 transition-all shadow-2xl shadow-black/30"
                >
                  Start Project
                </button>
              </motion.div>
            </div>

            <div className="p-12 border-t border-neutral-100 grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] tracking-widest text-neutral-400 uppercase mb-2 font-bold">Inquiries</p>
                <a href="mailto:projects@cortdevs.com" className="text-xs font-semibold block truncate">projects@cortdevs.com</a>
              </div>
              {isNigerian && (
                <div>
                  <p className="text-[10px] tracking-widest text-neutral-400 uppercase mb-2 font-bold">WhatsApp</p>
                  <a href="https://wa.me/2348162351372" className="text-xs font-semibold">+234 816 235 1372</a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-10 lg:p-16 border-none bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)]">
          <ContactForm isPopup onSuccess={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main>
        <Outlet context={{ setIsDialogOpen }} />
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="mb-8">
                <img src={config.footerLogo} alt="CortDevs" className="h-10 w-auto object-contain" />
              </div>
              <p className="text-neutral-400 text-sm leading-relaxed max-w-md mb-8">
                Crafting digital excellence through innovative web solutions.
                Transforming visions into powerful, scalable digital experiences.
              </p>
              <button
                onClick={() => setIsDialogOpen(true)}
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black text-sm tracking-wide hover:bg-neutral-100 transition-colors"
              >
                Start Your Project <ArrowRight size={18} />
              </button>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm tracking-wider mb-6 text-neutral-400 uppercase">Quick Links</h3>
              <ul className="space-y-4">
                {quickLinks.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-neutral-300 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li className="pt-2">
                  <Link
                    to="/work?review=true"
                    className="group flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-white hover:bg-white hover:text-black transition-all"
                  >
                    <Star size={12} className="group-hover:fill-current transition-all" />
                    Leave a Review
                  </Link>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-sm tracking-wider mb-6 text-neutral-400 uppercase">Services</h3>
              <ul className="space-y-4 text-sm text-neutral-300">
                <li>Professional WordPress</li>
                <li>Enterprise Shopify</li>
                <li>Advanced GHL Automations</li>
                <li>Custom Full-Stack Apps</li>
              </ul>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-neutral-500">
              © 2026 CortDevs Group. Crafted for speed & conversion.
            </p>
            <div className="flex gap-8 text-sm text-neutral-500">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
