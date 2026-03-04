import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    receipt_url?: string;
    clients?: { full_name: string; project_name?: string; company?: string };
}

interface Commission {
    id: string;
    sales_officer_id: string;
    client_id: string;
    amount: number;
    status: 'Pending' | 'Approved' | 'Paid';
    created_at: string;
    sales_officer?: { full_name: string; email: string };
    clients?: { full_name: string; project_name: string };
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
    const [exportDuration, setExportDuration] = useState("All Time");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [view, setView] = useState<"project" | "treasury" | "commission" | "confirmations">("project");
    const [confirmations, setConfirmations] = useState<any[]>([]);
    const [isConfirmationsLoading, setIsConfirmationsLoading] = useState(false);
    const [treasuryBalance, setTreasuryBalance] = useState(0);
    const [walletTx, setWalletTx] = useState<any[]>([]);
    const [commissions, setCommissions] = useState<Commission[]>([]);

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
                .select('*, clients(full_name, company, project_name)')
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
                .select('id, full_name, company, project_name')
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

    const fetchTreasury = async () => {
        const { data: wallet } = await supabase
            .from('wallets')
            .select('balance, id')
            .eq('type', 'Central')
            .maybeSingle();

        if (wallet) {
            setTreasuryBalance(wallet.balance);
            const { data: tx } = await supabase
                .from('wallet_transactions')
                .select('*, wallets(user_id, email)')
                .order('created_at', { ascending: false })
                .limit(50);
            if (tx) setWalletTx(tx);
        }
    };

    const fetchCommissions = async () => {
        const { data, error } = await supabase
            .from('commissions')
            .select('*, sales_officer:sales_officer_id(full_name, email), clients:client_id(full_name, project_name)')
            .order('created_at', { ascending: false });
        if (!error && data) setCommissions(data);
    };

    const handleApproveCommission = async (id: string) => {
        const { error } = await supabase
            .from('commissions')
            .update({ status: 'Approved' })
            .eq('id', id);
        if (!error) {
            showToast("Commission approved for payout.", "success");
            fetchCommissions();
        }
    };

    const handlePayCommission = async (commission: Commission) => {
        setIsLoading(true);
        try {
            // 1. Get Central Wallet
            const { data: centralWallet } = await supabase
                .from('wallets')
                .select('id, balance')
                .eq('type', 'Central')
                .maybeSingle();

            // 2. Get Sales Officer Wallet
            const { data: officerWallet } = await supabase
                .from('wallets')
                .select('id, balance')
                .eq('user_id', commission.sales_officer_id)
                .maybeSingle();

            if (!centralWallet || !officerWallet) throw new Error("Wallet sync failure.");
            if (centralWallet.balance < commission.amount) throw new Error("Insufficient Treasury funds.");

            // 3. Perform Payout (Personnel Wallet Credit)
            const { error: txError } = await supabase.from('wallet_transactions').insert([{
                wallet_id: officerWallet.id,
                amount: commission.amount,
                type: 'Credit',
                category: 'Commission',
                description: `Commission Payout: ${commission.clients?.full_name || 'Project'}`
            }]);

            if (txError) throw txError;

            // 4. Update status
            const { error: statusError } = await supabase
                .from('commissions')
                .update({ status: 'Paid' })
                .eq('id', commission.id);

            if (statusError) throw statusError;

            showToast("Commission successfully disbursed.", "success");
            fetchCommissions();
            fetchTreasury();
        } catch (err: any) {
            showToast(err.message || "Payout failed.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (conf: any) => {
        const confirmAmount = prompt(`Confirm settlement amount for ${conf.client?.project_name}:`, conf.amount.toString());
        if (!confirmAmount) return;

        const amountNum = parseFloat(confirmAmount);
        if (isNaN(amountNum)) return;

        try {
            // 1. Update confirmation status
            const { error: confError } = await supabase
                .from('payment_confirmations')
                .update({ status: 'Confirmed' })
                .eq('id', conf.id);

            if (confError) throw confError;

            // 2. Fetch current client data
            const { data: client } = await supabase
                .from('clients')
                .select('paid_amount, total_value')
                .eq('id', conf.client_id)
                .single();

            if (client) {
                const currentPaid = parseFloat(client.paid_amount.replace(/[^0-9.]/g, '')) || 0;
                const newPaid = currentPaid + amountNum;

                // 3. Update client paid_amount
                await supabase
                    .from('clients')
                    .update({
                        paid_amount: `$${newPaid.toLocaleString()}`,
                        status: newPaid >= (parseFloat(client.total_value.replace(/[^0-9.]/g, '')) || 0) ? 'Completed' : 'In Progress'
                    })
                    .eq('id', conf.client_id);
            }

            // 4. Create wallet transaction (which triggers sync to main ledger via trigger)
            const { data: centralWallet } = await supabase
                .from('wallets')
                .select('id')
                .eq('type', 'Central')
                .single();

            if (centralWallet) {
                await supabase.from('wallet_transactions').insert([{
                    wallet_id: centralWallet.id,
                    amount: amountNum,
                    type: 'Credit',
                    category: 'Project Payment',
                    description: `Bank Transfer Settlement: ${conf.client?.project_name}`,
                    reference_id: conf.project_id
                }]);
            }

            showToast("Settlement confirmed. Ledgers synchronized.", "success");
            fetchConfirmations();
        } catch (error: any) {
            showToast(error.message, "error");
        }
    };

    useEffect(() => {
        fetchTransactions();
        fetchClients();
        fetchTreasury();
        fetchCommissions();
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

    const fetchConfirmations = async () => {
        setIsConfirmationsLoading(true);
        const { data, error } = await supabase
            .from('payment_confirmations')
            .select('*, client:client_id(full_name, project_name)')
            .order('created_at', { ascending: false });

        if (!error && data) setConfirmations(data);
        setIsConfirmationsLoading(false);
    };

    useEffect(() => {
        if (view === "project") fetchTransactions();
        if (view === "commission") fetchCommissions();
        if (view === "confirmations") fetchConfirmations();
    }, [view]);

    const filteredTransactions = transactions.filter(t => {
        const matchesFilter = filter === 'All' || t.type === filter;
        const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.clients?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.clients?.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.category.toLowerCase().includes(searchQuery.toLowerCase());

        const durationFiltered = getFilteredByDuration([t]);
        return matchesFilter && matchesSearch && durationFiltered.length > 0;
    });

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    function getFilteredByDuration(data: Transaction[]) {
        if (exportDuration === "All Time") return data;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return data.filter(t => {
            const tDate = new Date(t.date);
            if (exportDuration === "Last 30 Days") return tDate >= thirtyDaysAgo;
            if (exportDuration === "Last 90 Days") return tDate >= ninetyDaysAgo;
            if (exportDuration === "This Year") return tDate >= startOfYear;
            if (exportDuration === "Custom Range" && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                return tDate >= start && tDate <= end;
            }
            return true;
        });
    }

    const handleDownloadExcel = () => {
        const dataToExport = getFilteredByDuration(filteredTransactions);
        const headers = ["S/N", "Date with Ref", "Entity and Reference (Client name and Project)", "Payment Type", "Amount"];
        const rows = dataToExport.map((t: any, i) => [
            i + 1,
            `${new Date(t.date).toLocaleDateString()} (Ref: ${t.id.slice(0, 8).toUpperCase()})`,
            `${t.clients?.full_name || "Internal Operational"} - ${t.clients?.project_name || "N/A"}`,
            t.category,
            `${t.type === 'Income' ? '+' : '-'}${parseFloat(t.amount.toString()).toFixed(2)}`
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
        const doc = new jsPDF();
        const dataToExport = getFilteredByDuration(filteredTransactions);
        const durationText = exportDuration === "Custom Range" ? `${startDate} to ${endDate}` : exportDuration;

        // Watermark Configuration
        const addWatermark = (pdfDoc: any) => {
            const pageCount = pdfDoc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                pdfDoc.setPage(i);
                pdfDoc.setTextColor(240, 240, 240);
                pdfDoc.setFontSize(100);
                pdfDoc.setFont('helvetica', 'bold');
                pdfDoc.saveGraphicsState();
                pdfDoc.setGState(new pdfDoc.GState({ opacity: 0.1 }));
                pdfDoc.text('CORTDEVS', 105, 148.5, {
                    align: 'center',
                    angle: 45
                });
                pdfDoc.restoreGraphicsState();
            }
        };

        // Header Title: CORTDEVS
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(60);
        doc.setTextColor(0, 0, 0);
        doc.text('CORTDEVS', 105, 40, { align: 'center' });

        // Divider
        doc.setLineWidth(1);
        doc.line(90, 48, 120, 48);

        // Transaction Record Header
        doc.setFontSize(14);
        doc.text(`Transaction Record of ${durationText}`, 105, 65, { align: 'center' });

        // Verification Subtext
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        const verificationText = "For further verification of this document and the authenticity of these financial records, please contact our official compliance department via compliance@cortdevs.com or visit our official portal at cortdevs.com.";
        const splitText = doc.splitTextToSize(verificationText, 160);
        doc.text(splitText, 105, 75, { align: 'center' });

        // Summary Stats
        const inflow = dataToExport
            .filter(t => t.type === 'Income' && t.status === 'Completed')
            .reduce((acc, t) => acc + Number(t.amount), 0);
        const outflow = dataToExport
            .filter(t => t.type === 'Expense' && t.status === 'Completed')
            .reduce((acc, t) => acc + Number(t.amount), 0);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Summary Metrics:', 20, 100);

        doc.setFont('helvetica', 'normal');
        doc.text(`Total Inflow: $${inflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 108);
        doc.text(`Total Outflow: $${outflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 20, 114);

        // Transaction Table
        autoTable(doc, {
            startY: 125,
            head: [['S/N', 'Date with Ref', 'Entity and Reference (Client name and Project)', 'Payment Type', 'Amount']],
            body: dataToExport.map((t, i) => [
                i + 1,
                `${new Date(t.date).toLocaleDateString()}\nRef: ${t.id.slice(0, 8).toUpperCase()}`,
                `${t.clients?.full_name || "Internal Operational"}\n${t.clients?.project_name || "N/A"}`,
                t.category,
                `${t.type === 'Income' ? '+' : '-'}$${parseFloat(t.amount.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            ]),
            styles: {
                fontSize: 9,
                cellPadding: 6,
                valign: 'middle',
                font: 'helvetica'
            },
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 35 },
                2: { cellWidth: 83 },
                3: { cellWidth: 30 },
                4: { cellWidth: 30, halign: 'right' }
            },
            didDrawPage: (data) => {
                // Footer
                const str = `Page ${data.pageNumber}`;
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
                doc.text('Authentic Financial Instrument • Privileged & Confidential', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                doc.text(`Generated: ${new Date().toLocaleString()}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
            }
        });

        // Add Watermark to all pages
        addWatermark(doc);

        doc.save(`CORTDEVS_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast("PDF Document Downloaded", "success");
    };

    const totalIncome = transactions
        .filter(t => t.type === 'Income' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    const totalExpenses = transactions
        .filter(t => t.type === 'Expense' && t.status === 'Completed')
        .reduce((acc: number, t: Transaction) => acc + Number(t.amount), 0);

    return (<>
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Global Print Watermark Style */}
            {/* UI Content */}

            <div className="space-y-6 printable-hide">
                <div className="flex justify-between items-center bg-white p-6 border border-neutral-200">
                    <div>
                        <h2 className="text-2xl font-light tracking-tight italic">Financial Ledger</h2>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mt-1">Audit Tracking & Fiscal Controls</p>
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

                <div className="flex gap-1 bg-neutral-100 p-1 border border-neutral-200 w-fit">
                    <button
                        onClick={() => setView("project")}
                        className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'project' ? 'bg-black text-white' : 'text-neutral-400 hover:text-black'}`}
                    >
                        Project Ledger
                    </button>
                    <button
                        onClick={() => setView("treasury")}
                        className={`px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'treasury' ? 'bg-black text-white' : 'text-neutral-400 hover:text-black'}`}
                    >
                        Treasury Ledger
                    </button>
                    <button
                        onClick={() => setView("commission")}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === "commission" ? "bg-black text-white" : "text-neutral-400 hover:text-black"}`}
                    >
                        Commissions
                    </button>
                    <button
                        onClick={() => setView("confirmations")}
                        className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all ${view === "confirmations" ? "bg-black text-white" : "text-neutral-400 hover:text-black"}`}
                    >
                        Confirmations
                    </button>
                </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 printable-hide">
                <div className="bg-white p-8 border border-neutral-200 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-1">
                            {view === 'project' ? "Net Position" : "Central Treasury"}
                        </p>
                        <h3 className="text-4xl font-light tracking-tighter italic">
                            ${(view === 'project' ? (totalIncome - totalExpenses) : treasuryBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white p-8 border border-neutral-200 flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-green-600 font-bold mb-1">
                            {view === 'project' ? "Gross Revenue" : "Active Liquidity"}
                        </p>
                        <h3 className="text-2xl font-medium tracking-tight text-neutral-900">
                            {view === 'project' ? `+ $${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `$${treasuryBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <ArrowUp size={14} className="text-green-500" /> {view === 'project' ? "Operational Inflow" : "Tactical Reserve"}
                    </div>
                </div>

                <div className="bg-white p-8 border border-neutral-200 flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-red-600 font-bold mb-1">
                            {view === 'project' ? "Operational Spend" : "Personnel Liabilities"}
                        </p>
                        <h3 className="text-2xl font-medium tracking-tight text-neutral-900">
                            {view === 'project' ? `- $${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "N/A"}
                        </h3>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        <ArrowDown size={14} className="text-red-500" /> {view === 'project' ? "Resource Outflow" : "Encumbered Capital"}
                    </div>
                </div>
            </div>

            {/* Transactions List */}
            <div id="print-area" className="bg-white border border-neutral-200">
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
                        {exportDuration !== "All Time" && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-neutral-900 text-white text-[9px] font-bold uppercase tracking-widest">
                                <span>{exportDuration}</span>
                                <button onClick={() => setExportDuration("All Time")} className="hover:text-red-400">
                                    <X size={10} />
                                </button>
                            </div>
                        )}
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
                                        className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 shadow-2xl z-50 overflow-visible"
                                    >
                                        <div className="p-4 border-b border-neutral-100">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 mb-4 px-1">Retrospective Window</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {["All Time", "Last 30 Days", "Last 90 Days", "This Year", "Custom Range"].map(d => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setExportDuration(d)}
                                                        className={`text-[9px] py-2 px-3 font-bold uppercase tracking-tight border ${exportDuration === d ? 'bg-black text-white border-black' : 'border-neutral-100 text-neutral-400 hover:border-black hover:text-black'} ${d === 'Custom Range' ? 'col-span-2' : ''} transition-all`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>

                                            {exportDuration === "Custom Range" && (
                                                <div className="mt-4 pt-4 border-t border-neutral-50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">Start Date</label>
                                                            <input
                                                                type="date"
                                                                value={startDate}
                                                                onChange={(e) => setStartDate(e.target.value)}
                                                                className="w-full p-2 text-[10px] border border-neutral-100 outline-none focus:border-black bg-neutral-50"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">End Date</label>
                                                            <input
                                                                type="date"
                                                                value={endDate}
                                                                onChange={(e) => setEndDate(e.target.value)}
                                                                className="w-full p-2 text-[10px] border border-neutral-100 outline-none focus:border-black bg-neutral-50"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-1 bg-neutral-50">
                                            <button
                                                onClick={() => { handleDownloadExcel(); setShowDownloadMenu(false); }}
                                                className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-3 border-b border-neutral-100/50"
                                            >
                                                <div className="p-2 bg-green-50 text-green-600">
                                                    <FileText size={14} />
                                                </div>
                                                <span>Export CSV/Excel</span>
                                            </button>
                                            <button
                                                onClick={() => { handleDownloadPDF(); setShowDownloadMenu(false); }}
                                                className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center gap-3"
                                            >
                                                <div className="p-2 bg-black text-white">
                                                    <Printer size={14} />
                                                </div>
                                                <span>Official Branded PDF</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {view === 'confirmations' ? (
                    <div className="bg-white border border-neutral-200">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Manual Settlement Verification</h3>
                            <button onClick={fetchConfirmations} className="p-2 hover:bg-neutral-50 rounded-full">
                                <RefreshCw size={14} className={isConfirmationsLoading ? "animate-spin" : ""} />
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold whitespace-nowrap">
                                        <th className="p-4 w-12 text-center">S/N</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Client / Project</th>
                                        <th className="p-4 text-right">Amount</th>
                                        <th className="p-4 text-center">Receipt</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {confirmations.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-12 text-center text-neutral-400 italic">No pending settlements detected.</td>
                                        </tr>
                                    ) : (
                                        confirmations.map((conf, idx) => (
                                            <tr key={conf.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                                                <td className="p-4 text-center text-neutral-400 font-mono text-[10px]">{idx + 1}</td>
                                                <td className="p-4 text-neutral-500">{new Date(conf.created_at).toLocaleDateString()}</td>
                                                <td className="p-4">
                                                    <p className="font-bold">{conf.client?.full_name}</p>
                                                    <p className="text-[9px] text-neutral-400 uppercase tracking-widest">{conf.client?.project_name}</p>
                                                </td>
                                                <td className="p-4 text-right font-semibold">${conf.amount.toLocaleString()}</td>
                                                <td className="p-4 text-center">
                                                    <a href={conf.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
                                                        <ExternalLink size={12} /> View
                                                    </a>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${conf.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                                        conf.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {conf.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    {conf.status === 'Pending' && (
                                                        <button
                                                            onClick={() => handleConfirmPayment(conf)}
                                                            className="px-4 py-2 bg-black text-white text-[9px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                                                        >
                                                            Confirm Settlement
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                    <th className="p-6 w-16">S/N</th>
                                    <th className="p-6">Date & Reference</th>
                                    <th className="p-6">{view === 'project' ? 'Entity / Description' : 'Wallet Holder'}</th>
                                    <th className="p-6">Category</th>
                                    <th className="p-6">Magnitude</th>
                                    <th className="p-6 text-right printable-hide">Actions</th>
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
                                ) : view === 'commission' ? (
                                    commissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-32 text-center text-neutral-400">
                                                <AlertCircle size={40} className="mx-auto mb-4 opacity-10" />
                                                <p className="text-xs italic">No commissions registered in ledger.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        commissions.map((c, idx) => (
                                            <tr key={c.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                                                <td className="p-6 text-xs text-neutral-300 font-mono">{idx + 1}</td>
                                                <td className="p-6">
                                                    <p className="font-mono text-[11px] text-neutral-900">{new Date(c.created_at).toLocaleDateString()}</p>
                                                    <p className="text-[10px] text-neutral-400 font-bold uppercase">ID: {c.id.slice(0, 8)}</p>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col">
                                                        <p className="font-medium text-black">{c.sales_officer?.full_name}</p>
                                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{c.sales_officer?.email}</p>
                                                    </div>
                                                    <p className="text-[10px] text-blue-600 italic mt-1">Ref: {c.clients?.full_name}</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-2 py-1 text-[8px] font-bold uppercase tracking-widest border ${c.status === 'Paid' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        c.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            'bg-orange-50 text-orange-700 border-orange-100'
                                                        }`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                                <td className="p-6">
                                                    <p className="font-bold text-black">${c.amount.toLocaleString()}</p>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {c.status === 'Pending' && (
                                                            <button
                                                                onClick={() => handleApproveCommission(c.id)}
                                                                className="px-3 py-1 bg-black text-white text-[9px] font-bold uppercase tracking-widest hover:bg-neutral-800"
                                                            >
                                                                Approve
                                                            </button>
                                                        )}
                                                        {c.status === 'Approved' && (
                                                            <button
                                                                onClick={() => handlePayCommission(c)}
                                                                className="px-3 py-1 bg-green-600 text-white text-[9px] font-bold uppercase tracking-widest hover:bg-green-700"
                                                            >
                                                                Pay Out
                                                            </button>
                                                        )}
                                                        {c.status === 'Paid' && (
                                                            <span className="text-[9px] font-bold uppercase text-neutral-400">Settled</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                ) : (view === 'project' ? paginatedTransactions : walletTx).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-32 text-center text-neutral-400">
                                            <Calendar size={40} className="mx-auto mb-4 opacity-10" />
                                            <p className="text-xs italic">No entries recorded in the current epoch.</p>
                                        </td>
                                    </tr>
                                ) : (view === 'project' ? paginatedTransactions : walletTx).map((t, index) => (
                                    <tr
                                        key={t.id}
                                        onClick={() => {
                                            if (view === 'project') {
                                                setSelectedTransaction(t);
                                                if (t.client_id) fetchRelatedHistory(t.client_id);
                                            }
                                        }}
                                        className={`border-b border-neutral-50 hover:bg-neutral-50 transition-colors group ${view === 'project' ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className="p-6 text-xs text-neutral-300 font-mono">
                                            {index + 1}
                                        </td>
                                        <td className="p-6">
                                            <p className="font-mono text-[11px] text-neutral-900">
                                                {new Date(t.date || t.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tighter">REF: {t.id.slice(0, 8)}</p>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col">
                                                <p className="font-medium text-black">
                                                    {view === 'project'
                                                        ? (t.clients?.full_name || "Operational")
                                                        : (t.wallets?.email || "Treasury Account")}
                                                </p>
                                                {view === 'project' && t.clients?.project_name && (
                                                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                                        {t.clients.project_name}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-500 italic font-light truncate max-w-xs mt-1">{t.description}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-[10px] font-bold uppercase tracking-widest bg-neutral-100 px-2 py-1 text-neutral-600">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <p className={`font-semibold ${t.type === 'Income' || t.type === 'Credit' ? 'text-green-600' : 'text-red-500'}`}>
                                                {(t.type === 'Income' || t.type === 'Credit') ? '+' : '-'} ${Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                        </td>
                                        <td className="p-6 text-right printable-hide">
                                            <div className="flex items-center justify-end gap-3">
                                                {view === 'project' && (
                                                    <>
                                                        {t.receipt_url && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(t.receipt_url, '_blank');
                                                                }}
                                                                className="p-2 border border-neutral-100 text-neutral-400 hover:text-black hover:border-black transition-all"
                                                            >
                                                                <FileText size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            className="p-2 border border-neutral-100 text-neutral-400 hover:text-black hover:border-black transition-all"
                                                        >
                                                            <Layers size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && view !== 'confirmations' && (
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
                                            <option key={c.id} value={c.id}>
                                                {c.full_name} - {c.project_name} {c.company ? `[${c.company}]` : ''}
                                            </option>
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
                                            <p className="text-lg font-light italic leading-tight">
                                                {selectedTransaction.clients?.full_name || "Operational Outflow"}
                                            </p>
                                            {selectedTransaction.clients?.project_name && (
                                                <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-1">
                                                    {selectedTransaction.clients.project_name}
                                                </p>
                                            )}
                                            {selectedTransaction.clients?.company && (
                                                <p className="text-[9px] text-neutral-500 uppercase tracking-tighter mt-0.5">
                                                    {selectedTransaction.clients.company}
                                                </p>
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
                                <div className="space-y-4">
                                    {selectedTransaction.receipt_url && (
                                        <button
                                            onClick={() => window.open(selectedTransaction.receipt_url, '_blank')}
                                            className="w-full bg-white/10 hover:bg-white/20 text-white py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all border border-white/5"
                                        >
                                            Download Receipt <Download size={14} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedTransaction(null)}
                                        className="w-full text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition-colors py-2"
                                    >
                                        Close Record
                                    </button>
                                </div>
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
    </>
    );
}
