import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    DollarSign,
    ArrowUpRight,
    ArrowDownLeft,
    Search,
    Filter,
    Download,
    Plus,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    RefreshCw
} from "lucide-react";

interface Transaction {
    id: string;
    client_id: string | null;
    type: "Income" | "Expense";
    amount: number;
    description: string;
    category: string;
    status: "Pending" | "Completed" | "Failed";
    date: string;
    clients?: { full_name: string };
}

export function Transactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState("All");

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, clients(full_name)')
                .order('date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error("Error fetching transactions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const totalIncome = transactions
        .filter(t => t.type === 'Income' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'Expense' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Financial Ledger</h2>
                    <p className="text-sm text-neutral-500">Track revenue, project expenses, and operational overhead.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchTransactions}
                        disabled={isLoading}
                        className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10">
                        Record Transaction <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 border border-neutral-200 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Net Position</p>
                        <h3 className="text-4xl font-light tracking-tighter italic">
                            ${(totalIncome - totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                        <DollarSign size={120} />
                    </div>
                </div>

                <div className="bg-white p-8 border border-neutral-200 flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-green-600 font-bold mb-1">Gross Revenue</p>
                        <h3 className="text-2xl font-medium tracking-tight text-neutral-900">
                            + ${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <ArrowUpRight size={14} className="text-green-500" /> Operational Inflow
                    </div>
                </div>

                <div className="bg-white p-8 border border-neutral-200 flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1">Operational Spend</p>
                        <h3 className="text-2xl font-medium tracking-tight text-neutral-900">
                            - ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <ArrowDownLeft size={14} className="text-red-500" /> Resource Outflow
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white border border-neutral-200 overflow-hidden">
                <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                    <div className="flex items-center gap-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest">Transaction Audit</h3>
                        <div className="flex gap-2">
                            {['All', 'Income', 'Expense'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setFilter(type)}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-tight border ${filter === type ? 'bg-black text-white border-black' : 'border-neutral-200 text-neutral-400 hover:border-black hover:text-black'} transition-all`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Search ledger..."
                                className="pl-10 pr-4 py-2 bg-white border border-neutral-200 text-[10px] uppercase tracking-widest outline-none focus:border-black w-64 transition-all"
                            />
                        </div>
                        <button className="p-2 border border-neutral-200 text-neutral-400 hover:text-black transition-colors">
                            <Download size={16} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                <th className="p-6">Date & Reference</th>
                                <th className="p-6">Entity / Description</th>
                                <th className="p-6">Category</th>
                                <th className="p-6">Magnitude</th>
                                <th className="p-6 text-right">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-32 text-center">
                                        <RefreshCw size={24} className="mx-auto animate-spin text-neutral-200 mb-4" />
                                        <p className="text-xs italic text-neutral-400">Decrypting financial records...</p>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-32 text-center text-neutral-400">
                                        <Calendar size={40} className="mx-auto mb-4 opacity-10" />
                                        <p className="text-xs italic">No transactions recorded in the current epoch.</p>
                                    </td>
                                </tr>
                            ) : transactions
                                .filter(t => filter === 'All' || t.type === filter)
                                .map((t) => (
                                    <tr key={t.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors group">
                                        <td className="p-6">
                                            <p className="font-mono text-[11px] text-neutral-900">
                                                {new Date(t.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">REF: {t.id.slice(0, 8)}</p>
                                        </td>
                                        <td className="p-6">
                                            <p className="font-medium text-black">{t.clients?.full_name || "Operational"}</p>
                                            <p className="text-xs text-neutral-500 italic font-light">{t.description}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-neutral-100 px-2 py-1 text-neutral-600">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <p className={`font-semibold ${t.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                                {t.type === 'Income' ? '+' : '-'} ${Number(t.amount).toLocaleString()}
                                            </p>
                                        </td>
                                        <td className="p-6 text-right">
                                            {t.status === 'Completed' ? (
                                                <div className="flex items-center justify-end gap-2 text-green-600">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">VERIFIED</span>
                                                    <CheckCircle2 size={12} />
                                                </div>
                                            ) : t.status === 'Pending' ? (
                                                <div className="flex items-center justify-end gap-2 text-orange-500">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">ON HOLD</span>
                                                    <Clock size={12} />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2 text-red-500">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">REJECTED</span>
                                                    <AlertCircle size={12} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
