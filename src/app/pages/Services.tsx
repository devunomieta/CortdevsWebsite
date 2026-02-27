import { motion } from "motion/react";
import { Link } from "react-router";
import { 
  ArrowRight, 
  Code2, 
  ShoppingCart, 
  Workflow, 
  Layers,
  CheckCircle2,
  Zap,
  Lock,
  BarChart3,
  Palette,
  Database,
  Globe,
  Smartphone,
  Search,
  Gauge
} from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

export function Services() {
  const mainServices = [
    {
      icon: <Code2 className="w-8 h-8" />,
      title: "WordPress Development",
      tagline: "The world's most powerful CMS, tailored to perfection",
      description: "WordPress powers 43% of the web, and for good reason. We harness its full potential to create custom solutions that are beautiful, fast, and incredibly easy to manage. Whether you need a corporate website, blog, or complex web application, our WordPress expertise delivers.",
      image: "https://images.unsplash.com/photo-1637937459053-c788742455be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWIlMjBkZXZlbG9wbWVudCUyMGNvZGluZyUyMHNjcmVlbnxlbnwxfHx8fDE3NzIxMTgzNjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      features: [
        "Custom Theme Development - Pixel-perfect designs that reflect your brand",
        "Plugin Development & Integration - Extend functionality seamlessly",
        "Performance Optimization - Lightning-fast load times guaranteed",
        "WooCommerce Solutions - Complete e-commerce integration",
        "Multisite Architecture - Manage multiple sites from one dashboard",
        "Headless WordPress - Modern React/Next.js frontends with WordPress backend",
        "SEO Optimization - Built-in best practices for maximum visibility",
        "Security Hardening - Enterprise-grade protection"
      ],
      benefits: [
        "Content editing so simple, your entire team can use it",
        "99.9% uptime with our hosting partners",
        "Average 40% improvement in page load speed",
        "Unlimited scalability as your business grows"
      ]
    },
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: "Shopify Solutions",
      tagline: "E-commerce excellence that converts browsers into buyers",
      description: "Your Shopify store is more than a shop—it's your revenue engine. We create conversion-optimized stores that not only look stunning but are engineered to maximize sales. From custom themes to advanced integrations, we build Shopify experiences that your customers will love and your accountant will appreciate.",
      image: "https://images.unsplash.com/photo-1658297063569-162817482fb6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlY29tbWVyY2UlMjBvbmxpbmUlMjBzaG9wcGluZ3xlbnwxfHx8fDE3NzIxOTE2Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      features: [
        "Custom Shopify Theme Design - Unique, brand-aligned shopping experiences",
        "Shopify Plus Development - Enterprise features for high-volume stores",
        "App Integration - Connect your entire business ecosystem",
        "Conversion Rate Optimization - Data-driven improvements to boost sales",
        "Custom Checkout Experiences - Reduce cart abandonment",
        "Inventory Management - Seamless multi-channel synchronization",
        "Payment Gateway Integration - Support for all major payment methods",
        "Migration Services - Smooth transition from any platform"
      ],
      benefits: [
        "Average 35% increase in conversion rates",
        "Mobile-first designs that convert on every device",
        "Automated workflows save 20+ hours per week",
        "Built-in analytics to track every sale metric"
      ]
    },
    {
      icon: <Workflow className="w-8 h-8" />,
      title: "GoHighLevel Integration",
      tagline: "All-in-one business automation that works while you sleep",
      description: "GoHighLevel is the Swiss Army knife of business automation. We implement and customize GHL to streamline your marketing, sales, and operations. From sophisticated sales funnels to automated customer journeys, we help you leverage this powerful platform to scale your business efficiently.",
      image: "https://images.unsplash.com/photo-1759884247144-53d52c31f859?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwY3JlYXRpdmUlMjB0ZWFtJTIwY29sbGFib3JhdGlvbnxlbnwxfHx8fDE3NzIxOTE2Njd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      features: [
        "Sales Funnel Development - High-converting funnels that nurture leads",
        "CRM Customization - Tailored workflows for your sales process",
        "Marketing Automation - Intelligent campaigns that run on autopilot",
        "Website & Landing Pages - Professional pages built within GHL",
        "SMS & Email Campaigns - Multi-channel communication strategies",
        "Calendar & Booking Systems - Automated appointment scheduling",
        "Pipeline Management - Visual sales tracking and optimization",
        "White-Label Solutions - For agencies serving their own clients"
      ],
      benefits: [
        "Consolidate 5+ tools into one platform",
        "Save $500-2000/month on software costs",
        "Automate 80% of repetitive marketing tasks",
        "Increase lead response time by 90%"
      ]
    },
    {
      icon: <Layers className="w-8 h-8" />,
      title: "Custom Full-Stack Development",
      tagline: "When off-the-shelf won't cut it, we build from scratch",
      description: "Some visions require custom solutions. Our full-stack development team creates bespoke web applications engineered precisely to your specifications. Using cutting-edge technologies like React, Node.js, Python, and cloud infrastructure, we build scalable, secure, and sophisticated systems that give you a competitive advantage.",
      image: "https://images.unsplash.com/photo-1554306274-f23873d9a26c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXN0b20lMjBzb2Z0d2FyZSUyMGRldmVsb3BtZW50fGVufDF8fHx8MTc3MjE4OTQzMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
      features: [
        "React/Next.js Applications - Modern, lightning-fast user interfaces",
        "Node.js Backend Development - Scalable server-side architecture",
        "Python/Django Solutions - Robust enterprise applications",
        "RESTful & GraphQL APIs - Seamless third-party integrations",
        "Cloud Infrastructure - AWS, Google Cloud, Azure deployment",
        "Database Design - PostgreSQL, MongoDB, Redis optimization",
        "Real-time Features - WebSocket implementation for live updates",
        "Microservices Architecture - Modular, maintainable systems"
      ],
      benefits: [
        "100% ownership of your codebase",
        "Designed to scale from 100 to 100,000+ users",
        "Built with modern best practices and security standards",
        "Ongoing support and feature development"
      ]
    }
  ];

  const additionalServices = [
    {
      icon: <Palette className="w-6 h-6" />,
      title: "UI/UX Design",
      description: "Beautiful interfaces that users love to interact with"
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Database Architecture",
      description: "Optimized data structures for performance and scalability"
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: "API Development",
      description: "Robust APIs that power seamless integrations"
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Responsive Design",
      description: "Flawless experiences across all devices and screen sizes"
    },
    {
      icon: <Search className="w-6 h-6" />,
      title: "SEO Optimization",
      description: "Technical SEO that gets you found by your ideal customers"
    },
    {
      icon: <Gauge className="w-6 h-6" />,
      title: "Performance Tuning",
      description: "Speed optimization for maximum user engagement"
    }
  ];

  const process = [
    {
      number: "01",
      title: "Discovery & Strategy",
      description: "We dive deep into your business, goals, and target audience to craft the perfect strategy."
    },
    {
      number: "02",
      title: "Design & Planning",
      description: "Beautiful designs and detailed technical planning ensure we're aligned before development begins."
    },
    {
      number: "03",
      title: "Development & Testing",
      description: "Agile development sprints with continuous testing to ensure quality at every stage."
    },
    {
      number: "04",
      title: "Launch & Support",
      description: "Smooth deployment and ongoing support to ensure your continued success."
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
              Services That Drive
              <span className="block mt-2">Real Results</span>
            </h1>
            <p className="text-lg lg:text-xl text-neutral-600 leading-relaxed mb-12">
              From industry-leading platforms to custom-built solutions, we deliver 
              web development services that transform your business. Every project is 
              crafted with precision, powered by expertise, and driven by results.
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-white">
                <Zap className="w-4 h-4" />
                Fast Delivery
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white">
                <Lock className="w-4 h-4" />
                Secure & Scalable
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white">
                <BarChart3 className="w-4 h-4" />
                ROI-Focused
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Services */}
      {mainServices.map((service, index) => (
        <section key={index} className={`py-20 lg:py-32 ${index % 2 === 1 ? 'bg-neutral-50' : ''}`}>
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
              index % 2 === 1 ? 'lg:grid-flow-dense' : ''
            }`}>
              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={index % 2 === 1 ? 'lg:col-start-2' : ''}
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-black text-white mb-6">
                  {service.icon}
                </div>
                <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-4">
                  {service.title}
                </h2>
                <p className="text-lg text-neutral-500 mb-6 italic">
                  {service.tagline}
                </p>
                <p className="text-neutral-600 leading-relaxed mb-8">
                  {service.description}
                </p>

                <div className="space-y-6 mb-8">
                  <h3 className="text-sm tracking-wider text-neutral-400">WHAT'S INCLUDED</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span className="text-neutral-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-neutral-900 text-white p-6 mb-8">
                  <h3 className="text-sm tracking-wider mb-4 text-neutral-400">KEY BENEFITS</h3>
                  <ul className="space-y-2 text-sm">
                    {service.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-white rounded-full" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white text-sm tracking-wide hover:bg-neutral-800 transition-colors group"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: index % 2 === 0 ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <ImageWithFallback
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      ))}

      {/* Additional Services */}
      <section className="py-20 lg:py-32 bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Complete Digital Solutions
            </h2>
            <p className="text-lg text-neutral-400 max-w-3xl mx-auto">
              Beyond our core services, we offer comprehensive support for every aspect 
              of your digital presence.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {additionalServices.map((service, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="border border-neutral-800 p-6 hover:border-white transition-colors"
              >
                <div className="mb-4">{service.icon}</div>
                <h3 className="text-xl font-light mb-2">{service.title}</h3>
                <p className="text-sm text-neutral-400">{service.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Our Process
            </h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              A proven methodology that ensures quality, efficiency, and exceptional results.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {process.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-light text-neutral-200 mb-4">{step.number}</div>
                <h3 className="text-xl font-light mb-3">{step.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{step.description}</p>
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
              Let's Build Something Extraordinary
            </h2>
            <p className="text-lg text-neutral-600 mb-12 leading-relaxed">
              Every great project starts with a conversation. Share your vision, 
              and we'll show you how we can bring it to life.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white tracking-wide hover:bg-neutral-800 transition-all group"
            >
              Schedule Your Consultation
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
