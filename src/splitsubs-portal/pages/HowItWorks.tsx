import { motion } from "framer-motion";
import { ShieldCheck, UserCheck, Wallet, Scale, LifeBuoy } from "lucide-react";
import { SEO } from "../components/SEO";

const steps = [
    { icon: UserCheck, title: "A host lists their extra seats", body: "Someone already paying for Netflix, Spotify or another multi-seat plan lists the seats they're not using — and starts earning back their money." },
    { icon: Wallet, title: "You pay us, not the host directly", body: "Your payment — seat price plus a clear service charge, no surprises — sits safe with SplitSubs. The host doesn't touch it yet." },
    { icon: ShieldCheck, title: "You confirm your access works", body: "Host grants access, you check it's correct, you tap confirm. Only then does the host get paid." },
    { icon: Scale, title: "Problem? We handle it, not you", body: "If access never comes, or stops working, your money stays locked and a real human on our team steps in — no shouting match in a group chat." },
];

export function HowItWorks() {
    return (
        <div>
            <SEO
                title="How SplitSubs Works — Safe Subscription Sharing"
                description="No more WhatsApp group scams. See how SplitSubs holds your money safe until your Netflix, Spotify or YouTube Premium access is confirmed working."
                path="/how-it-works"
            />

            <section className="py-20 lg:py-28 bg-neutral-50 border-b border-border">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-6">How it Works</p>
                        <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">Not another WhatsApp group.</h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            You know the story: someone starts a "Netflix group" in WhatsApp, collects
                            everybody's money, and either the account link never comes or it stops working
                            two weeks later — person don block your number. No escrow, no proof, no one to
                            complain to. SplitSubs fixes that with one thing the group chat never had: your
                            money doesn't move until your access actually works.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section className="py-20 lg:py-28">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {steps.map((step, i) => (
                        <div key={step.title} className="border border-border p-6 bg-card">
                            <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center mb-4 text-sm font-bold">{i + 1}</div>
                            <step.icon className="w-6 h-6 mb-3 text-primary" />
                            <h3 className="font-medium text-sm mb-2">{step.title}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="py-20 lg:py-28 bg-neutral-50 border-t border-border">
                <div className="max-w-4xl mx-auto px-6 lg:px-8">
                    <h2 className="text-2xl font-light tracking-tight mb-8">About that service charge</h2>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        Every seat has a small, clear service charge — typically 15%, shown to you before
                        you ever pay a kobo. It's what keeps your money protected, funds our support team,
                        and pays for sorting out disputes when they happen. Joiners split 100% of the plan
                        cost between them — the host pays nothing towards it. Once every seat is filled, a
                        host has their entire subscription cost back in their pocket, and every seat after
                        that is pure profit.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="border border-border p-5 bg-card flex gap-3">
                            <LifeBuoy className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">Wahala? We're here. Every account gets a support ticket system with priority routing for payment and access issues — a real reply, not silence.</p>
                        </div>
                        <div className="border border-border p-5 bg-card flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">Hosts get bank-verified before their first payout ever goes out. No random accounts collecting your money and disappearing.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
