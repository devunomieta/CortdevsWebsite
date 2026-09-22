import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, AlertCircle } from "lucide-react";
import { ssFetch } from "../lib/api";
import { SEO } from "../components/SEO";

const money = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export function AdminOverview() {
    const [data, setData] = useState<any>(null);

    useEffect(() => { ssFetch("/api/admin/splitsubs/analytics").then(setData).catch(() => { }); }, []);

    if (!data) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    const stats = [
        { label: "Gross Split Volume", value: money(data.gsv), help: "Total ₦ ever paid by joiners across every seat that's reached a paid state — the platform's total transaction volume, not revenue." },
        { label: "Take-rate revenue", value: money(data.takeRateRevenue), help: "The slice of GSV that's actually platform revenue — the service charge portion of every paid seat, before payout charges." },
        { label: "Active listings", value: data.activeListings, help: "Listings currently live and joinable. Doesn't count pending review, paused, or archived ones." },
        { label: "Seat fill rate", value: `${data.fillRate}%`, help: "Of every joinable seat across active listings (total seats minus the host's own), the % currently taken by a paid joiner." },
        { label: "Dispute rate", value: `${data.disputeRate}%`, help: "Disputes raised as a % of all paid seats — a rough proxy for how often something goes wrong after payment." },
        { label: "Open disputes", value: data.openDisputes, help: "Disputes currently 'open' or 'investigating' — need admin attention now, on the Disputes page." },
        { label: "Insurance pool balance", value: money(data.insurancePoolBalance), help: "Funds set aside from service charges to cover joiner refunds when a host is at fault and there's no payout left to deduct from." },
        { label: "Prepaid wallet balance", value: money(data.prepaidWalletBalance), help: "Sum of every joiner's spending balance right now — money the platform is holding on their behalf, not revenue. A liability, not an asset." },
        { label: "Total paid out", value: money(data.totalPaidOut), help: "Net of the payout charge — the actual ₦ that's left the platform to host bank accounts via completed withdrawals, all-time." },
    ];

    return (
        <div className="space-y-10">
            <SEO title="Admin Overview" description="SplitSubs platform metrics." path="/admin" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Overview</h1>
                <p className="text-sm text-muted-foreground">Platform health, per the PRD's core metrics.</p>
            </div>

            {data.pendingDirectTransfers > 0 && (
                <Link to="/admin/transactions?kind=seat_payment" className="flex items-center gap-3 border border-amber-500/30 bg-amber-500/5 p-4 hover:bg-amber-500/10 transition-colors">
                    <AlertCircle size={18} className="text-amber-600 shrink-0" />
                    <div>
                        <p className="text-sm font-medium">{data.pendingDirectTransfers} Direct Transfer payment{data.pendingDirectTransfers === 1 ? "" : "s"} awaiting confirmation</p>
                        <p className="text-xs text-muted-foreground">Unlike Paystack, these need a human to check the bank account and confirm the money actually arrived. View in Transactions →</p>
                    </div>
                </Link>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="border border-border p-5 bg-card">
                        <p className="text-2xl font-light">{s.value}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">{s.help}</p>
                    </div>
                ))}
            </div>

            <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Top services by joined seats</h2>
                <div className="border border-border bg-card divide-y divide-border">
                    {(data.topServices || []).length === 0 && <p className="p-5 text-sm text-muted-foreground">No activity yet.</p>}
                    {(data.topServices || []).map((s: any) => (
                        <div key={s.name} className="flex items-center justify-between px-5 py-3 text-sm">
                            <span>{s.name}</span>
                            <span className="font-semibold">{s.seatsJoined} seats</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
