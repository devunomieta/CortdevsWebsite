import { Link, useOutletContext } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Zap, Shield, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { Preloader } from "../components/Preloader";
import { SEO } from "../components/SEO";

export function Home() {
  const { setIsDialogOpen } = useOutletContext<{ setIsDialogOpen: (open: boolean) => void }>();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "CortDevs",
    "url": "https://cortdevs.com",
    "logo": "https://cortdevs.com/logo.png",
    "sameAs": [
      "https://linkedin.com/company/cortdevs",
      "https://twitter.com/cortdevs"
    ],
    "description": "Premium web development agency specializing in WordPress, Shopify, GHL, and custom solutions."
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const services = [
    {
      title: "WordPress Excellence",
      description: "Custom WordPress solutions built for performance, scalability, and seamless content management.",
      features: ["Custom Theme Development", "Plugin Integration", "Performance Optimization"]
    },
    {
      title: "Shopify Mastery",
      description: "Transform your e-commerce vision into reality with conversion-optimized Shopify stores.",
      features: ["Custom Store Design", "App Integration", "Revenue Optimization"]
    },
    {
      title: "GHL Solutions",
      description: "Leverage GoHighLevel to automate your business and create powerful customer journeys.",
      features: ["Funnel Building", "CRM Integration", "Marketing Automation"]
    },
    {
      title: "Custom Development",
      description: "Full-stack solutions engineered precisely to your specifications with cutting-edge technology.",
      features: ["Scalable Architecture", "API Development", "Advanced Integrations"]
    }
  ];

  const stats = [
    { number: "100+", label: "Projects Delivered" },
    { number: "99%", label: "Client Satisfaction" },
    { number: "30+", label: "Enterprise Clients" },
    { number: "24/7", label: "Support available" }
  ];

  const whyChoose = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lightning Fast Delivery",
      description: "We respect your timeline. Our agile methodology ensures rapid development without compromising quality."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Enterprise-Grade Security",
      description: "Your data and your customers' data are paramount. We implement industry-leading security protocols."
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Scalable Solutions",
      description: "Built to grow with you. Our architecture supports your expansion from startup to enterprise."
    }
  ];

  return (
    <div className="bg-background text-foreground transition-colors duration-300">
      <SEO
        title="Premium Web Solutions | WordPress, Shopify, GHL & Custom Apps"
        description="CortDevs delivers elite web development services. From custom WordPress and Shopify stores to GHL automations and full-stack applications."
        structuredData={organizationSchema}
      />
      <Preloader />
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 lg:pt-24">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 to-white" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div {...fadeInUp}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-block px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.3em] mb-8"
              >
                PREMIUM WEB SOLUTIONS
              </motion.div>

              <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-8 leading-[1.1]">
                Elevate Your
                <span className="block mt-2">Digital Presence</span>
              </h1>

              <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-12 max-w-xl">
                We craft exceptional digital experiences that drive results.
                From WordPress to custom full-stack solutions, we transform
                your vision into reality with precision and elegance.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setIsDialogOpen(true)}
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group"
                >
                  Start Your Project
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <Link
                  to="/work"
                  className="inline-flex items-center justify-center gap-3 px-8 py-5 border border-border text-foreground tracking-widest text-[10px] font-bold uppercase hover:bg-muted transition-colors"
                >
                  View Our Work
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="relative"
            >
              <div className="aspect-[4/3] relative overflow-hidden">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1586202690666-e1f32e218afe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIxOTE2NjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                  alt="Modern workspace"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-white p-8 shadow-2xl hidden lg:block">
                <div className="text-4xl font-light mb-2">100+</div>
                <div className="text-sm text-neutral-600 tracking-wide">Projects Delivered</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 lg:py-32 bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl lg:text-5xl font-light mb-3">{stat.number}</div>
                <div className="text-xs lg:text-sm text-primary-foreground/60 tracking-[0.2em] uppercase font-bold">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 lg:mb-24"
          >
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">
              Our Expertise
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Comprehensive web development services tailored to your business needs.
              We combine technical excellence with strategic thinking.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {services.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="border border-border p-8 lg:p-10 hover:border-foreground transition-all duration-300 h-full bg-card">
                  <h3 className="text-2xl lg:text-3xl font-light mb-4 tracking-tight">
                    {service.title}
                  </h3>
                  <p className="text-neutral-600 leading-relaxed mb-6">
                    {service.description}
                  </p>
                  <ul className="space-y-3">
                    {service.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm text-neutral-700">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/services"
              className="inline-flex items-center gap-2 text-sm tracking-wide hover:gap-4 transition-all"
            >
              Explore All Services <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 lg:py-32 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 lg:mb-24"
          >
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">
              The CortDevs Difference
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              We don't just build websites—we create digital assets that drive business growth
              and deliver measurable ROI.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-16">
            {whyChoose.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary text-primary-foreground mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl lg:text-2xl font-light mb-4 tracking-tight">
                  {item.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Product: Sirona */}
      <section className="py-20 lg:py-32 relative overflow-hidden bg-neutral-950 text-white border-t border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_800px_at_100%_200px,rgba(99,102,241,0.08),transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-7">
              <div className="inline-block px-3 py-1 bg-white/10 text-white text-[9px] font-bold tracking-[0.3em] uppercase mb-6 rounded-full">
                Featured Product
              </div>
              <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-8 leading-[1.1]">
                Sirona: Smart School
                <span className="block mt-2 font-normal text-indigo-400">Management System</span>
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed mb-8">
                A complete, secure, web-based platform tailored for Nigerian schools to automate 
                administrative duties, fee collections, classrooms, grading (CA & Exams), 
                and parent-teacher engagement. Minimize human errors, eliminate paperwork, 
                and save significant administrative costs.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Fees & Online Payments</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Automated bank updates and digital receipts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Academics & Reports</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Continuous assessment, report cards, timetables.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">User Portals</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Dedicated access for Admin, Teachers, Parents, Students.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-1 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Zero Setup Fee</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Free deployment & no system charges for the first year.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  to="/sirona"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4.5 bg-indigo-600 text-white tracking-widest text-[10px] font-bold uppercase hover:bg-indigo-500 transition-all group"
                >
                  Explore Sirona System
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            
            <div className="lg:col-span-5 relative">
              <div className="aspect-[4/3] bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent mix-blend-overlay" />
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2hvb2wlMjBtYW5hZ2VtZW50JTIwdGVjaHxlbnwxfHx8fDE3NzIxOTE2NjV8MA&ixlib=rb-4.1.0&q=80&w=640"
                  alt="Sirona Smart School Platform dashboard mockup"
                  className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground mb-12 leading-relaxed">
              Let's discuss your project and explore how we can help you achieve your digital goals.
              Schedule a consultation today—no obligations, just possibilities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group"
              >
                Schedule Consultation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                to="/contact#faq"
                className="inline-flex items-center justify-center gap-3 px-10 py-5 border border-border text-foreground tracking-widest text-[10px] font-bold uppercase hover:bg-muted transition-colors"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
