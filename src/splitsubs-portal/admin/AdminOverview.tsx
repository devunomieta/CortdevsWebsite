import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ssFetch } from "../lib/api";

const money = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

export function AdminOverview() {
    const [data, setData] = useState<any>(null);

    useEffect(() => { ssFetch("/api/admin/splitsubs/analytics").then(setData).catch(() => { }); }, []);

    if (!data) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    const stats = [
        { label: "Gross Split Volume", value: money(data.gsv) },
        { label: "Take-rate revenue", value: money(data.takeRateRevenue) },
        { label: "Active listings", value: data.activeListings },
        { label: "Seat fill rate", value: `${data.fillRate}%` },
        { label: "Dispute rate", value: `${data.disputeRate}%` },
        { label: "Open disputes", value: data.openDisputes },
        { label: "Insurance pool balance", value: money(data.insurancePoolBalance) },
    ];

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Overview</h1>
                <p className="text-sm text-muted-foreground">Platform health, per the PRD's core metrics.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="border border-border p-5 bg-card">
                        <p className="text-2xl font-light">{s.value}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">{s.label}</p>
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
