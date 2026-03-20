import { motion, AnimatePresence } from "framer-motion";
import { Link, useOutletContext, useSearchParams } from "react-router";
import {
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Lock,
  Users,
  Star,
  Copy,
  Check,
  Quote,
  MessageSquarePlus
} from "lucide-react";
import { useEffect, useState } from "react";
import { ReviewForm } from "../components/ReviewForm";
import { SEO } from "../components/SEO";

export function Work() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://cortdevs.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Our Work",
        "item": "https://cortdevs.com/work"
      }
    ]
  };

  const { setIsDialogOpen } = useOutletContext<{ setIsDialogOpen: (open: boolean) => void }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    if (searchParams.get("review") === "true") {
      setShowReviewForm(true);
      // Ensure the form container is rendered and scroll into view after a short delay
      // Delay allows Layout's scroll-to-top (if any) to settle and AnimatePresence to start
      setTimeout(() => {
        const element = document.getElementById("review-form-container");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        // Clear param after scroll is initiated
        setTimeout(() => setSearchParams({}, { replace: true }), 1000);
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  const stats = [
    { label: "Projects Delivered", value: "100+" },
    { label: "Client Satisfaction", value: "99%" },
    { label: "Enterprise Clients", value: "30+" },
    { label: "Support available", value: "24/7" }
  ];

  const successStories = [
    {
      industry: "Financial Services",
      impact: "60% reduction in customer onboarding time through custom automation.",
      quote: "The technical precision and commitment to our strict security requirements were exceptional.",
      highlight: "Enterprise Integration"
    },
    {
      industry: "E-commerce Giant",
      impact: "Built a scalable multi-vendor platform handling 10k+ daily transactions.",
      quote: "Transformed our complex vision into a high-performing digital reality.",
      highlight: "Scalable Architecture"
    },
    {
      industry: "Legal Tech",
      impact: "Secure document management system with military-grade encryption.",
      quote: "Absolute trust and professionalism. They handle our data with the highest care.",
      highlight: "Security Focused"
    },
    {
      industry: "Healthcare Platform",
      impact: "HIPAA-compliant patient portal serving 50k+ active monthly users.",
      quote: "CortDevs understood the life-and-death importance of our infrastructure stability.",
      highlight: "Compliance Expert"
    },
    {
      industry: "Logistics SaaS",
      impact: "Real-time tracking system reducing delivery overhead by 22% annually.",
      quote: "A true technical partner. They don't just write code; they solve business problems.",
      highlight: "Technical Strategy"
    },
    {
      industry: "Fintech Startup",
      impact: "MVP to Market in 12 weeks, leading to a successful $15M Series A round.",
      quote: "Incredible speed without sacrificing the premium quality our investors expected.",
      highlight: "Rapid Execution"
    }
  ];

  const copyReviewLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?review=true`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-background text-foreground transition-colors duration-300 pt-20 lg:pt-24">
      <SEO
        title="Our Work | High-Impact Digital Solutions"
        description="Explore the impact CortDevs has delivered for elite clientele. From enterprise-grade security to scalable e-commerce architectures and financial automation."
        structuredData={breadcrumbSchema}
      />
      {/* Hero Section */}
      <section className="py-20 lg:py-32 bg-secondary/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-8 leading-[1.1]">
              Results That
              <span className="block mt-2 font-normal">Matter Most</span>
            </h1>
            <p className="text-lg lg:text-xl text-foreground/70 leading-relaxed max-w-2xl">
              We deliver high-impact digital solutions for industry leaders.
              While we prioritize the confidentiality of our elite clientele,
              our track record of excellence speaks for itself.
            </p>
          </motion.div>
        </div>
      </section>

      {/* NDA Section - Trust Builder */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted text-foreground text-[10px] font-bold tracking-[0.2em] mb-6 uppercase">
                <Lock className="w-3 h-3" /> CONFIDENTIALITY FIRST
              </div>
              <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-8">
                Your Privacy is Our Priority
              </h2>
              <p className="text-foreground/70 leading-relaxed mb-8 text-lg">
                Due to strict Non-Disclosure Agreements (NDAs) and the sensitive nature of
                our high-enterprise projects, we do not publicly display a detailed portfolio.
                This commitment to extreme privacy is why the world's most innovative
                companies trust us with their core technology.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <ShieldCheck className="w-5 h-5 text-foreground/40" />, text: "Strict adherence to legal & NDA requirements" },
                  { icon: <FileCheck className="w-5 h-5 text-foreground/40" />, text: "Secure handling of proprietary intellectual property" },
                  { icon: <Users className="w-5 h-5 text-foreground/40" />, text: "Vetted team members with security clearance" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 text-foreground">
                    {item.icon}
                    <span className="text-xs font-bold uppercase tracking-widest">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-primary text-primary-foreground p-12 border border-border"
            >
              <h3 className="text-2xl font-light mb-6">Request a Private Demo</h3>
              <p className="text-primary-foreground/70 mb-8 leading-relaxed">
                We are happy to showcase relevant case studies and redacted project samples
                during a private consultation, provided we verify the alignment of interests
                and respect all legal boundaries.
              </p>
              <button
                onClick={() => setIsDialogOpen(true)}
                className="w-full py-4 bg-primary-foreground text-primary text-[10px] font-bold tracking-[0.2em] uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3 group"
              >
                Schedule Private Portfolio Review
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl lg:text-5xl font-light mb-2">{stat.value}</div>
                <div className="text-[10px] font-bold text-primary-foreground/50 tracking-[0.2em] uppercase">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section id="success-stories-section" className="py-20 lg:py-32 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">Success Stories</h2>
              <p className="text-foreground/60 max-w-2xl text-lg">Real impact delivered for complex organizational challenges.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className={`inline-flex items-center gap-2 px-6 py-3 transition-all text-[10px] font-bold uppercase tracking-[0.2em] ${showReviewForm
                  ? "bg-muted text-foreground border border-border"
                  : "bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-black/10"
                  }`}
              >
                {showReviewForm ? "Close Form" : <><Star className="w-4 h-4" /> Leave a Review</>}
              </button>
              <button
                onClick={copyReviewLink}
                className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-muted transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? "Link Copied" : "Share Review Link"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showReviewForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div id="review-form-container" className="overflow-hidden mb-16">
                  <ReviewForm onComplete={() => setShowReviewForm(false)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {successStories.map((story, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 border border-border bg-card hover:bg-muted/50 hover:border-foreground transition-all group relative overflow-hidden"
              >
                <Quote className="absolute -right-4 -top-4 w-24 h-24 text-foreground/[0.03] rotate-12" />

                <div className="relative z-10">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-6 uppercase flex items-center gap-2">
                    <span className="w-4 h-[1px] bg-border" /> {story.highlight}
                  </div>

                  <h3 className="text-xl font-normal mb-4 font-bold">{story.industry}</h3>

                  <blockquote className="text-sm text-foreground/60 leading-relaxed mb-8 italic">
                    "{story.quote}"
                  </blockquote>

                  <div className="pt-6 border-t border-border">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mb-2">Primary Impact</p>
                    <p className="text-sm text-foreground font-bold leading-relaxed">
                      {story.impact}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA - Revamped for visual separation from footer */}
      <section className="relative py-20 lg:py-40 bg-secondary/30 overflow-hidden border-t border-border">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-background to-transparent opacity-60 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-block px-4 py-1 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
              Future Focused
            </div>

            <h2 className="text-4xl lg:text-7xl font-light tracking-tight mb-8 leading-tight">
              Your Project is Our <br />
              <span className="font-normal italic">Next Priority</span>
            </h2>

            <p className="text-lg text-foreground/70 mb-12 max-w-2xl mx-auto leading-relaxed">
              We are ready to build something exceptional under the highest standards
              of technical excellence and confidentiality.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="inline-flex items-center gap-3 px-12 py-5 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group shadow-xl shadow-black/10"
              >
                Start Your Journey
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <Link
                to="/contact"
                className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Inquire via Email
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
