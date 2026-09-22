import { Link } from "react-router";
import { SEO } from "../components/SEO";

const LAST_UPDATED = "September 22, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h2 className="text-lg font-medium">{title}</h2>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
        </div>
    );
}

export function Privacy() {
    return (
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 space-y-12">
            <SEO title="Privacy Policy" description="What SplitSubs collects, why, who it's shared with, and how long it's kept." path="/privacy" />

            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Legal</p>
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight mb-2">Privacy Policy</h1>
                <p className="text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>
            </div>

            <Section title="What we collect">
                <ul className="list-disc pl-5 space-y-2">
                    <li>Email and password, via Supabase Auth.</li>
                    <li>For Hosts: legal name, date of birth, and residential address, for payout and identity verification.</li>
                    <li>WhatsApp number — collected at signup, not yet OTP-verified.</li>
                    <li>Proof-of-subscription links or screenshots you provide when listing a seat.</li>
                    <li>Dynamic host/joiner fields defined per service — varies by service, e.g. an invite email or a profile name.</li>
                    <li>Chat messages between a Host and Joiner on a seat.</li>
                    <li>Support tickets, disputes, and ratings you submit.</li>
                    <li>An audit log of sensitive actions taken on your account or listings (edits, payout overrides, dispute resolutions).</li>
                </ul>
            </Section>

            <Section title="What we don't collect">
                <p>Card and bank details are handled directly by Paystack, our payment processor. SplitSubs never stores your raw payment credentials.</p>
            </Section>

            <Section title="Who it's shared with">
                <p>Paystack (payment processing), Supabase (authentication, database, file storage), and our transactional email provider (signup, access-granted, dispute, and renewal emails) — each receives only what it needs to perform its function. SplitSubs does not sell your data.</p>
            </Section>

            <Section title="Why it's collected">
                <p>To operate the escrow and payout system, verify Host identity before releasing funds, deliver the specific access details a service requires, resolve disputes, and meet basic fraud-prevention and record-keeping obligations.</p>
            </Section>

            <Section title="How long we keep it">
                <p>Account and transaction records are retained for as long as your account is active and for a reasonable period after, to meet financial and tax record-keeping obligations. Seat chat messages are retained for the life of the seat plus 12 months after it ends, to support any dispute that references them.</p>
            </Section>

            <Section title="Your rights">
                <p>You can request a copy of your data or request its deletion, subject to our ability to retain records required for financial or legal compliance. To make a request, reach us via <Link to="/contact" className="text-foreground underline">Contact</Link>.</p>
            </Section>

            <Section title="Changes">
                <p>This policy may be updated from time to time; continued use of SplitSubs after a change means acceptance of the update. See our <Link to="/terms" className="text-foreground underline">Terms of Service</Link> for how the platform itself works.</p>
            </Section>
        </div>
    );
}
