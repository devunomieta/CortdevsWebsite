import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { ShieldCheck, UserCheck, Wallet, Scale, LifeBuoy } from "lucide-react";

const steps = [
    { icon: UserCheck, title: "A host lists an open seat", body: "Someone already paying for Netflix, Spotify, or another multi-seat plan lists their unused seats." },
    { icon: Wallet, title: "You pay into escrow", body: "Your payment — seat price plus a transparent service charge — is held by SplitSubs, not sent straight to the host." },
    { icon: ShieldCheck, title: "You confirm access works", body: "The host grants access; you check it works and confirm. That's what releases their payout." },
    { icon: Scale, title: "Disputes are resolved by us", body: "If access never arrives, or breaks, escrow stays frozen and a SplitSubs admin steps in — not a WhatsApp group argument." },
];

export function HowItWorks() {
    return (
        <div>
            <Helmet><title>How SplitSubs Works</title></Helmet>

            <section className="py-20 lg:py-28 bg-neutral-50 border-b border-border">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground mb-6">How it Works</p>
                        <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-6">Not another WhatsApp group.</h1>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                            The informal way to split a subscription has no escrow and no recourse — a host
                            can vanish after payment, or a joiner can vanish after access. SplitSubs fixes that
                            with an actual safety mechanism: escrow.
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
                    <h2 className="text-2xl font-light tracking-tight mb-8">The service charge</h2>
                    <p className="text-muted-foreground leading-relaxed mb-6">
                        Every seat includes a service charge — typically 15%, shown before you ever pay — on
                        top of the base seat price. It funds escrow protection, dispute resolution, and support.
                        Hosts never pay a hidden cut: they receive exactly the base price for every seat that's
                        confirmed, nothing withheld beyond their own seat.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="border border-border p-5 bg-card flex gap-3">
                            <LifeBuoy className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">Need help? Every account gets a support ticket system with priority routing for payment and access issues.</p>
                        </div>
                        <div className="border border-border p-5 bg-card flex gap-3">
                            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">Hosts are bank-verified before their first payout — no anonymous accounts collecting money.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
