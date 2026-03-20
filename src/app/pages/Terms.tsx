import { motion } from "framer-motion";
import { SEO } from "../components/SEO";

export function Terms() {
    return (
        <div className="bg-background text-foreground transition-colors duration-300 pt-20 lg:pt-24 min-h-screen">
            <SEO title="Terms & Conditions | CortDevs" description="Terms and Conditions for using CortDevs services. Specialized web development and technical consulting." />
            <section className="py-20 lg:py-32">
                <div className="max-w-4xl mx-auto px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-12">Terms & Conditions</h1>

                        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-muted-foreground">
                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">1. Acceptance of Terms</h2>
                                <p>
                                    By accessing and using this website, you agree to comply with and be bound by these
                                    Terms & Conditions. If you do not agree, please do not use our services.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">2. Scope of Services</h2>
                                <p>
                                    CortDevs provides specialized web development, UI/UX design, and technical consulting
                                    services. The specific scope, timelines, and deliverables for any project will be
                                    defined in a separate, legally binding Agreement or Proposal.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">3. Intellectual Property</h2>
                                <p>
                                    All content, trademarks, and logos on this website are the property of CortDevs or
                                    its parent company, HachStacks Technologies. Unauthorized use of any materials is
                                    strictly prohibited.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">4. Confidentiality & NDAs</h2>
                                <p>
                                    We recognize the importance of confidentiality. For projects involving sensitive
                                    proprietary information, we require the execution of a separate Non-Disclosure Agreement
                                    (NDA) to protect the interests of all parties.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">5. Limitation of Liability</h2>
                                <p>
                                    CortDevs shall not be liable for any indirect, incidental, or consequential damages
                                    arising out of your use of this website or our consultation services.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-2xl font-light text-foreground mb-4">6. Governing Law</h2>
                                <p>
                                    These terms are governed by and construed in accordance with the laws of the
                                    jurisdiction in which our parent company, HachStacks Technologies, is registered.
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
