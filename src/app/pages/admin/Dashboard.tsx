import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import {
    Users,
    MessageSquare,
    TrendingUp,
    DollarSign,
    ArrowUpRight,
    Clock,
    CheckCircle2,
    RefreshCw,
    HelpCircle,
    Info
} from "lucide-react";

interface Stat {
    label: string;
    value: string;
    icon: React.ReactNode;
    trend: string;
    color: string;
    path: string | null;
}

export function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stat[]>([
        { label: "Active Project Leads", value: "0", icon: <MessageSquare />, trend: "---", color: "bg-blue-500", path: "/admin/leads" },
        { label: "Total Clients", value: "0", icon: <Users />, trend: "---", color: "bg-green-500", path: "/admin/clients" },
        { label: "Closed Revenue", value: "$0.00", icon: <DollarSign />, trend: "---", color: "bg-purple-500", path: "/admin/transactions" },
        { label: "MTD Growth", value: "0%", icon: <TrendingUp />, trend: "---", color: "bg-orange-500", path: null },
    ]);

    const [recentLeads, setRecentLeads] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showMTDInfo, setShowMTDInfo] = useState(false);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Lead count
            const { count: leadCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true });

            // 2. Fetch Client count & Revenue
            const { data: clientsData, count: clientCount } = await supabase
                .from('clients')
                .select('total_value', { count: 'exact' });

            const revenue = clientsData?.reduce((acc: number, c: any) => acc + parseFloat(c.total_value.replace(/[^0-9.]/g, '') || "0"), 0) || 0;

            // 3. Fetch Recent Leads
            const { data: leadsData } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(4);

            // 4. Calculate MTD Revenue Growth
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

            const { data: currentMonthRev } = await supabase
                .from('clients')
                .select('total_value, created_at')
                .gte('created_at', startOfMonth);

            const { data: lastMonthRev } = await supabase
                .from('clients')
                .select('total_value, created_at')
                .gte('created_at', startOfLastMonth)
                .lte('created_at', endOfLastMonth);

            const currentTotal = currentMonthRev?.reduce((acc: number, c: any) => acc + parseFloat(c.total_value.replace(/[^0-9.]/g, '') || "0"), 0) || 0;
            const lastTotal = lastMonthRev?.reduce((acc: number, c: any) => acc + parseFloat(c.total_value.replace(/[^0-9.]/g, '') || "0"), 0) || 0;

            let growth = "0%";
            if (lastTotal > 0) {
                growth = `${(((currentTotal - lastTotal) / lastTotal) * 100).toFixed(1)}%`;
            } else if (currentTotal > 0) {
                growth = "100%";
            }

            setStats([
                { label: "Active Project Leads", value: leadCount?.toString() || "0", icon: <MessageSquare />, trend: "Realtime", color: "bg-blue-500", path: "/admin/leads" },
                { label: "Total Clients", value: clientCount?.toString() || "0", icon: <Users />, trend: "Verified", color: "bg-green-500", path: "/admin/clients" },
                { label: "Closed Revenue", value: `$${revenue.toLocaleString()}`, icon: <DollarSign />, trend: "Confirmed", color: "bg-purple-500", path: "/admin/transactions" },
                { label: "MTD Growth", value: growth, icon: <TrendingUp />, trend: "Comparative", color: "bg-orange-500", path: "/admin/analytics" },
            ]);

            if (leadsData) {
                setRecentLeads(leadsData.map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    company: l.email.split('@')[0], // Mock company from email if not present
                    service: l.service,
                    status: l.status,
                    time: new Date(l.created_at).toLocaleDateString()
                })));
            }

        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => {
                    const Card = (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white p-6 border border-neutral-200 h-full flex flex-col justify-between group hover:shadow-xl transition-shadow cursor-pointer relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 text-white ${stat.color} rounded-sm`}>
                                    {stat.icon}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] bg-neutral-100 border border-neutral-200 px-2 py-0.5 font-bold text-neutral-500 uppercase">
                                        {stat.trend}
                                    </span>
                                    {stat.label === "MTD Growth" && (
                                        <button
                                            onMouseEnter={() => setShowMTDInfo(true)}
                                            onMouseLeave={() => setShowMTDInfo(false)}
                                            className="text-neutral-400 hover:text-black transition-colors"
                                        >
                                            <Info size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</p>
                                <h3 className="text-3xl font-light tracking-tight">{stat.value}</h3>
                            </div>

                            {stat.label === "MTD Growth" && (
                                <AnimatePresence>
                                    {showMTDInfo && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute top-full left-0 right-0 mt-2 p-4 bg-black text-white text-[10px] z-50 leading-relaxed shadow-2xl"
                                        >
                                            <p className="font-bold uppercase tracking-widest mb-2 text-neutral-400">Month-To-Date Explained</p>
                                            MTD compares current month performance (1st to now) against the same day range of the previous month. It helps track if we are scaling or declining in real-time.
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}
                        </motion.div>
                    );

                    return stat.path ? (
                        <Link key={stat.label} to={stat.path}>
                            {Card}
                        </Link>
                    ) : (
                        <div key={stat.label}>{Card}</div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white border border-neutral-200">
                    <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                        <h2 className="text-lg font-light tracking-tight">Recent Project Leads</h2>
                        <Link to="/admin/leads" className="text-xs uppercase tracking-widest font-semibold text-neutral-400 hover:text-black transition-colors">View All</Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-50 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                    <th className="p-6">Client</th>
                                    <th className="p-6">Service</th>
                                    <th className="p-6">Status</th>
                                    <th className="p-6 text-right">Activity</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {recentLeads.map((lead, i) => (
                                    <tr
                                        key={lead.id || i}
                                        onClick={() => lead.id && navigate(`/admin/leads?id=${lead.id}`)}
                                        className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors group cursor-pointer"
                                    >
                                        <td className="p-4 md:p-6 text-sm">
                                            <p className="font-medium text-black">{lead.name}</p>
                                            <p className="text-[10px] md:text-xs text-neutral-500">{lead.company}</p>
                                        </td>
                                        <td className="p-4 md:p-6 text-neutral-600 font-light text-xs md:text-sm">{lead.service}</td>
                                        <td className="p-4 md:p-6">
                                            <span className="px-2 md:px-3 py-1 bg-neutral-900 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-tighter rounded-full">
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="p-4 md:p-6 text-right text-[10px] md:text-xs text-neutral-400 whitespace-nowrap">{lead.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-neutral-900 text-white p-8 group relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-light mb-8 leading-tight">System<br /><span className="italic">Quick Actions</span></h2>
                        <div className="space-y-4">
                            <Link to="/admin/clients" className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Onboard Client <ArrowUpRight className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                            </Link>
                            <Link to="/admin/transactions" className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Issue Invoice <DollarSign size={16} />
                            </Link>
                            <Link to="/admin/comms" className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Send Update <TrendingUp size={16} />
                            </Link>
                        </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                </div>
            </div>
        </div>
    );
}
