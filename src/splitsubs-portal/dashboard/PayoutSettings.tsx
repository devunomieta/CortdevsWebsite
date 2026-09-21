import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Star } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

export function PayoutSettings() {
    const { showToast } = useToast();
    const [profile, setProfile] = useState<any>(null);
    const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
    const [bankCode, setBankCode] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        Promise.all([ssFetch("/api/splitsubs/host-profile"), ssFetch("/api/splitsubs/host-profile?banks=1")])
            .then(([p, b]) => { setProfile(p.profile); setBanks(b.banks || []); })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const result = await ssFetch("/api/splitsubs/host-profile", { method: "PATCH", body: JSON.stringify({ bankCode, accountNumber }) });
            showToast(`Verified: ${result.accountName}`, "success");
            setProfile((prev: any) => ({ ...prev, bank_account_name: result.accountName, bank_account_number: accountNumber, verification_tier: "bank_verified" }));
        } catch (err: any) {
            showToast(err.message || "Could not verify that account.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    return (
        <div className="max-w-lg space-y-8">
            <SEO title="Payout Account" description="Where your SplitSubs settlement money goes." path="/dashboard/payout" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Payout Account</h1>
                <p className="text-sm text-muted-foreground">Add this now so your money doesn't hold when your first payout is ready.</p>
            </div>

            {!profile?.bank_account_name && (
                <div className="border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium">No payout account yet — you can't get paid without one.</p>
                    <p className="text-xs text-muted-foreground mt-1">Takes less than a minute. Add your bank details below and you're set for every future payout.</p>
                </div>
            )}

            <div className="border border-border p-5 bg-card flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className={profile?.verification_tier !== "basic" ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-sm font-medium">{(profile?.verification_tier || "basic").replace(/_/g, " ")}</span>
                </div>
                <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                    <Star size={14} className="fill-current text-amber-500" />
                    {profile?.rating_count > 0 ? (profile.rating_sum / profile.rating_count).toFixed(1) : "—"} ({profile?.completed_splits || 0} splits)
                </div>
            </div>

            {profile?.bank_account_name && (
                <div className="border border-border p-4 bg-secondary/30 text-sm">
                    <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-1">Current payout account</p>
                    <p className="font-medium">{profile.bank_account_name}</p>
                    <p className="text-muted-foreground">•••• {String(profile.bank_account_number).slice(-4)}</p>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-5 border border-border p-6 bg-card">
                <h3 className="font-medium text-sm">{profile?.bank_account_name ? "Update account" : "Add your account — get paid, no wahala"}</h3>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bank</label>
                    <select required value={bankCode} onChange={(e) => setBankCode(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm">
                        <option value="">Select bank</option>
                        {banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account number</label>
                    <input required maxLength={10} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <button type="submit" disabled={isSaving} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                    {isSaving && <RefreshCw size={14} className="animate-spin" />} Verify & Save
                </button>
            </form>
        </div>
    );
}
