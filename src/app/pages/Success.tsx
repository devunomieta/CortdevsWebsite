import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Mail, Calendar, FileText, Users } from "lucide-react";
import { Link } from "react-router";
import { SEO } from "../components/SEO";

export function Success() {
    const steps = [
        {
            icon: <Mail className="w-6 h-6" />,
            title: "Review Inquiry",
            description: "We'll review your inquiry and respond within 24 hours"
        },
        {
            icon: <Calendar className="w-6 h-6" />,
            title: "Discovery Call",
            description: "Schedule a discovery call to dive deep into your needs"
        },
        {
            icon: <FileText className="w-6 h-6" />,
            title: "Detailed Proposal",
            description: "Receive a detailed proposal with timeline and pricing"
        },
        {
            icon: <Users className="w-6 h-6" />,
            title: "Project Kickoff",
            description: "Kick off your project with our dedicated team"
        }
    ];

    return (
        <div className="bg-background text-foreground transition-colors duration-300 min-h-screen flex flex-col pt-20 lg:pt-24">
            <SEO title="Success! Inquiry Received | CortDevs" description="Your inquiry has been successfully received. We'll be in touch within 24 hours." />
            <section className="flex-grow py-20 lg:py-32">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8"
                    >
                        <CheckCircle2 className="w-20 h-20 text-foreground/20 mx-auto" />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl lg:text-5xl font-light tracking-tight mb-6"
                    >
                        Inquiry Received Successfully
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-muted-foreground mb-16 max-w-2xl mx-auto"
                    >
                        Thank you for reaching out to CortDevs. We're excited to learn more about
                        your project and explore how we can help you achieve your goals.
                    </motion.p>

                    <div className="bg-primary text-primary-foreground p-8 lg:p-12 text-left mb-16 border border-border">
                        <h2 className="text-2xl font-light mb-8">What Happens Next?</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                            {steps.map((step, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + index * 0.1 }}
                                    className="flex gap-4"
                                >
                                    <div className="flex-shrink-0 w-10 h-10 bg-primary-foreground text-primary flex items-center justify-center font-bold text-[10px] uppercase">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="font-bold tracking-tight mb-1">{step.title}</h3>
                                        <p className="text-sm text-primary-foreground/70 leading-relaxed">
                                            {step.description}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-foreground hover:text-muted-foreground transition-colors group text-[10px] font-bold uppercase tracking-widest"
                        >
                            Return to Home
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
