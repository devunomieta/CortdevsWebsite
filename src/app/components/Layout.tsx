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

      // 1. If maintenance is ACTIVE and user is NOT an admin/on admin path
      if (config.maintenanceMode && !isAdminPath && !isMaintenancePath) {
        try {
          // Robust Admin verification
          const { data: { session } } = await supabase.auth.getSession();
          const isAdmin = !!session || localStorage.getItem("admin_auth") === "true";

          if (!isAdmin) {
            navigate('/maintenance', { replace: true });
          }
        } catch (err) {
          // Fail secure: if check fails, redirect to maintenance
          navigate('/maintenance', { replace: true });
        }
      }

      // 2. If maintenance is INACTIVE but user is stuck on /maintenance page
      if (!config.maintenanceMode && isMaintenancePath) {
        navigate('/', { replace: true });
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

    // Deep link check for Google Ads / External Links
    const params = new URLSearchParams(location.search);
    if (params.get('start') === 'true') {
      setIsDialogOpen(true);
    }
  }, [location.pathname, location.search]);

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/services", label: "Services" },
    { to: "/work", label: "Work" },
    { to: "/about", label: "About" },
    { to: "/careers", label: "Careers" },
    { to: "/contact", label: "Contact" },
  ];

  const quickLinks = navLinks.filter(l => l.to !== "/" && l.to !== "/about");

  const mobileNavVariants: any = {
    closed: { x: "100%", opacity: 0, transition: { type: "spring", stiffness: 300, damping: 35 } },
    open: { x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 35 } }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled || isMenuOpen ? "bg-nav-fallback backdrop-blur-md border-b border-border py-4" : "py-6"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
          <Link to="/" className="text-2xl font-light tracking-tighter flex items-center gap-2 group underline-offset-8">
            <img src={config.headerLogo} alt="CortDevs" className="h-8 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>

            <div className="hidden lg:flex items-center gap-12">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-xs tracking-[0.2em] uppercase transition-colors relative group ${location.pathname === link.to ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {link.label}
                  <span className={`absolute -bottom-1 left-0 h-[1px] bg-foreground transition-all duration-300 ${location.pathname === link.to ? "w-full" : "w-0 group-hover:w-full"}`} />
                </Link>
              ))}
            <button
              onClick={() => setIsDialogOpen(true)}
              className="bg-primary text-primary-foreground px-8 py-3 text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all shadow-xl shadow-black/10"
            >
              Start Project
            </button>
          </div>

          {/* Creative Mobile Trigger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden relative z-[110] w-12 h-12 flex flex-col items-center justify-center gap-1.5 focus:outline-none group bg-primary rounded-full shadow-lg shadow-black/20"
            aria-label="Toggle Menu"
          >
            <motion.span
              animate={isMenuOpen ? { rotate: 45, y: 3.5, width: 22 } : { rotate: 0, y: 0, width: 16 }}
              className="h-[1.5px] bg-primary-foreground transition-all origin-center"
            />
            <motion.span
              animate={isMenuOpen ? { rotate: -45, y: -3.5, width: 22 } : { rotate: 0, y: 0, width: 24 }}
              className="h-[1.5px] bg-primary-foreground transition-all origin-center"
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
            className="fixed inset-0 z-[105] bg-background flex flex-col pt-24"
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
                    className={`text-5xl font-light tracking-tight transition-all hover:pl-4 transition-[padding] ${location.pathname === link.to ? "italic font-normal underline underline-offset-8 decoration-1" : "text-foreground"
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
                  className="w-full py-8 bg-primary text-primary-foreground text-sm tracking-[0.3em] uppercase font-bold hover:opacity-90 transition-all shadow-2xl shadow-black/30"
                >
                  Start Project
                </button>
              </motion.div>
            </div>

            <div className="p-12 border-t border-border grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2 font-bold">Inquiries</p>
                <a href="mailto:projects@cortdevs.com" className="text-xs font-semibold block truncate">projects@cortdevs.com</a>
              </div>
              {isNigerian && (
                <div>
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase mb-2 font-bold">WhatsApp</p>
                  <a href="https://wa.me/2348162351372" className="text-xs font-semibold">+234 816 235 1372</a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-10 lg:p-16 border-none bg-background shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)]">
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
                className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-wide hover:opacity-90 transition-colors"
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
                    className="group flex items-center gap-2 px-4 py-2 bg-secondary/10 border border-border text-xs font-bold uppercase tracking-widest text-neutral-300 hover:bg-foreground hover:text-background transition-all"
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
