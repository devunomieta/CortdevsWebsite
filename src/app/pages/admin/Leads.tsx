import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    Search,
    Filter,
    MoreVertical,
    Eye,
    Mail,
    Trash2,
    CheckCircle2,
    Clock,
    ChevronRight,
    User,
    ExternalLink,
    MessageSquare,
    RefreshCw,
    ChevronLeft,
    X
} from "lucide-react";
import { useToast } from "../../components/Toast";

interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string;
    service: string;
    budget: string;
    status: "New" | "Contacted" | "Qualified" | "Lost" | "Converted";
    created_at: string; // From Supabase
    details: string;
}

export function Leads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const itemsPerPage = 20;
    const { showToast } = useToast();

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(data || []);
        } catch (err) {
            console.error("Error fetching leads:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const updateLeadStatus = async (id: string, newStatus: Lead["status"]) => {
        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
            if (selectedLead?.id === id) {
                setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
            }
            showToast(`Status updated to ${newStatus}`, "success");
        } catch (err) {
            console.error("Error updating lead status:", err);
            showToast("Failed to update status", "error");
        }
    };

    const deleteLead = async (id: string) => {
        if (!confirm("Are you sure you want to delete this lead?")) return;
        try {
            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setLeads(prev => prev.filter(l => l.id !== id));
            if (selectedLead?.id === id) setSelectedLead(null);
            showToast("Lead deleted successfully", "success");
        } catch (err) {
            console.error("Error deleting lead:", err);
            showToast("Failed to delete lead", "error");
        }
    };

    const convertToClient = async (lead: Lead) => {
        if (!confirm(`Convert ${lead.name} to a client?`)) return;
        setIsLoading(true);
        try {
            // 1. Create client
            const { error: clientError } = await supabase
                .from('clients')
                .insert([{
                    full_name: lead.name,
                    project_name: lead.service,
                    status: 'In Progress',
                    total_value: lead.budget,
                    paid_amount: '0',
                }]);

            if (clientError) throw clientError;

            // 2. Delete lead
            const { error: leadError } = await supabase
                .from('leads')
                .delete()
                .eq('id', lead.id);

            if (leadError) throw leadError;

            setLeads(prev => prev.filter(l => l.id !== lead.id));
            setSelectedLead(null);
            showToast("Lead successfully converted to client.", "success");
        } catch (err: any) {
            console.error("Error converting lead:", err);
            showToast("Conversion failed: " + err.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const sendEmail = async () => {
        if (!selectedLead || !emailSubject || !emailBody) {
            showToast("Please fill in all fields", "warning");
            return;
        }

        setIsSendingEmail(true);
        try {
            const { error } = await supabase
                .from('messages')
                .insert([{
                    receiver_email: selectedLead.email,
                    subject: emailSubject,
                    body: emailBody,
                    type: 'Lead',
                    is_sent: true
                }]);

            if (error) throw error;

            showToast("Email sent successfully", "success");
            setIsEmailModalOpen(false);
            setEmailSubject("");
            setEmailBody("");
        } catch (err: any) {
            console.error("Error sending email:", err);
            showToast("Failed to send email: " + err.message, "error");
        } finally {
            setIsSendingEmail(false);
        }
    };

    const filteredLeads = leads.filter(lead => {
        const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || lead.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusColor = (status: Lead["status"]) => {
        switch (status) {
            case "New": return "bg-blue-500";
            case "Contacted": return "bg-orange-500";
            case "Qualified": return "bg-green-500";
            case "Converted": return "bg-purple-500";
            default: return "bg-neutral-500";
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Project Leads & Inquiries</h2>
                    <p className="text-sm text-neutral-500">Track and manage incoming project requests from the website.</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 outline-none focus:border-black transition-all text-sm"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 bg-white border border-neutral-200 text-sm outline-none focus:border-black transition-all"
                    >
                        {["All", "New", "Contacted", "Qualified", "Converted"].map(s => (
                            <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchLeads}
                        disabled={isLoading}
                        className="p-2 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                        title="Refresh Leads"
                    >
                        <RefreshCw size={20} className={`text-neutral-500 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <button className="p-2 border border-neutral-200 hover:bg-neutral-50 transition-colors font-bold text-[10px] uppercase tracking-widest text-neutral-400">
                        {filteredLeads.length} Records
                    </button>
                </div>
            </div>

            {isLoading && leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200">
                    <RefreshCw className="w-8 h-8 text-neutral-300 animate-spin mb-4" />
                    <p className="text-sm text-neutral-500 italic">Fetching secure data...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative pb-20">
                    {/* Leads Table Container */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white border border-neutral-200 shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold whitespace-nowrap">
                                            <th className="p-4 w-12 text-center">S/N</th>
                                            <th className="p-4">Lead Details</th>
                                            <th className="p-4">Interest</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {paginatedLeads.map((lead, index) => (
                                            <tr
                                                key={lead.id}
                                                className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer group ${selectedLead?.id === lead.id ? "bg-neutral-50" : ""}`}
                                                onClick={() => setSelectedLead(lead)}
                                            >
                                                <td className="p-4 text-center text-neutral-400 font-mono text-[10px] font-bold">
                                                    {((currentPage - 1) * itemsPerPage) + index + 1}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 bg-neutral-100 flex items-center justify-center rounded-full text-neutral-600 font-bold italic text-xs">
                                                            {lead.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-xs whitespace-nowrap">{lead.name}</p>
                                                            <p className="text-[10px] text-neutral-500 truncate max-w-[120px]">{lead.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <p className="font-medium text-neutral-700 text-xs whitespace-nowrap">{lead.service}</p>
                                                    <p className="text-[10px] text-neutral-400 font-bold">{lead.budget}</p>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 text-white text-[9px] font-bold uppercase tracking-tight ${getStatusColor(lead.status)}`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button className="p-2 hover:bg-white hover:shadow-md transition-all text-neutral-400 hover:text-black">
                                                        <ChevronRight size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                <p>Showing {paginatedLeads.length} of {filteredLeads.length} leads</p>
                                <div className="flex items-center gap-4">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(prev => prev - 1)}
                                        className="p-2 border border-neutral-200 hover:bg-white transition-all disabled:opacity-30 pointer-events-auto"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span>Page {currentPage} of {totalPages}</span>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => prev + 1)}
                                        className="p-2 border border-neutral-200 hover:bg-white transition-all disabled:opacity-30 pointer-events-auto"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lead Details Panel Fixed Container */}
                    <div className="sticky top-28 bg-white lg:col-span-1 shadow-xl border border-neutral-200 min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {selectedLead ? (
                                <motion.div
                                    key={selectedLead.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="p-8 space-y-8"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-light italic">{selectedLead.name}</h3>
                                            <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">
                                                {new Date(selectedLead.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setIsEmailModalOpen(true)}
                                                className="p-2 border border-neutral-100 hover:bg-neutral-900 hover:text-white transition-all"
                                            >
                                                <Mail size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteLead(selectedLead.id)}
                                                className="p-2 border border-neutral-100 hover:bg-red-600 hover:text-white transition-all text-red-500"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-4 bg-neutral-50 border-l-2 border-black">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2">Project Interest</p>
                                            <p className="text-sm font-medium">{selectedLead.service}</p>
                                            <p className="text-xs text-neutral-500 mt-1">{selectedLead.budget}</p>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Contact Details</p>
                                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                                <Mail size={14} /> {selectedLead.email}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                                <User size={14} /> {selectedLead.phone}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Project Requirements</p>
                                            <div
                                                className="text-sm leading-relaxed text-neutral-600 italic prose prose-sm max-w-none"
                                                dangerouslySetInnerHTML={{
                                                    __html: selectedLead.details.startsWith('<')
                                                        ? selectedLead.details
                                                        : `<p>${selectedLead.details}</p>`
                                                }}
                                            />
                                        </div>

                                        <div className="pt-4 border-t border-neutral-100 space-y-4">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Update Lead Status</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {["New", "Contacted", "Qualified", "Converted"].map(status => (
                                                    <button
                                                        key={status}
                                                        onClick={() => updateLeadStatus(selectedLead.id, status as Lead["status"])}
                                                        className={`px-3 py-2 text-[10px] font-bold border transition-all ${selectedLead.status === status
                                                            ? "bg-black text-white border-black"
                                                            : "border-neutral-200 hover:border-black"
                                                            }`}
                                                    >
                                                        {status.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => convertToClient(selectedLead)}
                                        disabled={isLoading}
                                        className="w-full py-4 bg-black text-white text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50"
                                    >
                                        {isLoading ? "PROCESSSING..." : "Convert to Client"} <CheckCircle2 size={14} />
                                    </button>
                                </motion.div>
                            ) : (
                                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-neutral-400 text-sm italic p-8">
                                    <MessageSquare size={32} className="mb-4 opacity-20" />
                                    <p>Select a lead to view details</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* Email Modal */}
            <AnimatePresence>
                {isEmailModalOpen && selectedLead && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-light italic">Compose Email</h3>
                                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">To: {selectedLead.name} ({selectedLead.email})</p>
                                </div>
                                <button onClick={() => setIsEmailModalOpen(false)} className="text-neutral-400 hover:text-black">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Subject</label>
                                    <input
                                        type="text"
                                        placeholder="Project Discussion..."
                                        value={emailSubject}
                                        onChange={(e) => setEmailSubject(e.target.value)}
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 outline-none focus:border-black transition-all text-sm"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Message Body</label>
                                    <textarea
                                        rows={8}
                                        placeholder="Write your response here..."
                                        value={emailBody}
                                        onChange={(e) => setEmailBody(e.target.value)}
                                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 outline-none focus:border-black transition-all text-sm resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsEmailModalOpen(false)}
                                    className="px-6 py-2 text-[10px] uppercase font-bold tracking-widest text-neutral-400 hover:text-black transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={sendEmail}
                                    disabled={isSendingEmail}
                                    className="px-8 py-2 bg-black text-white text-[10px] uppercase font-bold tracking-widest hover:bg-neutral-800 transition-all flex items-center gap-2"
                                >
                                    {isSendingEmail ? "SENDING..." : "Send Email"} <MessageSquare size={14} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

