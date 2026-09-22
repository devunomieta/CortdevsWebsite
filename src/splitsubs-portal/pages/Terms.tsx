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

export function Terms() {
    return (
        <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 space-y-12">
            <SEO title="Terms of Service" description="SplitSubs' Terms of Service, engagement rules, dispute resolution process, and disclaimers." path="/terms" />

            <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary mb-3">Legal</p>
                <h1 className="text-3xl lg:text-4xl font-light tracking-tight mb-2">Terms of Service</h1>
                <p className="text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>
            </div>

            <Section title="1. Who this is between">
                <p>These Terms govern use of SplitSubs (a CortDevs product) by <strong>Hosts</strong> (who list spare seats on a subscription they already pay for and control) and <strong>Joiners</strong> (who pay to use a seat on a Host's listing). SplitSubs connects the two and holds payment in escrow between them — it is not a party to the underlying subscription itself.</p>
            </Section>

            <Section title="2. Accounts">
                <p>You must provide accurate information when registering, including a real email address and, where requested, your legal name, date of birth, and residential address (Hosts only, for payout verification). You're responsible for all activity on your account.</p>
            </Section>

            <Section title="3. Listings">
                <p>A Host lists seats on a subscription plan they currently hold and can grant access to. Every listing is reviewed by SplitSubs before it goes live. SplitSubs may reject, suspend, or remove a listing at its discretion, including for suspected fraud, a service that doesn't permit sharing, or repeated joiner complaints.</p>
            </Section>

            <Section title="4. Payment & escrow">
                <p>A Joiner's payment (seat cost plus SplitSubs' service charge) is held in escrow, not paid to the Host immediately. It releases to the Host once the Joiner confirms access is working, or automatically after a fixed hold window if the Joiner doesn't respond (48–96 hours depending on the service's risk tier). Joiners can dispute before that window closes.</p>
            </Section>

            <Section title="5. Payouts">
                <p>Hosts withdraw from their SplitSubs wallet to a verified bank account. New Hosts have a short settlement delay on their first payout (a fraud-prevention window) beyond the ordinary escrow release.</p>
            </Section>

            <Section title="6. Fees">
                <p>SplitSubs adds a service charge on top of the base seat price, shown to Joiners before payment — never hidden. Hosts do not pay this charge: once every seat on a listing is filled, a Host has recovered the full plan cost from Joiners' seat payments.</p>
            </Section>

            <Section title="7. Terms of engagement">
                <p>Baseline conduct expected of everyone using SplitSubs:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Hosts</strong> must keep their subscription active and paid for the duration of every seat they've sold, grant access promptly once a seat is paid for, and be truthful in the proof of subscription and listing details they provide.</li>
                    <li><strong>Joiners</strong> must provide accurate joiner-field information, confirm access promptly once it's genuinely working, and raise a dispute rather than a public complaint if something's wrong.</li>
                    <li><strong>Both parties</strong> must keep all payment and access-delivery communication on-platform, not move to a side arrangement outside SplitSubs — off-platform payments aren't escrow-protected.</li>
                    <li><strong>Chat conduct:</strong> harassment, threats, and requests to pay outside the platform are prohibited and reportable. Chat is not private from SplitSubs — it can be reviewed as part of a dispute.</li>
                    <li>Repeated failure on either side is grounds for account restriction.</li>
                </ul>
            </Section>

            <Section title="8. Dispute resolution">
                <p>A Joiner can open a dispute on a seat any time before escrow auto-releases, or after, if access later stops working. Opening one freezes that seat's escrow until an admin resolves it.</p>
                <p>Possible resolutions: refund the Joiner (host-caused failure), release to the Host as normal (dispute found unfounded), or dismiss with no money movement. Host-caused refunds are backed by SplitSubs' insurance pool, not pulled from unrelated hosts' pending payouts. A Host with a pattern of resolved-against-them disputes is subject to listing suspension or account review.</p>
                <p>This process is the primary path for resolving a Host/Joiner disagreement. It does not waive either party's legal rights.</p>
            </Section>

            <Section title="9. Account actions">
                <p>SplitSubs may suspend or terminate an account for fraud, repeated disputes found in the user's favor, non-payment, abusive conduct in chat or support, or violation of these Terms.</p>
            </Section>

            <Section title="10. Disclaimers">
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>No affiliation.</strong> SplitSubs is not affiliated with, endorsed by, or sponsored by Netflix, Spotify, or any other subscription service listed on the platform. Service names and logos belong to their respective owners and are used only to identify what's being shared.</li>
                    <li><strong>Third-party terms risk sits with the user.</strong> Most subscription services restrict account sharing outside a household in their own terms. SplitSubs is a coordination and payment-escrow tool for an arrangement Hosts and Joiners choose to enter — it does not review, and cannot guarantee, that any given arrangement complies with the underlying service's own terms.</li>
                    <li><strong>No uptime guarantee on the underlying service.</strong> SplitSubs cannot prevent a Host's account from being suspended, price-changed, or terminated by the provider. Escrow and disputes protect a Joiner's payment in that event — not the underlying access itself.</li>
                    <li><strong>"100% payback" is seat-fill-dependent.</strong> A Host recovers their full plan cost only once every seat on a listing is filled and confirmed; a partially filled listing recovers proportionally.</li>
                    <li><strong>Platform, not guarantor.</strong> SplitSubs facilitates the connection, payment, and dispute process between Hosts and Joiners. It is not a guarantor of either party's conduct beyond the escrow and dispute mechanisms above.</li>
                </ul>
            </Section>

            <Section title="11. Changes">
                <p>These Terms may be updated from time to time; continued use of SplitSubs after a change means acceptance of the update. See our <Link to="/privacy" className="text-foreground underline">Privacy Policy</Link> for how we handle your data.</p>
            </Section>
        </div>
    );
}
