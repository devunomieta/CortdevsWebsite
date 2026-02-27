import { motion } from "framer-motion";
import {
    Users,
    MessageSquare,
    TrendingUp,
    DollarSign,
    ArrowUpRight,
    Clock,
    CheckCircle2
} from "lucide-react";

export function Dashboard() {
    const stats = [
        { label: "Active Project Leads", value: "12", icon: <MessageSquare />, trend: "+20%", color: "bg-blue-500" },
        { label: "New Clients (MTD)", value: "5", icon: <Users />, trend: "+2", color: "bg-green-500" },
        { label: "Pending Revenue", value: "$45,200", icon: <DollarSign />, trend: "15% inc", color: "bg-purple-500" },
        { label: "Avg. Response Time", value: "2.5h", icon: <Clock />, trend: "-30m", color: "bg-orange-500" },
    ];

    const recentLeads = [
        { name: "Sarah Johnson", company: "Fintech Solutions", service: "Full-Stack Dev", status: "New", time: "10m ago" },
        { name: "Marcus Chen", company: "Chen Group", service: "WP Revamp", status: "In Contact", time: "2h ago" },
        { name: "Elena Rodriguez", company: "Global Edu", service: "Shopify", status: "Discovery", time: "5h ago" },
        { name: "David Miller", company: "Nexus AI", service: "Consulting", status: "Proposal", time: "1d ago" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 border border-neutral-200 flex flex-col justify-between group hover:shadow-xl transition-shadow cursor-default"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 text-white ${stat.color} rounded-sm`}>
                                {stat.icon}
                            </div>
                            <span className="text-[10px] bg-neutral-100 border border-neutral-200 px-2 py-0.5 font-bold text-neutral-500 uppercase">
                                {stat.trend}
                            </span>
                        </div>
                        <div>
                            <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-1">{stat.label}</p>
                            <h3 className="text-3xl font-light tracking-tight">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white border border-neutral-200">
                    <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                        <h2 className="text-lg font-light tracking-tight">Recent Project Leads</h2>
                        <button className="text-xs uppercase tracking-widest font-semibold text-neutral-400 hover:text-black transition-colors">View All</button>
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
                                    <tr key={i} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors group">
                                        <td className="p-6">
                                            <p className="font-medium text-black">{lead.name}</p>
                                            <p className="text-xs text-neutral-500">{lead.company}</p>
                                        </td>
                                        <td className="p-6 text-neutral-600 font-light">{lead.service}</td>
                                        <td className="p-6">
                                            <span className="px-3 py-1 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-tighter rounded-full">
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right text-xs text-neutral-400">{lead.time}</td>
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
                            <button className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Add New Client <ArrowUpRight className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                            </button>
                            <button className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Issue Invoice <DollarSign size={16} />
                            </button>
                            <button className="w-full p-4 bg-white/10 hover:bg-white text-white hover:text-black text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-between group/btn">
                                Send Update <TrendingUp size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors"></div>
                </div>
            </div>
        </div>
    );
}
