import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Send, CheckCircle2, RefreshCw, LifeBuoy } from "lucide-react";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

export function SplitSubsContact() {
    const { showToast } = useToast();
    const [form, setForm] = useState({ name: "", email: "", message: "", website: "" });
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
                body: JSON.stringify({ name: form.name, email: form.email, service: "SplitSubs", message: form.message, website: form.website }),
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
                title="Contact"
                description="Questions about SplitSubs before you sign up? Partnerships or press? Reach us — already joined a seat? Use the support ticket in your dashboard instead."
                path="/contact"
            />

            <section className="py-20 lg:py-32 bg-neutral-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-2xl">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-6">Contact</p>
                        <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">Got a question? Abeg, ask us.</h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Already joined a seat or hosting a split? Open a support ticket from your
                            dashboard instead — it gets tracked and answered faster. This form is for
                            everything else — questions before you sign up, partnerships, press.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-20 lg:py-32">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-5 gap-16">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="border border-border p-6">
                            <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-4">
                                <Mail className="w-6 h-6" />
                            </div>
                            <h3 className="font-medium mb-1">Email Us</h3>
                            <a href="mailto:splitsubs@cortdevs.com" className="text-sm font-medium hover:opacity-70 transition-opacity">splitsubs@cortdevs.com</a>
                            <p className="text-xs text-muted-foreground mt-2">General questions, partnerships, press.</p>
                        </div>
                        <div className="border border-border p-6">
                            <div className="w-12 h-12 bg-primary text-primary-foreground flex items-center justify-center mb-4">
                                <LifeBuoy className="w-6 h-6" />
                            </div>
                            <h3 className="font-medium mb-1">Have an active split?</h3>
                            <a href="/dashboard" className="text-sm font-medium hover:opacity-70 transition-opacity">Open a support ticket →</a>
                            <p className="text-xs text-muted-foreground mt-2">Faster response, full context on your account.</p>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        {isSubmitted ? (
                            <div className="border border-border p-10 text-center bg-card">
                                <CheckCircle2 className="w-10 h-10 mx-auto mb-4 text-primary" />
                                <h3 className="text-xl font-medium mb-2">Message sent</h3>
                                <p className="text-muted-foreground text-sm">We typically respond within one business day.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <input type="text" value={form.website} onChange={handleChange("website")} className="hidden" tabIndex={-1} autoComplete="off" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Name</label>
                                        <input required maxLength={200} value={form.name} onChange={handleChange("name")} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                                        <input required type="email" maxLength={200} value={form.email} onChange={handleChange("email")} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Message</label>
                                    <textarea required rows={5} maxLength={5000} value={form.message} onChange={handleChange("message")} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm resize-none" />
                                </div>
                                <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground tracking-widest text-[10px] font-bold uppercase hover:opacity-90 transition-all disabled:opacity-50">
                                    {isSubmitting ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Sending...</>) : (<>Send Message <Send className="w-4 h-4" /></>)}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
