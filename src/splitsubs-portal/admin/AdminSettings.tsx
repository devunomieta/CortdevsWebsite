import { useEffect, useState } from "react";
import { RefreshCw, Save, KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
    return (
        <div className="flex items-center justify-between border border-border p-4 bg-card">
            <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <button onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${checked ? "bg-primary" : "bg-secondary"}`}>
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
            </button>
        </div>
    );
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
            {children}
            <p className="text-xs text-muted-foreground leading-relaxed">{help}</p>
        </div>
    );
}

function KeyStatus({ configured, source }: { configured: boolean; source: "admin" | "env" | "none" }) {
    if (!configured) return <span className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle size={12} /> Not configured</span>;
    return (
        <span className="text-xs text-primary flex items-center gap-1">
            <CheckCircle2 size={12} /> Configured {source === "env" ? "via environment variable" : "in Admin Settings"}
        </span>
    );
}

export function AdminSettings() {
    const { showToast } = useToast();
    const [settings, setSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [liveKeyInput, setLiveKeyInput] = useState("");
    const [testKeyInput, setTestKeyInput] = useState("");

    const load = () => ssFetch("/api/admin/splitsubs/settings").then((d) => setSettings(d.settings)).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setIsSaving(true);
        try {
            const body: Record<string, unknown> = {
                defaultServiceChargeRate: settings.default_service_charge_rate,
                insurancePoolContributionRate: settings.insurance_pool_contribution_rate,
                paystackEnabled: settings.paystack_enabled,
                paystackMode: settings.paystack_mode,
                directTransferEnabled: settings.direct_transfer_enabled,
                escrowHoldHoursLow: settings.escrow_hold_hours_low,
                escrowHoldHoursMedium: settings.escrow_hold_hours_medium,
                escrowHoldHoursHigh: settings.escrow_hold_hours_high,
                newHostSettlementDelayDays: settings.new_host_settlement_delay_days,
                payoutChargeRate: settings.payout_charge_rate,
                payoutMinCyclePct: settings.payout_min_cycle_pct,
            };
            // Only sent when the admin actually typed something — leaving these
            // blank keeps whatever key is already configured untouched.
            if (liveKeyInput.trim()) body.paystackLiveSecretKey = liveKeyInput.trim();
            if (testKeyInput.trim()) body.paystackTestSecretKey = testKeyInput.trim();

            await ssFetch("/api/admin/splitsubs/settings", { method: "PATCH", body: JSON.stringify(body) });
            showToast("Settings saved.", "success");
            setLiveKeyInput(""); setTestKeyInput("");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not save settings.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const clearKey = async (which: "live" | "test") => {
        if (!window.confirm(`Clear the Paystack ${which} secret key? Payments in ${which} mode will fall back to the environment variable, if one is set.`)) return;
        try {
            await ssFetch("/api/admin/splitsubs/settings", { method: "PATCH", body: JSON.stringify(which === "live" ? { paystackLiveSecretKey: "" } : { paystackTestSecretKey: "" }) });
            showToast("Key cleared.", "success");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not clear key.", "error");
        }
    };

    if (isLoading || !settings) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <SEO title="Platform Settings" description="Payment methods, fees, and escrow timing." path="/admin/settings" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Platform Settings</h1>
                <p className="text-sm text-muted-foreground">Payment methods, fee rates, and escrow timing — live everywhere the moment you save.</p>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Paystack Keys</h2>
                <p className="text-xs text-muted-foreground -mt-1">
                    Enter your Paystack secret keys here so they're managed from the dashboard instead of a server
                    environment variable. Keys are encrypted at rest and never shown again once saved — only whether
                    one is configured. Leave a field blank to keep the current key.
                </p>
                <div className="border border-border p-4 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><KeyRound size={12} /> Live Secret Key</label>
                        <KeyStatus configured={settings.paystack_live_key_configured} source={settings.paystack_live_key_source} />
                    </div>
                    <div className="flex gap-2">
                        <input type="password" value={liveKeyInput} onChange={(e) => setLiveKeyInput(e.target.value)} placeholder="sk_live_..." autoComplete="off" className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm font-mono" />
                        {settings.paystack_live_key_source === "admin" && (
                            <button onClick={() => clearKey("live")} className="px-3 text-xs text-rose-500 border border-border hover:bg-secondary">Clear</button>
                        )}
                    </div>
                </div>
                <div className="border border-border p-4 bg-card space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><KeyRound size={12} /> Test Secret Key</label>
                        <KeyStatus configured={settings.paystack_test_key_configured} source={settings.paystack_test_key_source} />
                    </div>
                    <div className="flex gap-2">
                        <input type="password" value={testKeyInput} onChange={(e) => setTestKeyInput(e.target.value)} placeholder="sk_test_..." autoComplete="off" className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm font-mono" />
                        {settings.paystack_test_key_source === "admin" && (
                            <button onClick={() => clearKey("test")} className="px-3 text-xs text-rose-500 border border-border hover:bg-secondary">Clear</button>
                        )}
                    </div>
                </div>

                <div className="border border-border p-4 bg-card space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Callback URL &amp; public key — nothing to configure here</label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Every checkout SplitSubs starts sends its own <code>callback_url</code> straight to Paystack's
                        <code> /transaction/initialize</code> call, so it overrides whatever "Callback URL" is set in the
                        Paystack dashboard for that account — sharing an account with another system that has its own
                        dashboard callback URL is safe, since that setting only applies to transactions started
                        <em> without</em> one of their own.
                        <br /><br />
                        There's also no public key field above on purpose — checkout redirects to Paystack's hosted
                        payment page (<code>authorization_url</code>), rather than opening the Paystack Inline popup
                        in-page, so only the secret key is ever needed, server-side.
                    </p>
                </div>

                <div className="border border-border p-4 bg-card space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhook URL — paste into Paystack → Settings → API Keys & Webhooks</label>
                    <div className="flex gap-2">
                        <input readOnly value="https://splitsubs.cortdevs.com/api/splitsubs/payments-webhook" onFocus={(e) => e.target.select()} className="flex-1 px-4 py-3 bg-secondary border border-border outline-none text-sm font-mono" />
                        <button type="button" onClick={() => { navigator.clipboard.writeText("https://splitsubs.cortdevs.com/api/splitsubs/payments-webhook"); showToast("Copied.", "success"); }} className="px-4 text-xs border border-border hover:bg-secondary">Copy</button>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Paystack has no separate "webhook secret" to configure — it signs every webhook with the
                        secret key itself, and this app already verifies against both your live and test keys, so
                        one URL correctly handles both modes.
                        <br /><br />
                        <strong>Sharing this Paystack account with another system that already owns this URL slot?</strong> Two
                        options: (1) give SplitSubs its own Paystack integration (its own API keys, entered above) —
                        the clean fix, since each integration gets its own webhook URL; or (2) if it truly must be one
                        account, have the other system forward the raw webhook body and the <code>x-paystack-signature</code> header,
                        unmodified, to the URL above — signature verification only depends on the secret key, not on
                        which URL Paystack originally sent it to, so a forwarded event still verifies correctly.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Payment Methods</h2>
                <Toggle checked={settings.paystack_enabled} onChange={(v) => setSettings({ ...settings, paystack_enabled: v })} label="Paystack" description="Card and bank payments via Paystack. Turn off to stop accepting new Paystack payments platform-wide." />
                <div className="border border-border p-4 bg-card space-y-1">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Paystack mode</p>
                        <select value={settings.paystack_mode} onChange={(e) => setSettings({ ...settings, paystack_mode: e.target.value })} className="px-3 py-2 bg-background border border-border text-xs outline-none">
                            <option value="test">Test</option>
                            <option value="live">Live</option>
                        </select>
                    </div>
                    <p className="text-xs text-muted-foreground">Which key pair every new payment, transfer, and refund uses. Test mode moves no real money — use it to try the flow end-to-end before going live.</p>
                </div>
                <Toggle checked={settings.direct_transfer_enabled} onChange={(v) => setSettings({ ...settings, direct_transfer_enabled: v })} label="Direct Transfer" description="Manual bank transfer, reconciled by an admin. Off by default — the join flow only offers this once it's on." />
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Fees</h2>
                <p className="text-xs text-muted-foreground -mt-1">
                    Hosts absorb none of the plan cost — the price is split only across joiner seats, so a fully-booked
                    listing recoups the host the entire subscription. The only thing ever taken from a host is the
                    payout charge below, deducted when they actually withdraw.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Default service charge" help="The % added on top of every seat's base price and paid by joiners — this is the platform's revenue per seat. New catalog services default to this rate; each one can still be overridden individually. 0.15 = 15%.">
                        <input type="number" step="0.01" min={0} max={0.5} value={settings.default_service_charge_rate} onChange={(e) => setSettings({ ...settings, default_service_charge_rate: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </Field>
                    <Field label="Insurance pool contribution" help="The slice of each service charge (not the seat price) set aside into the insurance pool on every confirmed seat. That pool funds joiner refunds when a host is at fault and there's no pending payout left to deduct from. 0.02 = 2%.">
                        <input type="number" step="0.01" min={0} max={0.1} value={settings.insurance_pool_contribution_rate} onChange={(e) => setSettings({ ...settings, insurance_pool_contribution_rate: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </Field>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Wallet & Withdrawal Controls</h2>
                <p className="text-xs text-muted-foreground -mt-1">
                    Escrow release credits a host's wallet, not their bank account directly. These settings control
                    the second anti-scam gate: how much of a credit a host can actually withdraw, and when.
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Payout charge" help="The only cost a host ever bears — a % deducted from a withdrawal, not from the plan cost. 0.01 = 1%. Covers Paystack transfer fees and platform overhead.">
                        <input type="number" step="0.001" min={0} max={0.2} value={settings.payout_charge_rate} onChange={(e) => setSettings({ ...settings, payout_charge_rate: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </Field>
                    <Field label="Min. cycle before withdrawal" help="How far into the subscription's billing cycle a seat must be before its wallet credit becomes withdrawable — independent of the escrow hold above. 0.80 = 80%. Stops a host clearing escrow fast, then withdrawing and cancelling before the joiner's paid period is over.">
                        <input type="number" step="0.05" min={0} max={1} value={settings.payout_min_cycle_pct} onChange={(e) => setSettings({ ...settings, payout_min_cycle_pct: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                    The billing cycle itself (daily, weekly, monthly, bi-annual, yearly...) is set per service, not
                    globally — Netflix and a yearly DSTV plan don't share one cycle length. Set it on each entry in
                    the <a href="/admin/catalog" className="text-primary underline">Service Catalog</a>.
                </p>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Escrow Hold Windows (hours)</h2>
                <p className="text-xs text-muted-foreground -mt-1">
                    How long a joiner's payment sits in escrow after a host grants access before it auto-releases to
                    the host — if the joiner hasn't confirmed it works or opened a dispute by then. Set per catalog
                    risk tier: riskier services (more likely to have something go wrong) get a longer window.
                </p>
                <div className="grid grid-cols-3 gap-4">
                    {(["low", "medium", "high"] as const).map((tier) => (
                        <div key={tier} className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground capitalize">{tier} risk</label>
                            <input type="number" min={1} value={settings[`escrow_hold_hours_${tier}`]} onChange={(e) => setSettings({ ...settings, [`escrow_hold_hours_${tier}`]: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                        </div>
                    ))}
                </div>
                <Field label="New-host settlement delay (days)" help="Extra days added on top of the normal escrow window before a brand-new host's very first payout is released — gives time for problems to surface before money moves to someone with no track record yet. Doesn't apply to a host's later payouts.">
                    <input type="number" min={0} max={30} value={settings.new_host_settlement_delay_days} onChange={(e) => setSettings({ ...settings, new_host_settlement_delay_days: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </Field>
            </div>

            <button onClick={save} disabled={isSaving} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save Settings
            </button>
        </div>
    );
}
