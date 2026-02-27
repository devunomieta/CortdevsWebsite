import { useState } from "react";
import { motion } from "motion/react";
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

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    service: "",
    budget: "",
    timeline: "",
    message: ""
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate form submission
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        service: "",
        budget: "",
        timeline: "",
        message: ""
      });
    }, 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const services = [
    "WordPress Development",
    "Shopify Solutions",
    "GoHighLevel Integration",
    "Custom Full-Stack Development",
    "UI/UX Design",
    "Consulting",
    "Other"
  ];

  const budgets = [
    "Under $10,000",
    "$10,000 - $25,000",
    "$25,000 - $50,000",
    "$50,000 - $100,000",
    "$100,000+"
  ];

  const timelines = [
    "ASAP",
    "1-2 months",
    "3-6 months",
    "6+ months",
    "Flexible"
  ];

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
  ];

  const contactMethods = [
    {
      icon: <Mail className="w-6 h-6" />,
      title: "Email Us",
      detail: "hello@apexdigital.com",
      description: "For detailed inquiries"
    },
    {
      icon: <Phone className="w-6 h-6" />,
      title: "Call Us",
      detail: "+1 (555) 123-4567",
      description: "Mon-Fri, 9AM-6PM EST"
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Live Chat",
      detail: "Available Now",
      description: "Instant support during business hours"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Schedule Call",
      detail: "Book a Time",
      description: "Choose a time that works for you"
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
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-sm tracking-wide mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
                        placeholder="John Smith"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm tracking-wide mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="company" className="block text-sm tracking-wide mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
                        placeholder="Acme Inc."
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm tracking-wide mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="service" className="block text-sm tracking-wide mb-2">
                      Service Interested In *
                    </label>
                    <select
                      id="service"
                      name="service"
                      value={formData.service}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
                    >
                      <option value="">Select a service</option>
                      {services.map((service, index) => (
                        <option key={index} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="budget" className="block text-sm tracking-wide mb-2">
                        Estimated Budget
                      </label>
                      <select
                        id="budget"
                        name="budget"
                        value={formData.budget}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
                      >
                        <option value="">Select budget range</option>
                        {budgets.map((budget, index) => (
                          <option key={index} value={budget}>
                            {budget}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="timeline" className="block text-sm tracking-wide mb-2">
                        Desired Timeline
                      </label>
                      <select
                        id="timeline"
                        name="timeline"
                        value={formData.timeline}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors bg-white"
                      >
                        <option value="">Select timeline</option>
                        {timelines.map((timeline, index) => (
                          <option key={index} value={timeline}>
                            {timeline}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm tracking-wide mb-2">
                      Project Details *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 border border-neutral-300 focus:border-black focus:outline-none transition-colors resize-none"
                      placeholder="Tell us about your project goals, challenges, and what success looks like to you..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-4 bg-black text-white text-sm tracking-wide hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 group"
                  >
                    Send Inquiry
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <p className="text-xs text-neutral-500 leading-relaxed">
                    By submitting this form, you agree to our privacy policy. We respect your 
                    privacy and will never share your information with third parties.
                  </p>
                </form>
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
                  {contactMethods.map((method, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex gap-4"
                    >
                      <div className="flex-shrink-0 w-12 h-12 bg-black text-white flex items-center justify-center">
                        {method.icon}
                      </div>
                      <div>
                        <h3 className="font-light mb-1">{method.title}</h3>
                        <p className="text-sm mb-1">{method.detail}</p>
                        <p className="text-xs text-neutral-500">{method.description}</p>
                      </div>
                    </motion.div>
                  ))}
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

                <div className="mt-8 bg-neutral-50 p-6 border-l-4 border-black">
                  <p className="text-sm text-neutral-700 leading-relaxed">
                    <strong className="font-normal">Urgent project?</strong> Call us directly at 
                    <span className="block mt-1">+1 (555) 123-4567</span>
                    and we'll prioritize your inquiry.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 lg:py-32 bg-neutral-50">
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
