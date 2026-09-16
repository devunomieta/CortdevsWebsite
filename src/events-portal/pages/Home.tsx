import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound, ListChecks, ShieldCheck, Radio } from "lucide-react";
import { SEO } from "../../app/components/SEO";

const fadeInUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 },
};

const steps = [
    {
        title: "We set it up",
        description:
            "We add your event's name, flier, and date(s) behind the scenes. No one can find it by searching — it's just not out there.",
    },
    {
        title: "You get a link and a login",
        description:
            "One link, one login, just for your event. It won't open anything else on this site.",
    },
    {
        title: "Your team checks people in",
        description:
            "Find a guest by name, email, or phone and mark them in — or add a walk-in on the spot. Works on as many phones or laptops as your door needs, all at once.",
    },
    {
        title: "Guest info clears itself out",
        description:
            "Once your event is over, you have 7 days to save your guest list. After that, it's deleted for you automatically.",
    },
];

const highlights = [
    { icon: <KeyRound className="w-6 h-6" />, label: "Logins you can turn off anytime" },
    { icon: <Radio className="w-6 h-6" />, label: "Check in guests from any device" },
    { icon: <ShieldCheck className="w-6 h-6" />, label: "Never public, never searchable" },
    { icon: <ListChecks className="w-6 h-6" />, label: "Guest info doesn't stick around" },
];

export function EventsHome() {
    return (
        <div>
            <SEO
                title="Event Attendance Portal"
                description="A private tool Cortdevs uses to check people in at events — never public, never searchable."
                canonical="https://events.cortdevs.com"
            />

            {/* Hero */}
            <section className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 to-white" />
                <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
                    <motion.div {...fadeInUp} className="max-w-3xl">
                        <div className="inline-block px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.3em] uppercase mb-8">
                            Events Portal
                        </div>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
                            Know who shows up.
                            <span className="block mt-2">Keep it private.</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl">
                            This is where Cortdevs manages event check-ins — a private dashboard for
                            confirming who's here and counting them. Nothing about your event is ever
                            posted here for anyone else to see.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                to="/about"
                                className="inline-flex items-center justify-center gap-3 px-8 py-5 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group"
                            >
                                How It Works
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                            <Link
                                to="/contact"
                                className="inline-flex items-center justify-center gap-3 px-8 py-5 border border-border text-foreground tracking-widest text-[10px] font-bold uppercase hover:bg-muted transition-colors"
                            >
                                Talk to Cortdevs
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Already have an event login */}
            <section className="py-12 border-y border-border bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        Already running an event with us? You'll need the private link and login we sent you —
                        this page won't get you into your dashboard.
                    </p>
                    <a
                        href="mailto:events@cortdevs.com"
                        className="text-xs font-bold uppercase tracking-widest text-foreground whitespace-nowrap hover:opacity-70 transition-opacity"
                    >
                        Lost your link? →
                    </a>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20 lg:py-32">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div {...fadeInUp} className="max-w-2xl mb-16">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">
                            How It Works
                        </p>
                        <h2 className="text-3xl lg:text-5xl font-light tracking-tight">
                            Four simple steps.
                        </h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                className="bg-background p-8 lg:p-10"
                            >
                                <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
                                    0{i + 1}
                                </span>
                                <h3 className="text-xl font-medium mt-3 mb-3">{step.title}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Highlights band */}
            <section className="py-20 bg-primary text-primary-foreground">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                        {highlights.map((item, i) => (
                            <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="flex flex-col items-center text-center gap-4"
                            >
                                <div className="w-14 h-14 border border-primary-foreground/30 flex items-center justify-center">
                                    {item.icon}
                                </div>
                                <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">{item.label}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-20 lg:py-32">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div {...fadeInUp}>
                        <h2 className="text-3xl lg:text-5xl font-light tracking-tight mb-6">
                            Running an event and need attendance handled?
                        </h2>
                        <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
                            Tell us about your event and we'll set up a private dashboard for your team.
                        </p>
                        <Link
                            to="/contact"
                            className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all group"
                        >
                            Contact Cortdevs
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
