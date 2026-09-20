import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";

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

export function AdminSettings() {
    const { showToast } = useToast();
    const [settings, setSettings] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const load = () => ssFetch("/api/admin/splitsubs/settings").then((d) => setSettings(d.settings)).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setIsSaving(true);
        try {
            await ssFetch("/api/admin/splitsubs/settings", {
                method: "PATCH",
                body: JSON.stringify({
                    defaultServiceChargeRate: settings.default_service_charge_rate,
                    insurancePoolContributionRate: settings.insurance_pool_contribution_rate,
                    paystackEnabled: settings.paystack_enabled,
                    paystackMode: settings.paystack_mode,
                    directTransferEnabled: settings.direct_transfer_enabled,
                    escrowHoldHoursLow: settings.escrow_hold_hours_low,
                    escrowHoldHoursMedium: settings.escrow_hold_hours_medium,
                    escrowHoldHoursHigh: settings.escrow_hold_hours_high,
                    newHostSettlementDelayDays: settings.new_host_settlement_delay_days,
                }),
            });
            showToast("Settings saved.", "success");
        } catch (err: any) {
            showToast(err.message || "Could not save settings.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !settings) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="max-w-2xl space-y-8">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Platform Settings</h1>
                <p className="text-sm text-muted-foreground">Payment methods, fee rates, and escrow timing — live everywhere the moment you save.</p>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Payment Methods</h2>
                <Toggle checked={settings.paystack_enabled} onChange={(v) => setSettings({ ...settings, paystack_enabled: v })} label="Paystack" description="Card and bank payments via Paystack." />
                <div className="flex items-center justify-between border border-border p-4 bg-card">
                    <div>
                        <p className="text-sm font-medium">Paystack mode</p>
                        <p className="text-xs text-muted-foreground">Test mode uses test keys — no real money moves.</p>
                    </div>
                    <select value={settings.paystack_mode} onChange={(e) => setSettings({ ...settings, paystack_mode: e.target.value })} className="px-3 py-2 bg-background border border-border text-xs outline-none">
                        <option value="test">Test</option>
                        <option value="live">Live</option>
                    </select>
                </div>
                <Toggle checked={settings.direct_transfer_enabled} onChange={(v) => setSettings({ ...settings, direct_transfer_enabled: v })} label="Direct Transfer" description="Manual bank transfer, reconciled by an admin." />
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Fees</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Default service charge</label>
                        <input type="number" step="0.01" min={0} max={0.5} value={settings.default_service_charge_rate} onChange={(e) => setSettings({ ...settings, default_service_charge_rate: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Insurance pool contribution</label>
                        <input type="number" step="0.01" min={0} max={0.1} value={settings.insurance_pool_contribution_rate} onChange={(e) => setSettings({ ...settings, insurance_pool_contribution_rate: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Escrow Hold Windows (hours)</h2>
                <div className="grid grid-cols-3 gap-4">
                    {(["low", "medium", "high"] as const).map((tier) => (
                        <div key={tier} className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground capitalize">{tier} risk</label>
                            <input type="number" min={1} value={settings[`escrow_hold_hours_${tier}`]} onChange={(e) => setSettings({ ...settings, [`escrow_hold_hours_${tier}`]: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                        </div>
                    ))}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">New-host settlement delay (days)</label>
                    <input type="number" min={0} max={30} value={settings.new_host_settlement_delay_days} onChange={(e) => setSettings({ ...settings, new_host_settlement_delay_days: Number(e.target.value) })} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
            </div>

            <button onClick={save} disabled={isSaving} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save Settings
            </button>
        </div>
    );
}
