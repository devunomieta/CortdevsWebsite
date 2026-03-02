import { useState } from "react";
import { motion } from "framer-motion";
import {
  Send,
  CheckCircle2,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Zap,
  Shield,
  TrendingUp
} from "lucide-react";
import { ContactForm } from "../components/ContactForm";

import { useConfig } from "../context/ConfigContext";

export function Contact() {
  const { isNigerian } = useConfig();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const benefits = [
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Rapid Response",
      description: "We respond to all inquiries within 24 hours"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "NDA Available",
      description: "Your ideas and data are completely protected"
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: "Free Consultation",
      description: "No-obligation discovery call to explore possibilities"
    }
  const contactMethods = [
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Email Us",
      detail: "projects@cortdevs.com / cortdevs@gmail.com",
      description: "For detailed service inquiries"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Schedule Call",
      detail: "Calendly Booking",
      description: "Automated meeting scheduling",
      link: "https://calendly.com/cortdevs"
    },
    ...(isNigerian ? [
      {
        icon: <Phone className="w-6 h-6" />,
        title: "Call Us",
        detail: "+234 816 235 1372 / +234 704 989 8962",
        description: "Standard business hours"
      },
      {
        icon: <MessageSquare className="w-6 h-6" />,
        title: "Live Chat",
        detail: "WhatsApp Support",
        description: "Instant response via DM",
        link: "https://wa.me/2348162351372"
      }
    ] : [])
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
              Let's Start Your
              <span className="block mt-2">Success Story</span>
            </h1>
            <p className="text-lg lg:text-xl text-neutral-600 leading-relaxed mb-8">
              Every exceptional project begins with a conversation. Share your vision,
              challenges, and goals—we'll show you exactly how we can help you achieve them.
            </p>
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 px-4 py-2 bg-white">
                  {benefit.icon}
                  <span>{benefit.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
            {/* Form */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">
                Tell Us About Your Project
              </h2>
              <p className="text-neutral-600 leading-relaxed mb-8">
                The more details you share, the better we can tailor our approach to your needs.
                All information is confidential and protected.
              </p>

              {isSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-50 border border-green-200 p-8 text-center"
                >
                  <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-light mb-2">Thank You!</h3>
                  <p className="text-neutral-600">
                    We've received your inquiry and will respond within 24 hours.
                    Check your email for confirmation.
                  </p>
                </motion.div>
              ) : (
                <ContactForm />
              )}
            </motion.div>

            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="lg:sticky lg:top-32">
                <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-4">
                  Get In Touch
                </h2>
                <p className="text-neutral-600 leading-relaxed mb-12">
                  Prefer a different way to connect? We're here and ready to help.
                </p>

                <div className="space-y-8 mb-12">
                  {contactMethods.map((method, index) => {
                    const CardContent = (
                      <div className="flex gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 ${(method as any).urgent ? "bg-red-600 shadow-lg shadow-red-200" : "bg-black"} text-white flex items-center justify-center`}>
                          {method.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-light">{method.title}</h3>
                            {(method as any).urgent && (
                              <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 font-bold uppercase tracking-tighter rounded-full animate-pulse">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-sm mb-1">{method.detail}</p>
                          <p className="text-xs text-neutral-500">{method.description}</p>
                        </div>
                      </div>
                    );

                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                      >
                        {method.link ? (
                          <a
                            href={method.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block hover:translate-x-1 transition-transform"
                          >
                            {CardContent}
                          </a>
                        ) : (
                          CardContent
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="bg-neutral-900 text-white p-8">
                  <h3 className="text-xl font-light mb-4">What Happens Next?</h3>
                  <ol className="space-y-4 text-sm">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-white text-black flex items-center justify-center text-xs">
                        1
                      </span>
                      <span className="text-neutral-300">
                        We'll review your inquiry and respond within 24 hours
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-white text-black flex items-center justify-center text-xs">
                        2
                      </span>
                      <span className="text-neutral-300">
                        Schedule a discovery call to dive deep into your needs
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-white text-black flex items-center justify-center text-xs">
                        3
                      </span>
                      <span className="text-neutral-300">
                        Receive a detailed proposal with timeline and pricing
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-white text-black flex items-center justify-center text-xs">
                        4
                      </span>
                      <span className="text-neutral-300">
                        Kick off your project with our dedicated team
                      </span>
                    </li>
                  </ol>
                </div>

                {isNigerian && (
                  <div className="mt-8 bg-neutral-50 p-6 border-l-4 border-black">
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      <strong className="font-normal">Urgent project?</strong> Call us directly at
                      <span className="block mt-1">+2348156841952</span>
                      and we'll prioritize your inquiry.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 lg:py-32 bg-neutral-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">
              Common Questions
            </h2>
            <p className="text-lg text-neutral-600">
              Quick answers to help you get started faster.
            </p>
          </motion.div>

          <div className="space-y-6">
            {[
              {
                q: "How quickly can we start?",
                a: "Most projects can begin within 1-2 weeks of contract signing. For urgent needs, we offer expedited onboarding with dedicated team allocation."
              },
              {
                q: "Do you work with international clients?",
                a: "Absolutely. We've delivered projects across 45+ countries and are experienced in managing different time zones, currencies, and communication preferences."
              },
              {
                q: "What's your typical project timeline?",
                a: "It varies by scope. A WordPress site typically takes 4-8 weeks, Shopify stores 6-10 weeks, and custom applications 3-6 months. We'll provide a detailed timeline in your proposal."
              },
              {
                q: "Do you offer ongoing support?",
                a: "Yes. All projects include a warranty period, and we offer flexible monthly retainers for ongoing maintenance, updates, and feature development."
              },
              {
                q: "What if I'm not sure what I need?",
                a: "That's exactly what our discovery call is for. We'll help you define requirements, recommend the best approach, and create a roadmap to success."
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white p-6 border border-neutral-200"
              >
                <h3 className="font-light mb-2">{faq.q}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
