import { motion } from "framer-motion";
import { SEO } from "../components/SEO";

export function Privacy() {
    return (
        <div className="bg-background text-foreground transition-colors duration-300 pt-20 lg:pt-24 min-h-screen">
            <SEO title="Privacy Policy | CortDevs" description="CortDevs Privacy Policy. We are committed to protecting your personal data and ensuring confidentiality." />
            <section className="py-20 lg:py-32">
                <div className="max-w-4xl mx-auto px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-12">Privacy Policy</h1>

                        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-muted-foreground">
                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">1. Introduction</h2>
                                <p>
                                    At CortDevs ("we," "our," or "us"), we respect your privacy and are committed to protecting it.
                                    This Privacy Policy explains how we collect, use, and safeguard your information when you visit
                                    our website and use our services.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">2. Information We Collect</h2>
                                <p>
                                    We collect information that you provide directly to us through our contact forms,
                                    including your name, email address, company name, phone number, and project details.
                                    We also collect any files you choose to upload as attachments to your inquiries.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">3. Use of Your Information</h2>
                                <p>
                                    We use the information we collect to:
                                </p>
                                <ul className="list-disc pl-6 space-y-2">
                                    <li>Respond to your inquiries and provide consultations.</li>
                                    <li>Improve our website and service offerings.</li>
                                    <li>Send project-related communications and updates.</li>
                                    <li>Comply with legal obligations and NDAs.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">4. Data Security</h2>
                                <p>
                                    We implement industry-standard security measures to protect your personal data from
                                    unauthorized access, loss, or misuse. All project details and attachments are handled
                                    with the highest level of confidentiality, particularly when an NDA is in place.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">5. Third-Party Sharing</h2>
                                <p>
                                    We do not sell or trade your personal information. We may share information with
                                    trusted service providers who assist us in operating our website or conducting our business,
                                    provided they agree to keep this information confidential.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">6. Contact Us</h2>
                                <p>
                                    If you have any questions about this Privacy Policy, please contact us at
                                    <span className="text-foreground font-bold ml-1">privacy@cortdevs.com</span>.
                                </p>
                            </section>
                        </div>

                        <div className="mt-20 pt-8 border-t border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            Last updated: February 27, 2026
                        </div>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
