import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, CheckCircle2, RefreshCw, Calendar } from "lucide-react";
import { SEO } from "../../app/components/SEO";
import { useToast } from "../../app/components/Toast";

const contactMethods = [
    {
        icon: <Mail className="w-6 h-6" />,
        title: "Email Us",
        detail: "events@cortdevs.com",
        description: "For new events, access issues, or lost login links",
    },
    {
        icon: <Calendar className="w-6 h-6" />,
        title: "Schedule a Call",
        detail: "Calendly Booking",
        description: "Walk through what your event needs",
        link: "https://calendly.com/cortdevs",
    },
];

export function EventsContact() {
    const { showToast } = useToast();
    const [form, setForm] = useState({ name: "", email: "", company: "", message: "", website: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    company: form.company,
                    service: "Event Attendance System",
                    message: form.message,
                    website: form.website, // honeypot
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Something went wrong. Please try again.");
            }
            setIsSubmitted(true);
            showToast("Message sent — we'll be in touch shortly.", "success");
        } catch (err: any) {
            showToast(err.message || "Could not send your message.", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <SEO
                title="Contact | Events Portal"
                description="Reach Cortdevs about a new event, dashboard access, or a lost private link."
                canonical="https://events.cortdevs.com/contact"
            />

            <section className="py-20 lg:py-32 bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-2xl"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-6">
                            Contact
                        </p>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
                            Let's talk about your event.
                        </h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Already have a dashboard login? This form isn't it — use the private link your
                            admin sent you. This is for new events, access problems, or general questions.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-20 lg:py-32">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-5 gap-16">
                    <div className="lg:col-span-2 space-y-6">
                        {contactMethods.map((method) => (
                            <div key={method.title} className="border border-border p-6">
                                <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-4">
                                    {method.icon}
                                </div>
                                <h3 className="font-medium mb-1">{method.title}</h3>
                                {method.link ? (
                                    <a
                                        href={method.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-medium hover:opacity-70 transition-opacity"
                                    >
                                        {method.detail}
                                    </a>
                                ) : (
                                    <a href={`mailto:${method.detail}`} className="text-sm font-medium hover:opacity-70 transition-opacity">
                                        {method.detail}
                                    </a>
                                )}
                                <p className="text-xs text-muted-foreground mt-2">{method.description}</p>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-3">
                        {isSubmitted ? (
                            <div className="border border-border p-10 text-center bg-card">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-primary" />
                                <h3 className="text-xl font-medium mb-2">Message sent</h3>
                                <p className="text-muted-foreground text-sm">
                                    We typically respond within one business day.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <input
                                    type="text"
                                    value={form.website}
                                    onChange={handleChange("website")}
                                    className="hidden"
                                    tabIndex={-1}
                                    autoComplete="off"
                                />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Your Name
                                        </label>
                                        <input
                                            required
                                            value={form.name}
                                            onChange={handleChange("name")}
                                            className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Email
                                        </label>
                                        <input
                                            required
                                            type="email"
                                            value={form.email}
                                            onChange={handleChange("email")}
                                            className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Event / Organization
                                    </label>
                                    <input
                                        value={form.company}
                                        onChange={handleChange("company")}
                                        placeholder="e.g. Demo Day 2026"
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        Message
                                    </label>
                                    <textarea
                                        required
                                        rows={5}
                                        value={form.message}
                                        onChange={handleChange("message")}
                                        placeholder="Tell us about your event — dates, expected attendees, what you need."
                                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" /> Sending...
                                        </>
                                    ) : (
                                        <>
                                            Send Message <Send className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
