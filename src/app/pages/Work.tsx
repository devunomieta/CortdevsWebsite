import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Work() {
  const projects = [
    {
      title: "LuxeRetail E-commerce",
      category: "Shopify Development",
      description: "Custom Shopify store for a premium fashion brand. Achieved 65% increase in conversion rate through optimized checkout flow and personalized product recommendations.",
      image: "https://images.unsplash.com/photo-1658297063569-162817482fb6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlY29tbWVyY2UlMjBvbmxpbmUlMjBzaG9wcGluZ3xlbnwxfHx8fDE3NzIxOTE2Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "65% increase in conversion rate",
        "$2.4M revenue in first 6 months",
        "Average order value up 40%"
      ],
      tech: ["Shopify Plus", "Custom Theme", "Klaviyo", "Yotpo"]
    },
    {
      title: "TechVentures Corporate Site",
      category: "WordPress Development",
      description: "Enterprise WordPress solution with custom CMS for a global technology consulting firm. Multi-language support across 12 countries with centralized content management.",
      image: "https://images.unsplash.com/photo-1586202690666-e1f32e218afe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjB0ZWNoJTIwbWluaW1hbHxlbnwxfHx8fDE3NzIxOTE2NjV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "200% increase in organic traffic",
        "Sub-2s page load times globally",
        "50% reduction in content update time"
      ],
      tech: ["WordPress Multisite", "ACF Pro", "WPML", "AWS CloudFront"]
    },
    {
      title: "HealthFirst Patient Portal",
      category: "Custom Development",
      description: "HIPAA-compliant patient portal built with React and Node.js. Secure appointment scheduling, medical records access, and telehealth integration serving 50,000+ patients.",
      image: "https://images.unsplash.com/photo-1554306274-f23873d9a26c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b20lMjBzb2Z0d2FyZSUyMGRldmVsb3BtZW50fGVufDF8fHx8MTc3MjE4OTQzMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "50,000+ active users",
        "99.97% uptime achieved",
        "30% reduction in phone inquiries"
      ],
      tech: ["React", "Node.js", "PostgreSQL", "AWS", "HIPAA Compliance"]
    },
    {
      title: "PropelAgency Automation",
      category: "GoHighLevel",
      description: "Complete marketing automation system for a digital agency managing 200+ clients. Automated lead nurturing, appointment booking, and client reporting.",
      image: "https://images.unsplash.com/photo-1759884247144-53d52c31f859?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwY3JlYXRpdmUlMjB0ZWFtJTIwY29sbGFib3JhdGlvbnxlbnwxfHx8fDE3NzIxOTE2Njd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "85% time saved on client onboarding",
        "300% increase in qualified leads",
        "Client retention up to 94%"
      ],
      tech: ["GoHighLevel", "Zapier", "Stripe", "Twilio"]
    },
    {
      title: "GourmetDirect Marketplace",
      category: "Custom Development",
      description: "Multi-vendor marketplace connecting artisan food producers with consumers. Real-time inventory, vendor dashboards, and automated order fulfillment.",
      image: "https://images.unsplash.com/photo-1637937459053-c788742455be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWIlMjBkZXZlbG9wbWVudCUyMGNvZGluZyUyMHNjcmVlbnxlbnwxfHx8fDE3NzIxMTgzNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "150+ active vendors",
        "$1.8M GMV in first year",
        "Average 4.9/5 customer rating"
      ],
      tech: ["Next.js", "Python/Django", "Stripe Connect", "Redis"]
    },
    {
      title: "UrbanFit Membership Platform",
      category: "WordPress + Custom",
      description: "Hybrid WordPress and custom React application for boutique fitness studio chain. Integrated class booking, membership management, and e-commerce.",
      image: "https://images.unsplash.com/photo-1764410481612-7544525b2991?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBvZmZpY2UlMjBkZXNrJTIwZXhlY3V0aXZlfGVufDF8fHx8MTc3MjE5MTY2Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      results: [
        "10,000+ monthly bookings",
        "40% increase in membership renewals",
        "Automated 90% of admin tasks"
      ],
      tech: ["WordPress", "React", "WooCommerce", "Mindbody API"]
    }
  ];

  const testimonials = [
    {
      quote: "ApexDigital transformed our vision into a world-class e-commerce platform that exceeded every expectation. The attention to detail and commitment to our success has been remarkable.",
      author: "Sarah Chen",
      role: "CEO, LuxeRetail",
      company: "LuxeRetail"
    },
    {
      quote: "Working with ApexDigital felt like having an extended in-house team. Their technical expertise and strategic insights helped us achieve results we didn't think were possible.",
      author: "Michael Roberts",
      role: "CTO, TechVentures",
      company: "TechVentures"
    },
    {
      quote: "The custom solution ApexDigital built has become the backbone of our patient care delivery. Reliable, secure, and exactly what we needed.",
      author: "Dr. Jennifer Park",
      role: "Chief Medical Officer, HealthFirst",
      company: "HealthFirst"
    }
  ];

  return (
    <div className="bg-white pt-20 lg:pt-24">
      {/* Hero */}
      <section className="py-20 lg:py-32 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-6 leading-[1.1]">
              Work That Speaks
              <span className="block mt-2">For Itself</span>
            </h1>
            <p className="text-lg lg:text-xl text-neutral-600 leading-relaxed">
              Explore our portfolio of successful projects across industries and platforms. 
              Each one represents a partnership, a challenge overcome, and measurable results delivered.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Projects */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="space-y-32">
            {projects.map((project, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                  index % 2 === 1 ? 'lg:grid-flow-dense' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <div className="inline-block px-3 py-1 bg-neutral-100 text-xs tracking-wider mb-4">
                    {project.category.toUpperCase()}
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">
                    {project.title}
                  </h2>
                  <p className="text-neutral-600 leading-relaxed mb-8">
                    {project.description}
                  </p>

                  <div className="mb-8">
                    <h3 className="text-sm tracking-wider text-neutral-400 mb-4">KEY RESULTS</h3>
                    <ul className="space-y-3">
                      {project.results.map((result, idx) => (
                        <li key={idx} className="flex items-center gap-3 text-sm">
                          <div className="w-1.5 h-1.5 bg-black rounded-full flex-shrink-0" />
                          {result}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mb-8">
                    <h3 className="text-sm tracking-wider text-neutral-400 mb-4">TECHNOLOGIES</h3>
                    <div className="flex flex-wrap gap-2">
                      {project.tech.map((tech, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 border border-neutral-300 text-xs"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 text-sm tracking-wide hover:gap-4 transition-all group"
                  >
                    Start Similar Project <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className={index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}>
                  <div className="aspect-[4/3] relative overflow-hidden group">
                    <ImageWithFallback
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 lg:py-32 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Client Success Stories
            </h2>
            <p className="text-lg text-neutral-400 max-w-3xl mx-auto">
              Don't just take our word for it—hear from the businesses we've helped transform.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="border border-neutral-800 p-8"
              >
                <p className="text-neutral-300 leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div>
                  <div className="font-light">{testimonial.author}</div>
                  <div className="text-sm text-neutral-500">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Results That Matter
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              Numbers that demonstrate our commitment to delivering exceptional outcomes.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {[
              { number: "150+", label: "Projects Completed" },
              { number: "98%", label: "Client Satisfaction" },
              { number: "$50M+", label: "Revenue Generated" },
              { number: "45", label: "Countries Served" }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl lg:text-5xl font-light mb-3">{stat.number}</div>
                <div className="text-sm text-neutral-600 tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-32 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">
              Your Project Could Be Next
            </h2>
            <p className="text-lg text-neutral-600 mb-12 leading-relaxed">
              Whether you need a WordPress site, Shopify store, GHL automation, or custom development—
              we're ready to deliver results that exceed your expectations.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white tracking-wide hover:bg-neutral-800 transition-all group"
            >
              Let's Create Something Amazing
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
