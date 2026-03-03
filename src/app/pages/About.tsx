import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  ArrowRight,
  Award,
  Users,
  Target,
  Heart,
  Clock,
  Shield,
  TrendingUp,
  Lightbulb
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { SEO } from "../components/SEO";

export function About() {
  const aboutPageSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "Organization",
      "name": "CortDevs",
      "description": "Elite digital agency specializing in premium web development, WordPress, Shopify, and custom solutions.",
      "url": "https://cortdevs.com/about"
    }
  };

  const values = [
    {
      icon: <Award className="w-6 h-6" />,
      title: "Excellence",
      description: "We don't do 'good enough.' Every line of code, every pixel, every interaction is crafted to the highest standards."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Partnership",
      description: "Your success is our success. We work as an extension of your team, deeply invested in your goals."
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: "Results-Driven",
      description: "Beautiful design means nothing without performance. We measure success in conversions, engagement, and ROI."
    },
    {
      icon: <Heart className="w-6 h-6" />,
      title: "Integrity",
      description: "Honest timelines, transparent pricing, and clear communication. No surprises, just solid partnership."
    }
  ];

  const expertise = [
    {
      title: "Deep Technical Expertise",
      description: "Our team comprises senior developers with 10+ years average experience across multiple stacks and industries.",
      stats: ["10+ years experience", "50+ technologies mastered", "100+ Projects Delivered"]
    },
    {
      title: "Strategic Technical Execution",
      description: "We don't just build features; we engineer business solutions with a focus on long-term scalability and performance.",
      stats: ["Agile-driven delivery", "Cloud-native architecture", "Zero technical debt"]
    },
    {
      title: "Enterprise-Grade Quality",
      description: "We bring Fortune 500-level standards to businesses of all sizes, ensuring quality you can trust.",
      stats: ["24/7 Support available", "Enterprise security", "ISO compliance ready"]
    }
  ];

  const whyNow = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Time is Money",
      description: "Every day without an optimized digital presence is lost revenue. Our rapid deployment gets you to market faster."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Future-Proof Technology",
      description: "We build with tomorrow in mind. Scalable architecture that adapts as your business evolves."
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Competitive Advantage",
      description: "In today's digital landscape, your website is your competitive edge. We make sure you stand out."
    },
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: "Innovation-First Mindset",
      description: "We stay ahead of trends and technology, bringing cutting-edge solutions to every project."
    }
  ];

  const team = [
    {
      role: "Full-Stack Development",
      description: "Senior engineers specialized in React, Node.js, Python, and modern frameworks."
    },
    {
      role: "UI/UX Design",
      description: "Award-winning designers who understand both aesthetics and conversion psychology."
    },
    {
      role: "Platform Specialists",
      description: "Certified experts in WordPress, Shopify, and GoHighLevel platforms."
    },
    {
      role: "DevOps & Infrastructure",
      description: "Cloud architects ensuring your applications are fast, secure, and scalable."
    },
    {
      role: "Project Management",
      description: "Agile-certified PMs who keep projects on track and stakeholders informed."
    },
    {
      role: "Quality Assurance",
      description: "Meticulous testing across all devices, browsers, and scenarios."
    }
  ];

  return (
    <div className="bg-white pt-20 lg:pt-24">
      <SEO
        title="About CortDevs | Elite Digital Agency"
        description="Learn about CortDevs, a premium web development agency. We combine artistry with human-centric engineering to deliver high-performance digital solutions."
        structuredData={aboutPageSchema}
      />
      {/* Hero */}
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
              className="inline-block px-4 py-2 bg-black text-white text-xs tracking-widest mb-8"
            >
              OUR STORY
            </motion.div>

            <h1 className="text-5xl lg:text-7xl font-light tracking-tight mb-8 leading-[1.1] text-black">
              Where Craft Meets
              <span className="block mt-2 font-normal">Execution</span>
            </h1>
            <p className="text-lg lg:text-xl text-neutral-600 leading-relaxed mb-12">
              CortDevs was founded on a simple belief: exceptional web development
              should be accessible to businesses of all sizes. We combine the artistry
              of premium design with the science of human-centric engineering to create
              digital experiences that don't just look good—they perform.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-neutral-600 text-sm leading-relaxed">
              <p>
                Since our inception, we've partnered with startups, scale-ups, and
                established enterprises across the globe, delivering solutions that drive
                measurable growth. From sleek WordPress sites to complex custom applications,
                our commitment to excellence remains unwavering.
              </p>
              <p>
                Every project we undertake is a fusion of strategic foresight and technical
                precision. We don't just build sites; we craft the digital foundations upon
                which our clients build their future legacies.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-32 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Our Core Values
            </h2>
            <p className="text-lg text-neutral-400 max-w-3xl mx-auto">
              The principles that guide every decision, every project, every client relationship.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 border border-white mb-6">
                  {value.icon}
                </div>
                <h3 className="text-xl font-light mb-3">{value.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Expertise */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Why Top Brands Trust Us
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              Excellence isn't claimed—it's demonstrated through consistent delivery and measurable results.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {expertise.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="border border-neutral-200 p-8"
              >
                <h3 className="text-2xl font-light mb-4 tracking-tight">{item.title}</h3>
                <p className="text-neutral-600 leading-relaxed mb-6">{item.description}</p>
                <div className="space-y-3">
                  {item.stats.map((stat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-1 h-1 bg-black rounded-full" />
                      {stat}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 lg:py-32 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              The Team Behind Your Success
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto leading-relaxed">
              A carefully assembled team of specialists, each a master of their craft.
              When you work with CortDevs, you get the collective expertise of industry veterans.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 border border-neutral-200"
              >
                <h3 className="text-lg font-light mb-3">{member.role}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{member.description}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <p className="text-neutral-600 mb-6">
              Every project is assigned a dedicated team with the exact expertise needed for your success.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 text-sm tracking-wide hover:gap-4 transition-all"
            >
              Meet Your Team <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Why Now */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Why Start Now?
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              The digital landscape waits for no one. Here's why leading businesses
              are investing in premium web solutions today.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {whyNow.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6"
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-black text-white flex items-center justify-center">
                    {item.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-light mb-3">{item.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Parent Company Section */}
      <section className="py-20 lg:py-32 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center text-sm text-neutral-500">
          <p className="leading-relaxed">
            CortDevs proudly operates as the dedicated technical and development subsidiary of
            <strong className="text-black font-medium ml-1">HachStacks Technologies</strong>.
            This strategic partnership allows us to leverage deep enterprise insights while
            delivering specialized, high-performance digital crafting.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl lg:text-6xl font-light tracking-tight mb-6">
              Ready to Experience the Difference?
            </h2>
            <p className="text-lg text-neutral-600 mb-12 leading-relaxed">
              Join the hundreds of businesses that have transformed their digital presence
              with CortDevs. Let's start your success story today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-black text-white tracking-wide hover:bg-neutral-800 transition-all group"
              >
                Start Your Project
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/work"
                className="inline-flex items-center justify-center gap-3 px-10 py-5 border border-neutral-300 text-black tracking-wide hover:border-black transition-colors"
              >
                View Our Work
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
