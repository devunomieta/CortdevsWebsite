import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Smartphone,
  Cloud,
  Lock,
  LineChart,
  Server,
  Layers,
  Search,
  Zap,
  Cpu,
  ShieldCheck,
  Settings
} from "lucide-react";
import { SEO } from "../components/SEO";

export function Services() {
  const allServices = [
    {
      title: "UI/UX Design",
      description: "Human-centered design that balances aesthetic beauty with functional precision and intuitive user flows.",
      icon: <Layers className="w-8 h-8" />
    },
    {
      title: "SEO Optimization",
      description: "Data-driven strategies to boost your organic visibility and ensure your brand reaches the right audience.",
      icon: <Search className="w-8 h-8" />
    },
    {
      title: "Performance Tuning",
      description: "Optimizing every line of code for lightning-fast load times and seamless user experiences across all devices.",
      icon: <Zap className="w-8 h-8" />
    },
    {
      title: "Platform Management",
      description: "Holistic oversight of your digital ecosystem, ensuring stability, security, and continuous evolution.",
      icon: <Settings className="w-8 h-8" />
    },
    {
      title: "IT Team Management",
      description: "Expert leadership for your technical teams, bridging the gap between business goals and technical execution.",
      icon: <Cpu className="w-8 h-8" />
    },
    {
      title: "Technical Consultations",
      description: "Strategic advisory services to help you navigate complex technical decisions and future-proof your architecture.",
      icon: <ShieldCheck className="w-8 h-8" />
    }
  ];

  const tools = [
    { name: "React / Vite", category: "Frameworks" },
    { name: "WordPress", category: "CMS" },
    { name: "Shopify", category: "E-Commerce" },
    { name: "GoHighLevel", category: "Automation" },
    { name: "Node.js", category: "Backend" },
    { name: "PostgreSQL", category: "Database" },
    { name: "Tailwind CSS", category: "Styling" },
    { name: "AWS / Vercel", category: "Cloud" }
  ];

  return (
    <div className="bg-background text-foreground transition-colors duration-300 pt-20 lg:pt-24">
      <SEO
        title="Web Development Services | WordPress, Shopify & GHL Mastery"
        description="Elite technical solutions including Custom WordPress development, conversion-optimized Shopify stores, and advanced GHL automation."
        keywords="wordpress excellence, shopify mastery, ghl solutions, custom development, web developer, build websites"
      />
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 bg-neutral-50 border-b border-neutral-100 overflow-hidden">
        {/* Subtle decorative background element */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-neutral-100/50 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.3em] mb-8 uppercase"
            >
              PREMIUM EXECUTION
            </motion.div>

            <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-8 leading-[1.1]">
              Strategic Technical
              <span className="block mt-2 font-normal">Solutions</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl mb-12">
              We don't limit your vision to a specific toolkit. Our team selects and masterfully
              deploys the optimal technology stack tailored specifically for your project's
              unique scale, security, and performance needs.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group shadow-sm"
            >
              Discuss Your Project
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 lg:py-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
            {allServices.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="mb-8 p-4 bg-muted inline-block group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {service.icon}
                </div>
                <h3 className="text-2xl font-light mb-4 tracking-tight">{service.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm mb-6">
                  {service.description}
                </p>
                <div className="h-[1px] w-full bg-border group-hover:bg-foreground transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Section - Redesigned for Flexibility */}
      <section className="py-20 lg:py-32 bg-neutral-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-white/5 skew-x-12 translate-x-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-8">
                Technology Agnostic.
                <span className="block mt-2">Results Focused.</span>
              </h2>
              <p className="text-primary-foreground/60 leading-relaxed mb-12 max-w-lg">
                While we are masters of modern stacks like React, Node.js, and specialized platforms
                like Shopify or WordPress, our philosophy is simple: we use what works best for you.
                Whether you need military-grade security, enterprise scalability, or rapid
                go-to-market speed, we deploy the right engine for the job.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-1.5 h-1.5 bg-primary-foreground rounded-full flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/80">No vendor lock-in or tool limitations</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-1.5 h-1.5 bg-primary-foreground rounded-full flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/80">Bespoke stack selection based on project requirements</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="mt-1 w-1.5 h-1.5 bg-primary-foreground rounded-full flex-shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/80">Continuous integration of emerging technologies</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-12">
                <div className="aspect-[4/5] bg-secondary/10 flex flex-col items-center justify-center p-8 border border-primary-foreground/10 text-center">
                  <Code2 className="w-10 h-10 text-primary-foreground/30 mb-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/40">Custom Engineering</span>
                </div>
                <div className="aspect-[4/5] bg-secondary/10 flex flex-col items-center justify-center p-8 border border-primary-foreground/10 translate-y-4 text-center">
                  <Smartphone className="w-10 h-10 text-primary-foreground/30 mb-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/40">Mobile First</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="aspect-[4/5] bg-primary-foreground flex flex-col items-center justify-center p-8 border border-primary-foreground/10 text-center text-primary">
                  <Server className="w-10 h-10 mb-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Infrastructure</span>
                </div>
                <div className="aspect-[4/5] bg-secondary/10 flex flex-col items-center justify-center p-8 border border-primary-foreground/10 translate-y-4 text-center">
                  <Cloud className="w-10 h-10 text-primary-foreground/30 mb-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary-foreground/40">Scalable Cloud</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 lg:py-40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16 lg:mb-24 px-4">
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">Our Methodology</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto italic">"Precision at every step, excellence at every scale."</p>
          </div>

          <div className="space-y-12">
            {[
              { step: "01", title: "Discovery", desc: "Diving deep into your business objectives and technical requirements." },
              { step: "02", title: "Strategic Architecture", desc: "Designing a robust foundation tailored for your specific scale." },
              { step: "03", title: "Elite Development", desc: "Crafting the solution with rigorous code standards and testing." },
              { step: "04", title: "Deployment", desc: "Ensuring a seamless launch and migration to production environments." },
              {
                step: "05",
                title: "Maintenance & Evolution",
                desc: (
                  <span>
                    We offer <strong className="text-foreground font-bold italic">Basic Maintenance</strong> for essential updates, or a
                    <strong className="text-foreground font-bold italic"> Full Paid Managed Option</strong> for proactive scaling,
                    deep optimizations, and 24/7 technical priority.
                  </span>
                )
              }
            ].map((phase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col md:flex-row gap-8 md:items-center p-8 lg:p-12 border border-border bg-card hover:border-foreground transition-all group"
              >
                <span className="text-5xl lg:text-7xl font-light text-muted/30">{phase.step}</span>
                <div className="flex-1">
                  <h3 className="text-2xl lg:text-3xl font-light mb-2">{phase.title}</h3>
                  <div className="text-muted-foreground max-w-xl text-sm leading-relaxed">{phase.desc}</div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-muted/30 group-hover:text-foreground transition-colors hidden md:block" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
