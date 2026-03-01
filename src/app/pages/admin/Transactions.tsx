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
    RefreshCw,
    X,
    ChevronLeft,
    ChevronRight,
    FileText,
    Layers,
    Trash2,
    ArrowUp,
    ArrowDown,
    Printer
} from "lucide-react";
import { useToast } from "../../components/Toast";

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
    const [clients, setClients] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [filter, setFilter] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [relatedHistory, setRelatedHistory] = useState<Transaction[]>([]);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);

    // Form State
    const [newTx, setNewTx] = useState({
        client_id: "",
        type: "Income",
        amount: "",
        description: "",
        category: "Project Payment",
        status: "Completed",
        date: new Date().toISOString().split('T')[0]
    });

    const { showToast } = useToast();

    const fetchTransactions = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, clients(full_name, company)')
                .order('date', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error("Error fetching transactions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('id, full_name, company')
                .order('full_name');
            if (error) throw error;
            setClients(data || []);
        } catch (err) {
            console.error("Error fetching clients:", err);
        }
    };

    const fetchRelatedHistory = async (clientId: string) => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('client_id', clientId)
                .order('date', { ascending: false })
                .limit(5);
            if (error) throw error;
            setRelatedHistory(data || []);
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    useEffect(() => {
        fetchTransactions();
        fetchClients();
    }, []);

    const handleRecordTransaction = async () => {
        if (!newTx.amount || !newTx.description) {
            showToast("Please fill all required fields", "error");
            return;
        }

        setIsAdding(true);
        try {
            const { error } = await supabase
                .from('transactions')
                .insert([{
                    ...newTx,
                    amount: parseFloat(newTx.amount),
                    client_id: newTx.client_id || null
                }]);

            if (error) throw error;

            showToast("Transaction recorded successfully", "success");
            setShowAddModal(false);
            fetchTransactions();
            setNewTx({
                client_id: "",
                type: "Income",
                amount: "",
                description: "",
                category: "Project Payment",
                status: "Completed",
                date: new Date().toISOString().split('T')[0]
            });
        } catch (err: any) {
            showToast(err.message || "Failed to record transaction", "error");
        } finally {
            setIsAdding(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesFilter = filter === 'All' || t.type === filter;
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleDownloadExcel = () => {
        const headers = ["S/N", "Date", "Entity", "Description", "Category", "Amount", "Type", "Status"];
        const rows = filteredTransactions.map((t: any, i) => [
            i + 1,
            new Date(t.date).toLocaleDateString(),
            t.clients?.full_name || "Operational",
            t.description,
            t.category,
            t.amount,
            t.type,
            t.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `CORTDEVS_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("Excel Export ready", "success");
    };

    const handleDownloadPDF = () => {
        window.print();
    };

    const totalIncome = transactions
        .filter(t => t.type === 'Income' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'Expense' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Global Print Watermark Style */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .print-watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 8rem;
                        color: rgba(0,0,0,0.05);
                        z-index: -1;
                        pointer-events: none;
                        font-weight: 900;
                        white-space: nowrap;
                    }
                }
            `}} />

            <div className="flex justify-between items-end printable-hide">
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
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                    >
                        Record Transaction <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 printable-hide">
                <div className="bg-white p-8 border border-neutral-200 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">Net Position</p>
                        <h3 className="text-4xl font-light tracking-tighter italic">
                            ${(totalIncome - totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
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
                        <ArrowUp size={14} className="text-green-500" /> Operational Inflow
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
                        <ArrowDown size={14} className="text-red-500" /> Resource Outflow
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div id="print-area" className="bg-white border border-neutral-200 overflow-hidden">
                <div className="print-watermark hidden print:block">CORTDEVS</div>
                <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50 printable-hide">
                    <div className="flex items-center gap-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest">Transaction Audit</h3>
                        <div className="flex gap-2">
                            {['All', 'Income', 'Expense'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => { setFilter(type); setCurrentPage(1); }}
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
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                className="pl-10 pr-4 py-2 bg-white border border-neutral-200 text-[10px] uppercase tracking-widest outline-none focus:border-black w-64 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                className="p-2 border border-neutral-200 text-neutral-400 hover:text-black transition-colors"
                            >
                                <Download size={16} />
                            </button>
                            <AnimatePresence>
                                {showDownloadMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 mt-2 w-48 bg-white border border-neutral-100 shadow-2xl p-2 z-50"
                                    >
                                        <button
                                            onClick={() => { handleDownloadExcel(); setShowDownloadMenu(false); }}
                                            className="w-full text-left p-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center gap-3"
                                        >
                                            <FileText size={14} /> Export CSV/Excel
                                        </button>
                                        <button
                                            onClick={() => { handleDownloadPDF(); setShowDownloadMenu(false); }}
                                            className="w-full text-left p-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center gap-3"
                                        >
                                            <Printer size={14} /> Brand PDF (Print)
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                <th className="p-6 w-16">S/N</th>
                                <th className="p-6">Date & Reference</th>
                                <th className="p-6">Entity / Description</th>
                                <th className="p-6">Category</th>
                                <th className="p-6">Magnitude</th>
                                <th className="p-6 text-right printable-hide">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-32 text-center">
                                        <RefreshCw size={24} className="mx-auto animate-spin text-neutral-200 mb-4" />
                                        <p className="text-xs italic text-neutral-400">Decrypting financial records...</p>
                                    </td>
                                </tr>
                            ) : paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-32 text-center text-neutral-400">
                                        <Calendar size={40} className="mx-auto mb-4 opacity-10" />
                                        <p className="text-xs italic">No transactions recorded in the current epoch.</p>
                                    </td>
                                </tr>
                            ) : paginatedTransactions.map((t, index) => (
                                <tr
                                    key={t.id}
                                    onClick={() => {
                                        setSelectedTransaction(t);
                                        if (t.client_id) fetchRelatedHistory(t.client_id);
                                    }}
                                    className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors group cursor-pointer"
                                >
                                    <td className="p-6 text-xs text-neutral-300 font-mono">
                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                    </td>
                                    <td className="p-6">
                                        <p className="font-mono text-[11px] text-neutral-900">
                                            {new Date(t.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">REF: {t.id.slice(0, 8)}</p>
                                    </td>
                                    <td className="p-6">
                                        <p className="font-medium text-black">{t.clients?.full_name || "Operational"}</p>
                                        <p className="text-xs text-neutral-500 italic font-light truncate max-w-xs">{t.description}</p>
                                    </td>
                                    <td className="p-6">
                                        <span className="text-[10px] font-bold uppercase tracking-widest bg-neutral-100 px-2 py-1 text-neutral-600">
                                            {t.category}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <p className={`font-semibold ${t.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                            {t.type === 'Income' ? '+' : '-'} ${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </p>
                                    </td>
                                    <td className="p-6 text-right printable-hide">
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="p-6 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50 printable-hide">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} auditing entries
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 border border-neutral-200 disabled:opacity-30 hover:bg-white transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1 font-mono text-xs px-4">
                                <span className="text-black font-bold">{currentPage}</span>
                                <span className="text-neutral-300">/</span>
                                <span className="text-neutral-400">{totalPages}</span>
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-neutral-200 disabled:opacity-30 hover:bg-white transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Record Transaction Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            className="bg-white border border-neutral-200 w-full max-w-2xl p-10 relative shadow-2xl"
                        >
                            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-neutral-400 hover:text-black">
                                <X size={20} />
                            </button>
                            <h3 className="text-3xl font-light italic mb-8">Record Financial Event</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 text-left">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Transaction Type</label>
                                        <div className="flex border border-neutral-200 p-1">
                                            {["Income", "Expense"].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setNewTx({ ...newTx, type: type as any })}
                                                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${newTx.type === type ? 'bg-black text-white' : 'text-neutral-400 hover:bg-neutral-50'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Associated Entity</label>
                                        <select
                                            value={newTx.client_id}
                                            onChange={(e) => setNewTx({ ...newTx, client_id: e.target.value })}
                                            className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-[11px] uppercase tracking-widest bg-white"
                                        >
                                            <option value="">N/A (Operational)</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.full_name} {c.company ? `(${c.company})` : ''}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Magnitude (USD)</label>
                                        <input
                                            type="number"
                                            placeholder="0.00"
                                            value={newTx.amount}
                                            onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                                            className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 text-left">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Categorization</label>
                                        <select
                                            value={newTx.category}
                                            onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                                            className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-[11px] uppercase tracking-widest bg-white"
                                        >
                                            <option value="Project Payment">Project Payment</option>
                                            <option value="Operational Grant">Operational Grant</option>
                                            <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                                            <option value="Legal & Admin">Legal & Admin</option>
                                            <option value="Asset Procurement">Asset Procurement</option>
                                            <option value="Others">Others</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Description</label>
                                        <textarea
                                            placeholder="Transaction narrative..."
                                            value={newTx.description}
                                            onChange={(e) => setNewTx({ ...newTx, description: e.target.value })}
                                            className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-xs h-32 resize-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleRecordTransaction}
                                disabled={isAdding}
                                className="w-full mt-10 bg-black text-white py-5 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-neutral-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isAdding ? <RefreshCw className="animate-spin" size={14} /> : 'Sync with Ledger'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Transaction Detail Modal */}
            <AnimatePresence>
                {selectedTransaction && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-4xl relative shadow-2xl overflow-hidden"
                        >
                            <div className="flex h-[70vh]">
                                <div className="w-1/3 bg-neutral-900 text-white p-10 flex flex-col justify-between">
                                    <div>
                                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-6">
                                            <DollarSign size={24} className="text-green-500" />
                                        </div>
                                        <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-bold mb-2">Record Identifier</p>
                                        <h3 className="font-mono text-xl mb-12">{selectedTransaction.id.slice(0, 16)}...</h3>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest block mb-2">Primary Entity</label>
                                                <p className="text-lg font-light italic">{selectedTransaction.clients?.full_name || "Operational Outflow"}</p>
                                                {selectedTransaction.clients?.company && (
                                                    <p className="text-[10px] text-neutral-400 uppercase mt-1">{selectedTransaction.clients.company}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest block mb-1">Magnitude</label>
                                                <p className={`text-4xl font-light italic ${selectedTransaction.type === 'Income' ? 'text-green-500' : 'text-red-400'}`}>
                                                    {selectedTransaction.type === 'Income' ? '+' : '-'}${parseFloat(selectedTransaction.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedTransaction(null)}
                                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors"
                                    >
                                        Close Record
                                    </button>
                                </div>
                                <div className="flex-1 p-12 bg-white flex flex-col">
                                    <div className="flex justify-between items-start mb-12">
                                        <div className="space-y-4">
                                            <h4 className="text-2xl font-light italic">Payment Archetype</h4>
                                            <div className="flex gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold uppercase text-neutral-400">Class</label>
                                                    <p className="text-xs font-semibold uppercase tracking-widest">{selectedTransaction.category}</p>
                                                </div>
                                                <div className="w-px h-8 bg-neutral-100" />
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold uppercase text-neutral-400">Timestamp</label>
                                                    <p className="text-xs font-semibold uppercase tracking-widest">
                                                        {new Date(selectedTransaction.date).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-2 border border-neutral-100 rounded-full flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${selectedTransaction.status === 'Completed' ? 'bg-green-500' : 'bg-orange-400'}`} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">{selectedTransaction.status}</span>
                                        </div>
                                    </div>

                                    <div className="mb-12">
                                        <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-3 block">Narrative</label>
                                        <div className="p-6 bg-neutral-50 border border-neutral-100 italic text-sm text-neutral-600 leading-relaxed font-light">
                                            "{selectedTransaction.description}"
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-hidden flex flex-col">
                                        <div className="flex items-center gap-4 mb-4">
                                            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest">Client Payment History</label>
                                            <div className="flex-1 h-px bg-neutral-100" />
                                        </div>
                                        <div className="space-y-3 overflow-y-auto pr-4">
                                            {selectedTransaction.client_id ? (
                                                relatedHistory.length > 0 ? (
                                                    relatedHistory.filter(h => h.id !== selectedTransaction.id).map(history => (
                                                        <div key={history.id} className="p-4 border border-neutral-50 flex justify-between items-center group hover:bg-neutral-50 transition-all">
                                                            <div>
                                                                <p className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest">{history.category}</p>
                                                                <p className="text-[9px] text-neutral-400 uppercase font-mono">{new Date(history.date).toLocaleDateString()}</p>
                                                            </div>
                                                            <p className={`text-xs font-bold ${history.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                                                {history.type === 'Income' ? '+' : '-'}${parseFloat(history.amount.toString()).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-neutral-400 italic">No previous transaction sync detected.</p>
                                                )
                                            ) : (
                                                <p className="text-xs text-neutral-400 italic">Historical data unavailable for operational events.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
