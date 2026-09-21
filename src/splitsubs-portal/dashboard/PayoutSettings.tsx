import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Star, Wallet, ArrowDownToLine, Lock } from "lucide-react";
import { ssFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const TX_LABEL: Record<string, string> = {
    escrow_release: "Seat confirmed",
    withdrawal: "Withdrawal",
    admin_adjustment: "Adjustment",
    dispute_reversal: "Dispute reversal",
};

function WalletCard() {
    const { showToast } = useToast();
    const [wallet, setWallet] = useState<{ balance: number; available: number; locked: number } | null>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [amount, setAmount] = useState("");
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const load = () => ssFetch("/api/splitsubs/wallet").then((d) => { setWallet(d.wallet); setTransactions(d.transactions || []); }).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => { load(); }, []);

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsWithdrawing(true);
        try {
            const result = await ssFetch("/api/splitsubs/wallet", { method: "POST", body: JSON.stringify({ action: "withdraw", amount: Number(amount) }) });
            showToast(`Withdrawal sent — ${money(result.net)} on its way to your bank.`, "success");
            setAmount("");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not process withdrawal.", "error");
        } finally {
            setIsWithdrawing(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-muted-foreground" size={20} /></div>;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="border border-border p-4 bg-card">
                    <p className="text-2xl font-light">{money(wallet?.balance || 0)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Wallet balance</p>
                </div>
                <div className="border border-primary/30 bg-primary/5 p-4">
                    <p className="text-2xl font-light text-primary">{money(wallet?.available || 0)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Available now</p>
                </div>
                <div className="border border-border p-4 bg-card">
                    <p className="text-2xl font-light flex items-center gap-1.5"><Lock size={16} className="text-muted-foreground" /> {money(wallet?.locked || 0)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">Still locked</p>
                </div>
            </div>

            {(wallet?.locked || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                    Locked money clears automatically once a seat's subscription cycle is far enough along — it's not stuck, just timed to protect joiners.
                </p>
            )}

            <form onSubmit={handleWithdraw} className="border border-border p-5 bg-card flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px] space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Withdraw amount (₦)</label>
                    <input
                        type="number" min={1} max={wallet?.available || 0} required
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Up to ${money(wallet?.available || 0)}`}
                        className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                    />
                </div>
                <button type="submit" disabled={isWithdrawing || !wallet?.available} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                    {isWithdrawing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} Withdraw Now
                </button>
            </form>

            {transactions.length > 0 && (
                <div className="border border-border bg-card divide-y divide-border">
                    {transactions.slice(0, 8).map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                            <div>
                                <p className="font-medium">{TX_LABEL[t.source] || t.source}</p>
                                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}{t.withdrawal_status ? ` · ${t.withdrawal_status}` : ""}</p>
                            </div>
                            <span className={`font-semibold ${t.type === "credit" ? "text-primary" : "text-muted-foreground"}`}>{t.type === "credit" ? "+" : "−"}{money(t.amount)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
            <SEO title="Wallet & Payout Account" description="Your SplitSubs wallet balance and payout account." path="/dashboard/payout" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1 flex items-center gap-2"><Wallet size={22} /> Wallet</h1>
                <p className="text-sm text-muted-foreground">Every confirmed seat pays into this wallet — no charge on the plan cost, ever. Only a small payout charge applies when you withdraw.</p>
            </div>

            {!profile?.bank_account_name && (
                <div className="border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium">No payout account yet — you can't withdraw without one.</p>
                    <p className="text-xs text-muted-foreground mt-1">Takes less than a minute. Add your bank details below first.</p>
                </div>
            )}

            <WalletCard />

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
                    <p className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-1">Payout account</p>
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
