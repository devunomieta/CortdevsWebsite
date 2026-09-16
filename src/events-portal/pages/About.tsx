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
        title: "Private from the start",
        description:
            "No event ever shows up publicly. The only way in is the exact link and login we give you for that event.",
    },
    {
        icon: <Users className="w-6 h-6" />,
        title: "A login for each person",
        description:
            "Give each staffer their own named login — Front Desk, VIP Desk, or their own name — with either full access or just the numbers.",
    },
    {
        icon: <Radio className="w-6 h-6" />,
        title: "Updates on every screen",
        description:
            "Check someone in at one station and every other screen watching the event updates right away — no one gets checked in twice.",
    },
    {
        icon: <ListChecks className="w-6 h-6" />,
        title: "Search or add on the spot",
        description:
            "Find a guest who already registered by name, email, or phone, or add a walk-in right there with whatever details you need.",
    },
    {
        icon: <Eye className="w-6 h-6" />,
        title: "Numbers that update themselves",
        description:
            "See how many people checked in, how many are walk-ins, and your check-in rate for each day — updated the second they change.",
    },
    {
        icon: <FileSpreadsheet className="w-6 h-6" />,
        title: "Downloads need approval",
        description:
            "Only a Cortdevs admin can actually hand over guest data. Asking for it just sends a request — nothing downloads until we say yes.",
    },
    {
        icon: <Clock className="w-6 h-6" />,
        title: "Data doesn't stick around",
        description:
            "Once your event ends, we both get daily reminders for 7 days to save what you need. After that, it's deleted automatically.",
    },
    {
        icon: <ShieldCheck className="w-6 h-6" />,
        title: "Everything is logged",
        description:
            "Every login, search, check-in, and download decision is recorded with who did it and when — so there's always a clear record.",
    },
];

export function EventsAbout() {
    return (
        <div>
            <SEO
                title="About the Events Portal"
                description="What this tool is, how it works, and who's behind it."
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
                            Built to do
                            <span className="block mt-2">one thing well.</span>
                        </h1>
                        <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                            Sometimes Cortdevs helps run events for clients and partners. This portal
                            gives those event owners a private dashboard to check guests in and see how
                            many showed up — without ever putting the event online for anyone else to find.
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
                                A tool for checking people in, not a website for browsing events. There's no
                                calendar, no ticket shop, no way to search for events here. It exists so a
                                Cortdevs admin can hand a private dashboard to whoever is running an event, so
                                their team can check off guests as they arrive.
                            </p>
                            <p>
                                Every event has its own private link and its own login. You can't get in
                                without both.
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
                                We don't sell tickets or take payments here. We don't advertise your event —
                                it's never listed anywhere public. And we don't keep guest details forever —
                                they're deleted on a set schedule after your event ends, by design.
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
                            Built for checking people in, not for showing off.
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
                                Cortdevs builds websites and web apps — WordPress, Shopify, and custom builds —
                                for clients who need more than a template. This events portal is a smaller tool
                                we built the same way: to do one job well, and nothing more.
                            </p>
                            <p>
                                If Cortdevs is handling attendance for your event, it's the same team you
                                already know — just doing a different job for a few days.
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
