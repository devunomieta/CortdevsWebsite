import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    TrendingUp,
    TrendingDown,
    Target,
    Users,
    DollarSign,
    Mail,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
    ArrowRight,
    MessageSquare,
    Star,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    X
} from "lucide-react";

interface AnalyticsData {
    current: {
        leads: number;
        clients: number;
        revenue: number;
        subscribers: number;
    };
    previousMTD: {
        leads: number;
        clients: number;
        revenue: number;
        subscribers: number;
    };
    reviews: {
        total: number;
        averageRating: number;
        complaints: any[];
        praise: any[];
    };
}

export function Analytics() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showStrategyModal, setShowStrategyModal] = useState(false);

    const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();

            const startOfMonth = new Date(year, month, 1).toISOString();
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

            // For Previous MTD, we compare to the previous month
            const startOfPrevMonth = new Date(year, month - 1, 1).toISOString();
            const endOfPrevMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

            // 1. Leads
            const { data: curLeads, count: curLeadsCount } = await supabase.from('leads').select('*', { count: 'exact' }).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
            const { data: prevLeads, count: prevLeadsCount } = await supabase.from('leads').select('*', { count: 'exact' }).gte('created_at', startOfPrevMonth).lte('created_at', endOfPrevMonth);

            // 2. Clients & Revenue
            const { data: curClients } = await supabase.from('clients').select('total_value, review, created_at').gte('created_at', startOfMonth).lte('created_at', endOfMonth);
            const { data: prevClients } = await supabase.from('clients').select('total_value, created_at').gte('created_at', startOfPrevMonth).lte('created_at', endOfPrevMonth);

            // 3. Transactions
            const { data: curTransactions } = await supabase.from('transactions').select('amount, type').gte('date', startOfMonth).lte('date', endOfMonth).eq('type', 'Income');
            const { data: prevTransactions } = await supabase.from('transactions').select('amount, type').gte('date', startOfPrevMonth).lte('date', endOfPrevMonth).eq('type', 'Income');

            // 4. Newsletter
            const { data: curSubs, count: curSubsCount } = await supabase.from('newsletter_subscribers').select('*', { count: 'exact' }).gte('created_at', startOfMonth).lte('created_at', endOfMonth);
            const { data: prevSubs, count: prevSubsCount } = await supabase.from('newsletter_subscribers').select('*', { count: 'exact' }).gte('created_at', startOfPrevMonth).lte('created_at', endOfPrevMonth);

            // Process Data
            const curRev = (curClients?.reduce((acc: number, c: any) => acc + parseFloat(c.total_value?.replace(/[^0-9.]/g, '') || "0"), 0) || 0) +
                (curTransactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0);

            const prevRev = (prevClients?.reduce((acc: number, c: any) => acc + parseFloat(c.total_value?.replace(/[^0-9.]/g, '') || "0"), 0) || 0) +
                (prevTransactions?.reduce((acc: number, t: any) => acc + Number(t.amount), 0) || 0);

            // Extract Review Data
            const allClientsWithReviews = await supabase.from('clients').select('review').not('review', 'is', null);
            const reviews = allClientsWithReviews.data || [];

            let totalRating = 0;
            let ratingCount = 0;
            const complaints: any[] = [];
            const praise: any[] = [];

            reviews.forEach((c: any) => {
                const r = c.review;
                if (r && r.rating) {
                    totalRating += r.rating;
                    ratingCount++;
                    if (r.rating <= 3) complaints.push(r);
                    else praise.push(r);
                }
            });

            setData({
                current: {
                    leads: curLeadsCount || 0,
                    clients: curClients?.length || 0,
                    revenue: curRev,
                    subscribers: curSubsCount || 0
                },
                previousMTD: {
                    leads: prevLeadsCount || 0,
                    clients: prevClients?.length || 0,
                    revenue: prevRev,
                    subscribers: prevSubsCount || 0
                },
                reviews: {
                    total: ratingCount,
                    averageRating: ratingCount > 0 ? totalRating / ratingCount : 0,
                    complaints: complaints.slice(0, 3),
                    praise: praise.slice(0, 3)
                }
            });

        } catch (err) {
            console.error("Analytics fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [selectedDate]);

    const getSuggestion = (key: keyof AnalyticsData['current']) => {
        if (!data) return "";
        const growth = calculateGrowth(data.current[key], data.previousMTD[key]);

        switch (key) {
            case 'leads':
                return growth < 0 ? "Ad spend seems inefficient this month. Consider retargeting previous visitors." : "High lead volume detected. Ensure the sales team is following up within 24 hours.";
            case 'clients':
                return growth < 0 ? "Conversion rate is dipping. Consider a limited-time consultation offer." : "Excellent conversion! Scaling operations might be necessary soon.";
            case 'revenue':
                return growth < 0 ? "Revenue is lagging. Focus on closing pending invoices or upselling." : "Revenue target smashed. Reinvest 10% into system automation.";
            case 'subscribers':
                return growth < 0 ? "Audience growth stalled. Launch a value-driven lead magnet." : "Newsletter reach is expanding. Perfect time for a service announcement.";
            default:
                return "";
        }
    };

    const handleMonthChange = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setSelectedDate(newDate);
    };

    if (isLoading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
                <RefreshCw size={32} className="animate-spin text-neutral-200" />
                <p className="text-xs uppercase tracking-widest text-neutral-400 font-bold">Synthesizing Business Intelligence...</p>
            </div>
        );
    }

    if (!data) return <div>Failed to load intelligence.</div>;

    const metrics = [
        { label: "Acquisition Leads", key: 'leads' as const, icon: <Target />, value: data.current.leads, prev: data.previousMTD.leads },
        { label: "Client Conversion", key: 'clients' as const, icon: <Users />, value: data.current.clients, prev: data.previousMTD.clients },
        { label: "Operational Revenue", key: 'revenue' as const, icon: <DollarSign />, value: `$${data.current.revenue.toLocaleString()}`, prev: data.previousMTD.revenue },
        { label: "Marketing Reach", key: 'subscribers' as const, icon: <Mail />, value: data.current.subscribers, prev: data.previousMTD.subscribers },
    ];

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-light tracking-tighter italic">Analytics Hub</h2>
                    <p className="text-sm text-neutral-500 max-w-md">Compare Month-To-Date performance against historical baselines to identify scaling opportunities.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 border border-neutral-200 p-1">
                        <button
                            onClick={() => handleMonthChange(-1)}
                            className="p-2 hover:bg-neutral-100 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div className="px-4 text-[10px] font-bold uppercase tracking-widest text-black">
                            {selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            onClick={() => handleMonthChange(1)}
                            disabled={selectedDate.getMonth() === new Date().getMonth() && selectedDate.getFullYear() === new Date().getFullYear()}
                            className="p-2 hover:bg-neutral-100 transition-colors disabled:opacity-20"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Growth Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((m) => {
                    const growth = calculateGrowth(
                        typeof m.value === 'string' ? parseFloat(m.value.replace(/[^0-9.]/g, '')) : m.value,
                        m.prev
                    );
                    return (
                        <div key={m.label} className="bg-white p-6 border border-neutral-200 flex flex-col justify-between relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="p-2 border border-neutral-100 text-neutral-400 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all">
                                    {m.icon}
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] font-bold ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {Math.abs(growth).toFixed(1)}%
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">{m.label}</p>
                                <h3 className="text-2xl font-light tracking-tight">{m.value}</h3>
                                <p className="text-[9px] text-neutral-400 mt-2 uppercase tracking-tight">vs {m.prev.toLocaleString()} last MTD</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Growth Identifier & Suggestions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-neutral-900 text-white p-10 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <Lightbulb className="text-yellow-400" size={24} />
                            <h3 className="text-xl font-light italic">Growth Strategy Engine</h3>
                        </div>

                        <div className="space-y-6">
                            {metrics.map((m) => {
                                const growth = calculateGrowth(
                                    typeof m.value === 'string' ? parseFloat(m.value.replace(/[^0-9.]/g, '')) : m.value,
                                    m.prev
                                );
                                return (
                                    <div key={m.label} className="flex gap-6 items-start border-l-2 border-white/10 pl-6 py-2 group">
                                        <div className={`mt-1 ${growth < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                            {growth < 0 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white/80 transition-colors">
                                                {m.label} Focus
                                            </p>
                                            <p className="text-sm mt-1 font-light leading-relaxed">
                                                {getSuggestion(m.key)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sentiment Analysis */}
                <div className="bg-white border border-neutral-200 p-8">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-8 border-b border-neutral-100 pb-4 flex items-center justify-between">
                        Sentiment Analysis <MessageSquare size={14} />
                    </h3>

                    <div className="mb-10 text-center">
                        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">CSI Score</p>
                        <div className="flex items-center justify-center gap-1 mb-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star
                                    key={i}
                                    size={16}
                                    className={i <= Math.round(data.reviews.averageRating) ? "text-yellow-400 fill-yellow-400" : "text-neutral-200"}
                                />
                            ))}
                        </div>
                        <h4 className="text-4xl font-light italic">{data.reviews.averageRating.toFixed(1)}<span className="text-sm text-neutral-300 not-italic">/5</span></h4>
                        <p className="text-[10px] text-neutral-400 mt-2">Based on {data.reviews.total} project reviews</p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                                Critical Friction <TrendingDown size={12} />
                            </p>
                            <div className="space-y-3">
                                {data.reviews.complaints.length > 0 ? data.reviews.complaints.map((r, i) => (
                                    <div key={i} className="text-[11px] p-3 bg-red-50 border-l-2 border-red-200 text-red-800 italic leading-snug">
                                        "{r.comment}"
                                    </div>
                                )) : <p className="text-[10px] text-neutral-400 italic">No critical friction detected.</p>}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-3 flex items-center gap-2">
                                Success Signals <TrendingUp size={12} />
                            </p>
                            <div className="space-y-3">
                                {data.reviews.praise.length > 0 ? data.reviews.praise.map((r, i) => (
                                    <div key={i} className="text-[11px] p-3 bg-green-50 border-l-2 border-green-200 text-green-800 italic leading-snug">
                                        "{r.comment}"
                                    </div>
                                )) : <p className="text-[10px] text-neutral-400 italic">No success signals recorded yet.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparative Visual */}
            <div className="bg-white border border-neutral-200 p-8">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        Efficiency Breakdown <BarChart3 size={14} />
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        {metrics.map((m) => {
                            const ratio = Math.min((data.current[m.key] / (m.prev || 1)) * 100, 100);
                            return (
                                <div key={m.label}>
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                                        <span className="text-neutral-500">{m.label} Target Pulse</span>
                                        <span className="text-black">{ratio.toFixed(0)}% Capacity</span>
                                    </div>
                                    <div className="h-[2px] w-full bg-neutral-100 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${ratio}%` }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className={`h-full ${ratio >= 100 ? 'bg-green-500' : 'bg-black'}`}
                                        ></motion.div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-neutral-50 p-8 flex flex-col justify-center border border-neutral-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Core Recommendation</p>
                        <h4 className="text-xl font-light italic mb-4 leading-tight">
                            {data.current.revenue > data.previousMTD.revenue
                                ? "Infrastructure stability over acquisition. Solidify internal workflows to handle the higher revenue throughput."
                                : "Aggressive acquisition mode. Trigger lead magnets across all social channels to bridge the revenue gap."}
                        </h4>
                        <button
                            onClick={() => setShowStrategyModal(true)}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-900 group cursor-pointer hover:text-green-600 transition-colors"
                        >
                            Full Strategy Doc <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Strategy Modal */}
            <AnimatePresence>
                {showStrategyModal && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            className="bg-white w-full max-w-4xl h-[80vh] overflow-y-auto p-12 relative shadow-4xl text-black"
                        >
                            <button
                                onClick={() => setShowStrategyModal(false)}
                                className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="space-y-12">
                                <header className="border-b border-neutral-100 pb-8">
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">
                                        <Target size={12} /> CORTDEVS Intelligence Report
                                    </div>
                                    <h3 className="text-5xl font-light italic tracking-tighter">Growth Strategy Directive</h3>
                                    <p className="text-neutral-500 mt-4 uppercase text-[10px] font-bold tracking-widest">Session Period: {selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <section className="space-y-6 text-left">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2">Operational Summary</h4>
                                        <div className="space-y-4">
                                            <p className="text-sm leading-relaxed text-neutral-600">
                                                The audit for {selectedDate.toLocaleDateString(undefined, { month: 'long' })} indicates a {calculateGrowth(data.current.revenue, data.previousMTD.revenue).toFixed(1)}% delta in operational revenue.
                                                Our "Efficiency Breakdown" suggests that we are operating at {Math.min((data.current.revenue / (data.previousMTD.revenue || 1)) * 100, 100).toFixed(0)}% of the projected quarterly baseline.
                                            </p>
                                            <div className="p-6 bg-neutral-900 text-white italic text-lg font-light leading-relaxed">
                                                "Current trajectory suggests a {data.current.revenue > data.previousMTD.revenue ? 'scaling' : 'contraction'} phase that requires immediate {data.current.revenue > data.previousMTD.revenue ? 'infrastructure reinforcement' : 'acquisition aggression'}."
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-8 text-left">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-2">Strategic Recommendations</h4>
                                        <div className="space-y-8">
                                            {metrics.map((m) => {
                                                const growth = calculateGrowth(
                                                    typeof m.value === 'string' ? parseFloat(m.value.replace(/[^0-9.]/g, '')) : m.value,
                                                    m.prev
                                                );
                                                return (
                                                    <div key={m.label} className="group">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-900">{m.label}</p>
                                                            <span className={`text-[10px] font-mono ${growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-neutral-500 leading-relaxed font-light italic">
                                                            Suggested Action: {getSuggestion(m.key)}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                </div>

                                <section className="p-10 border border-neutral-100 bg-neutral-50/50 space-y-6">
                                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Implementation Roadmap</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-tight text-neutral-900 italic">Phase I: Stabilization</p>
                                            <p className="text-[11px] text-neutral-500 font-light">Audit current technical overhead and resolve bottlenecks in client delivery.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-tight text-neutral-900 italic">Phase II: Acquisition</p>
                                            <p className="text-[11px] text-neutral-500 font-light">Leverage successful project case studies into the newsletter network for retargeting.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold uppercase tracking-tight text-neutral-900 italic">Phase III: Upscaling</p>
                                            <p className="text-[11px] text-neutral-500 font-light">Introduce premium retainer tiers for existing high-value clientele.</p>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
