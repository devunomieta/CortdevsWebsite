import { motion } from "framer-motion";
import {
    KeyRound,
    Users,
    Radio,
    ListChecks,
    ShieldCheck,
    Clock,
    FileSpreadsheet,
    Eye,
} from "lucide-react";
import { SEO } from "../../app/components/SEO";

const fadeInUp = {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 },
};

const features = [
    {
        icon: <KeyRound className="w-6 h-6" />,
        title: "Private by construction",
        description:
            "No event is ever publicly listed. The only way to reach a dashboard is the exact link and login Cortdevs issues for that event.",
    },
    {
        icon: <Users className="w-6 h-6" />,
        title: "Named logins per staffer",
        description:
            "Every credential carries a label — Front Desk, VIP Desk, a person's name — plus a role: full access, or stats-only view.",
    },
    {
        icon: <Radio className="w-6 h-6" />,
        title: "Live across every device",
        description:
            "Check a guest in at one station and every other screen watching the event updates instantly — no double check-ins.",
    },
    {
        icon: <ListChecks className="w-6 h-6" />,
        title: "Search or walk in",
        description:
            "Confirm a pre-registered guest by name, email or phone, or register someone on the spot with fields your event defines.",
    },
    {
        icon: <Eye className="w-6 h-6" />,
        title: "Stats that update themselves",
        description:
            "Confirmed attendees, new walk-in registrations, and check-in rate, per day — visible the moment they change.",
    },
    {
        icon: <FileSpreadsheet className="w-6 h-6" />,
        title: "Export needs sign-off",
        description:
            "Only a Cortdevs admin can actually export attendee data. An event owner's export click files a request; nothing downloads until it's approved.",
    },
    {
        icon: <Clock className="w-6 h-6" />,
        title: "Data doesn't linger",
        description:
            "Seven days after an event ends, both sides get daily reminders to export. What's left after that is deleted automatically.",
    },
    {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: "Everything is timestamped",
        description:
            "Every login, search, check-in and export decision is logged against the credential that performed it — a full record if anything is ever disputed.",
    },
];

export function EventsAbout() {
    return (
        <div>
            <SEO
                title="About the Events Portal"
                description="What the Cortdevs events attendance system is, how it works, and who Cortdevs is."
                canonical="https://events.cortdevs.com/about"
            />

            {/* Hero */}
            <section className="py-20 lg:py-32 bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div {...fadeInUp} className="max-w-3xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-6">
                            About This Portal
                        </p>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
                            A private tool for a
                            <span className="block mt-2">specific job.</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                            Cortdevs occasionally lists and supports events on behalf of clients and partners.
                            This portal exists to give those event owners a dashboard for confirming attendees
                            and tracking turnout — without ever making the event itself public.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* What it is */}
            <section className="py-20 lg:py-32">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                    <motion.div {...fadeInUp}>
                        <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-6">What it is</h2>
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <p>
                                An event attendance system, not an events website. There's no public calendar, no
                                ticket store, no discovery page — this subdomain exists solely so a Cortdevs admin
                                can hand a login-gated dashboard to whoever is running an event, and that person's
                                team can confirm who showed up.
                            </p>
                            <p>
                                Every event lives behind its own private link and its own set of credentials.
                                Nothing here is reachable without both.
                            </p>
                        </div>
                    </motion.div>
                    <motion.div
                        {...fadeInUp}
                        transition={{ ...fadeInUp.transition, delay: 0.1 }}
                    >
                        <h2 className="text-3xl lg:text-4xl font-light tracking-tight mb-6">What it isn't</h2>
                        <div className="space-y-4 text-muted-foreground leading-relaxed">
                            <p>
                                Not a ticketing platform — Cortdevs doesn't process payments or sell seats here.
                                Not a marketing page — events are never indexed or linked from anywhere public.
                                Not a permanent archive — attendee contact details are deleted on a fixed schedule
                                after an event closes, by design.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Feature grid */}
            <section className="py-20 lg:py-32 bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div {...fadeInUp} className="max-w-2xl mb-16">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-4">
                            Features
                        </p>
                        <h2 className="text-3xl lg:text-5xl font-light tracking-tight">
                            Built around attendance, not marketing.
                        </h2>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, i) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: (i % 4) * 0.08, duration: 0.5 }}
                                className="border border-border p-6 bg-card"
                            >
                                <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-5">
                                    {feature.icon}
                                </div>
                                <h3 className="font-medium mb-2">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Cortdevs */}
            <section className="py-20 lg:py-32 bg-black text-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <motion.div {...fadeInUp}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 mb-6">
                            About Cortdevs
                        </p>
                        <h2 className="text-3xl lg:text-5xl font-light tracking-tight mb-6 leading-[1.1]">
                            The team behind the
                            <span className="block mt-2">main event.</span>
                        </h2>
                        <div className="space-y-4 text-neutral-400 leading-relaxed">
                            <p>
                                Cortdevs is a web development studio building WordPress, Shopify, GHL, and custom
                                full-stack products for clients who need more than a template. This events portal
                                is a smaller, internal tool built the same way as everything else we ship: scoped
                                tightly to the job it does, and nothing else.
                            </p>
                            <p>
                                If you're here because Cortdevs is running attendance for your event, this is the
                                same team you're already talking to — just wearing a different hat for a few days.
                            </p>
                        </div>
                    </motion.div>
                    <motion.div
                        {...fadeInUp}
                        transition={{ ...fadeInUp.transition, delay: 0.1 }}
                        className="grid grid-cols-2 gap-6"
                    >
                        {[
                            { number: "100+", label: "Projects Delivered" },
                            { number: "99%", label: "Client Satisfaction" },
                            { number: "30+", label: "Enterprise Clients" },
                            { number: "24/7", label: "Support Available" },
                        ].map((stat) => (
                            <div key={stat.label} className="border border-white/10 p-6">
                                <p className="text-3xl font-light mb-2">{stat.number}</p>
                                <p className="text-[10px] uppercase tracking-widest text-neutral-500">{stat.label}</p>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>
        </div>
    );
}
