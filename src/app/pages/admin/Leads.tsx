import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";

import {
    Search, Filter, Mail, Phone, Calendar, Clock, ChevronRight, ChevronLeft,
    MoreHorizontal, CheckCircle2, AlertCircle, Trash2, UserPlus, User,
    ExternalLink, Download, FileText, Send, Eye, RefreshCw, X, MessageSquare, Plus,
    ArrowLeft, Shield
} from "lucide-react";
import { errorService } from "../../../lib/ErrorService";
import { format } from "date-fns";
import { useToast } from "../../components/Toast";
import { RichTextEditor } from "../../components/RichTextEditor";
import { cn } from "../../components/ui/utils";

interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string;
    service: string;
    budget: string;
    status: "New" | "Contacted" | "Qualified" | "Lost" | "Converted" | "Closed" | "Pending";
    created_at: string; // From Supabase
    details: string;
    nda_url?: string;
    attachments?: { name: string, url: string }[];
    onboarded_by?: string;
    onboarder_name?: string;
}

export function Leads() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("All");
    const [currentPage, setCurrentPage] = useState(1);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
    const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [leadMessages, setLeadMessages] = useState<any[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [viewingMessage, setViewingMessage] = useState<any | null>(null);

    const itemsPerPage = 20;
    const { showToast } = useToast();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newLead, setNewLead] = useState({
        name: "",
        email: "",
        phone: "",
        service: "Web Development",
        budget: "Not Specified",
        message: "Manually Onboarded Lead"
    });

    const fetchLeads = async () => {
        setIsLoading(true);
        try {
            // First attempt with join
            let { data, error } = await supabase
                .from('leads')
                .select('*, onboarder:onboarded_by(full_name)')
                .order('created_at', { ascending: false });

            // If it fails, fallback to basic select
            if (error) {
                console.warn("Retrying fetch without relationship join...");
                const fallback = await supabase
                    .from('leads')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (fallback.error) throw fallback.error;
                data = fallback.data;
            }

            const mappedData = data?.map(item => ({
                ...item,
                onboarder_name: item.onboarder?.full_name || 'System'
            }));
            setLeads(mappedData || []);
            if (data) checkAndNotifyPendingLeads(data);
        } catch (err) {
            await errorService.logError(err, "Leads.fetchLeads");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    useEffect(() => {
        const urlId = searchParams.get('id');
        if (urlId && leads.length > 0) {
            const leadToSelect = leads.find(l => l.id === urlId);
            if (leadToSelect) {
                setSelectedLead(leadToSelect);
                fetchLeadMessages(leadToSelect.email);
            }
        }
    }, [searchParams, leads]);

    const fetchLeadMessages = async (email: string) => {
        setIsLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('receiver_email', email)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeadMessages(data || []);
        } catch (err) {
            console.error("Error fetching messages:", err);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const updateLeadStatus = async (id: string, newStatus: Lead["status"]) => {
        if (newStatus === "Converted") {
            const lead = leads.find(l => l.id === id);
            if (lead) {
                setLeadToConvert(lead);
                setIsConvertDialogOpen(true);
                return;
            }
        }

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
        } catch (err: any) {
            await errorService.logError(err, "Leads.handleStatusUpdate", { id, status: newStatus });
            showToast("Failed to update status.", "error");
        }
    };

    const handleAddLead = async () => {
        if (!newLead.name || !newLead.email) {
            showToast("Name and Email are required.", "error");
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        try {
            const { error } = await supabase
                .from('leads')
                .insert([{
                    ...newLead,
                    status: 'New',
                    onboarded_by: session?.user.id
                }]);

            if (error) throw error;
            showToast("Manual lead created successfully.", "success");
            setIsAddModalOpen(false);
            fetchLeads();
            setNewLead({
                name: "",
                email: "",
                phone: "",
                service: "Web Development",
                budget: "Not Specified",
                message: "Manually Onboarded Lead"
            });
        } catch (err: any) {
            showToast(err.message || "Failed to create lead.", "error");
        }
    };

    const checkAndNotifyPendingLeads = async (leadsData: Lead[]) => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const leadsToTransition = leadsData.filter(l =>
            l.status === 'New' &&
            new Date(l.created_at) < sevenDaysAgo
        );

        if (leadsToTransition.length === 0) return;

        for (const lead of leadsToTransition) {
            try {
                // 1. Update status to Pending
                await supabase
                    .from('leads')
                    .update({ status: 'Pending' })
                    .eq('id', lead.id);

                // 2. Add In-App Notification
                await supabase.from('notifications').insert({
                    type: 'Lead',
                    message: `7-DAY ALERT: Lead ${lead.name} requires immediate attention.`,
                    link: `/admin/leads?id=${lead.id}`,
                    read: false
                });

                // 3. Send Email Follow-up to Lead
                await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: lead.email,
                        subject: "Regarding your inquiry - CortDevs",
                        body: `Hi ${lead.name}, thank you for reaching out to CortDevs. We are currently reviewing your project details and will be in touch shortly. We appreciate your patience.`,
                        type: 'System'
                    })
                });
            } catch (err) {
                console.error("Sweep Error for lead:", lead.id, err);
            }
        }

        // Re-fetch to update UI state
        fetchLeads();
    };

    const confirmDeleteLead = async () => {
        if (!leadToDelete) return;
        try {
            const { error } = await supabase
                .from('leads')
                .delete()
                .eq('id', leadToDelete.id);

            if (error) throw error;
            setLeads(prev => prev.filter(l => l.id !== leadToDelete.id));
            if (selectedLead?.id === leadToDelete.id) setSelectedLead(null);
            showToast("Lead deleted successfully", "success");
            setIsDeleteDialogOpen(false);
            setLeadToDelete(null);
        } catch (err) {
            console.error("Error deleting lead:", err);
            showToast("Failed to delete lead", "error");
        }
    };

    const convertToClient = async (lead: Lead) => {
        setIsLoading(true);
        try {
            const { error: clientError } = await supabase
                .from('clients')
                .insert([{
                    full_name: lead.name,
                    email: lead.email,
                    project_name: lead.service,
                    status: 'In Progress',
                    total_value: lead.budget,
                    paid_amount: '0',
                    onboarded_by: lead.onboarded_by
                }]);

            if (clientError) throw clientError;

            const { error: leadError } = await supabase
                .from('leads')
                .update({ status: 'Converted' }) // Update status instead of deleting to keep history context
                .eq('id', lead.id);

            if (leadError) throw leadError;

            // Optional: You might want to keep the lead but move it to a different list
            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'Converted' } : l));
            setSelectedLead(prev => prev ? { ...prev, status: 'Converted' } : null);
            showToast("Lead successfully converted to client.", "success");
        } catch (err: any) {
            console.error("Error converting lead:", err);
            showToast("Conversion failed: " + err.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    const uploadToSupabase = async (file: File, folder: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('assets')
            .getPublicUrl(filePath);

        return publicUrl;
    };

    const sendEmail = async () => {
        if (!selectedLead || !emailSubject || !emailBody) {
            showToast("Please fill in all fields", "warning");
            return;
        }

        setIsSendingEmail(true);
        try {
            // 1. Upload attachments if any
            const uploadedFiles = [];
            for (const file of emailAttachments) {
                const url = await uploadToSupabase(file, 'direct-emails');
                uploadedFiles.push({ name: file.name, url });
            }

            // 2. Call real SMTP backend
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: selectedLead.email,
                    subject: emailSubject,
                    body: emailBody,
                    attachments: uploadedFiles,
                    type: 'Lead'
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to transmit email');
            }

            showToast(`Email sent successfully`, "success");
            setIsEmailModalOpen(false);
            setEmailSubject("");
            setEmailBody("");
            setEmailAttachments([]);

            // Refresh conversation history
            fetchLeadMessages(selectedLead.email);
        } catch (err: any) {
            await errorService.logError(err, "Leads.handleSendEmail");
            showToast("Failed to transmit communication.", "error");
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead);
        fetchLeadMessages(lead.email);
    };

    const handleReply = (msg: any) => {
        setEmailSubject(`Re: ${msg.subject || 'Our Discussion'}`);
        setEmailBody(`<br/><br/><hr/><blockquote>${msg.body}</blockquote>`);
        setViewingMessage(null);
        setIsEmailModalOpen(true);
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
            case "Closed": return "bg-neutral-800";
            case "Pending": return "bg-rose-600 animate-pulse";
            default: return "bg-neutral-500";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Link
                to="/admin"
                className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
            >
                <ArrowLeft size={12} /> Back to Dashboard
            </Link>
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="xl:whitespace-nowrap">
                    <h2 className="text-2xl font-light tracking-tight italic">Project Leads & Inquiries</h2>
                    <p className="text-sm text-neutral-500 mt-1">Track and manage incoming project requests from the website.</p>
                </div>

                <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 outline-none focus:border-black transition-all text-sm"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="flex-1 md:flex-none px-4 py-3 bg-white border border-neutral-200 text-sm outline-none focus:border-black transition-all min-w-[140px]"
                    >
                        {["All", "New", "Pending", "Contacted", "Qualified", "Closed", "Converted"].map(s => (
                            <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-3 border border-neutral-200 bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400 font-bold whitespace-nowrap text-center">
                            {filteredLeads.length} Records
                        </div>
                        <button
                            onClick={fetchLeads}
                            disabled={isLoading}
                            className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                            title="Refresh Leads"
                        >
                            <RefreshCw size={18} className={`mx-auto text-neutral-500 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                        >
                            Record Lead <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {isLoading && leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-neutral-200">
                    <RefreshCw className="w-8 h-8 text-neutral-300 animate-spin mb-4" />
                    <p className="text-sm text-neutral-500 italic">Fetching secure data...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative pb-20">
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
                                                onClick={() => handleSelectLead(lead)}
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
                                    <div className="flex items-center gap-2 px-2 border-l border-neutral-100 ml-2">
                                        <span className="text-[9px] text-neutral-400">Jump:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={totalPages}
                                            value={currentPage}
                                            onChange={(e) => {
                                                const p = parseInt(e.target.value);
                                                if (p >= 1 && p <= totalPages) setCurrentPage(p);
                                            }}
                                            className="w-10 py-1 bg-white border border-neutral-200 text-center outline-none focus:border-black transition-all"
                                        />
                                    </div>
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

                    <div className="lg:sticky lg:top-28 bg-white lg:col-span-1 shadow-xl border border-neutral-200 min-h-[400px]">
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
                                                onClick={() => {
                                                    setLeadToDelete(selectedLead);
                                                    setIsDeleteDialogOpen(true);
                                                }}
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
                                            {selectedLead.onboarder_name && (
                                                <div className="flex items-center gap-2 text-sm text-neutral-600 mt-1">
                                                    <Shield size={14} className="text-blue-500" />
                                                    <span className="text-[10px] font-bold uppercase">Onboarded By:</span> {selectedLead.onboarder_name}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Project Requirements</p>
                                            <div
                                                className={cn(
                                                    "text-sm leading-relaxed text-neutral-600 italic prose prose-sm max-w-none transition-all",
                                                    !isDetailsExpanded && "max-h-32 overflow-hidden relative"
                                                )}
                                            >
                                                <div dangerouslySetInnerHTML={{
                                                    __html: selectedLead.details.startsWith('<')
                                                        ? selectedLead.details
                                                        : `<p>${selectedLead.details}</p>`
                                                }} />
                                                {!isDetailsExpanded && selectedLead.details.length > 200 && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                                                )}
                                            </div>
                                            {selectedLead.details.length > 200 && (
                                                <button
                                                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                                                    className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all flex items-center gap-1 mt-2"
                                                >
                                                    {isDetailsExpanded ? "Show Less" : "Read More"}
                                                    {isDetailsExpanded ? <X size={12} className="rotate-45" /> : <ChevronRight size={12} className="rotate-90" />}
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-neutral-100">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Documents & NDA</p>

                                            {selectedLead.nda_url ? (
                                                <div className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-100 group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white text-black">
                                                            <CheckCircle2 size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-tight">NDA Secured</p>
                                                            <p className="text-[9px] text-neutral-500 truncate max-w-[150px] font-mono">{selectedLead.nda_url}</p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={selectedLead.nda_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 hover:bg-black hover:text-white transition-all"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-neutral-400 italic">No NDA data available.</p>
                                            )}

                                            {selectedLead.attachments && selectedLead.attachments.length > 0 && (
                                                <div className="grid grid-cols-1 gap-2 mt-2">
                                                    {selectedLead.attachments.map((file: { name: string, url: string }, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 border border-neutral-100 hover:border-neutral-200 transition-all">
                                                            <div className="flex items-center gap-3">
                                                                <ExternalLink size={14} className="text-neutral-400" />
                                                                <span className="text-[10px] font-medium truncate max-w-[180px] font-mono">{file.name}</span>
                                                            </div>
                                                            <a
                                                                href={file.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[9px] font-bold uppercase text-neutral-400 hover:text-black transition-all"
                                                            >
                                                                View
                                                            </a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-neutral-100 space-y-4">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Communication History</p>
                                            <div className="max-h-48 overflow-y-auto space-y-3 pr-2 scrollbar-thin text-black">
                                                {isLoadingMessages ? (
                                                    <div className="flex justify-center py-4">
                                                        <RefreshCw className="w-4 h-4 animate-spin text-neutral-300" />
                                                    </div>
                                                ) : leadMessages.length > 0 ? (
                                                    leadMessages.map((msg, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setViewingMessage(msg)}
                                                            className="w-full text-left p-3 bg-neutral-50 border border-neutral-100 space-y-1 hover:border-black transition-all group"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <p className="text-[10px] font-bold text-black truncate max-w-[150px] group-hover:italic">{msg.subject}</p>
                                                                <p className="text-[8px] text-neutral-400">{new Date(msg.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-500 line-clamp-2 italic">
                                                                {msg.body.replace(/<[^>]*>/g, '')}
                                                            </p>
                                                        </button>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-neutral-400 italic py-2 text-center">No previous interactions recorded.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-neutral-100 space-y-4">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Update Lead Status</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {["New", "Contacted", "Qualified", "Closed"].map(status => (
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

                                        <button
                                            onClick={() => {
                                                setLeadToConvert(selectedLead);
                                                setIsConvertDialogOpen(true);
                                            }}
                                            disabled={isLoading}
                                            className="w-full py-4 bg-black text-white text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50"
                                        >
                                            {isLoading ? "PROCESSSING..." : "Convert to Client"} <CheckCircle2 size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-neutral-400 text-sm italic p-8">
                                    <MessageSquare size={32} className="mb-4 opacity-20" />
                                    <p>Select a lead to view details</p>
                                </div>
                            )}
                        </AnimatePresence>

                        {/* Manual Lead Modal */}
                        <AnimatePresence>
                            {isAddModalOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 30 }}
                                        className="bg-white border border-neutral-200 w-full max-w-lg p-10 relative shadow-2xl"
                                    >
                                        <button onClick={() => setIsAddModalOpen(false)} className="absolute top-8 right-8 text-neutral-400 hover:text-black">
                                            <X size={20} />
                                        </button>
                                        <h3 className="text-3xl font-light italic mb-8 text-black">Record Manual Lead</h3>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={newLead.name}
                                                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                                                    className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                                    placeholder="Prospect Name"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={newLead.email}
                                                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                                                    className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                                    placeholder="prospect@email.com"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Service</label>
                                                    <select
                                                        value={newLead.service}
                                                        onChange={(e) => setNewLead({ ...newLead, service: e.target.value })}
                                                        className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-[10px] uppercase font-bold"
                                                    >
                                                        <option>Web Development</option>
                                                        <option>SEO Strategy</option>
                                                        <option>App Development</option>
                                                        <option>Consultation</option>
                                                        <option>Brand Identity</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Budget</label>
                                                    <input
                                                        type="text"
                                                        value={newLead.budget}
                                                        onChange={(e) => setNewLead({ ...newLead, budget: e.target.value })}
                                                        className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                                        placeholder="$1,000 - $5,000"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleAddLead}
                                            className="w-full mt-8 bg-black text-white py-5 text-[10px] font-bold uppercase tracking-[0.25em] hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                                        >
                                            Initiate Pipeline
                                        </button>
                                    </motion.div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {viewingMessage && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-neutral-200 shadow-3xl w-full max-w-2xl overflow-hidden text-black"
                    >
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
                            <div>
                                <h3 className="text-lg font-light italic">{viewingMessage.subject || "Message Details"}</h3>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                                    Transmitted: {new Date(viewingMessage.created_at).toLocaleString()}
                                </p>
                            </div>
                            <button onClick={() => setViewingMessage(null)} className="text-neutral-400 hover:text-black">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto scrollbar-thin">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest border-b border-neutral-100 pb-4 text-neutral-400">
                                <div>To: <span className="text-black italic">{viewingMessage.receiver_email}</span></div>
                                <div>Category: <span className="text-black">{viewingMessage.type}</span></div>
                            </div>

                            <div className="prose prose-sm max-w-none text-neutral-800 leading-relaxed whitespace-pre-wrap bg-neutral-50/50 p-6 border border-neutral-100 italic">
                                <div dangerouslySetInnerHTML={{ __html: viewingMessage.body }} />
                            </div>
                        </div>

                        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-4">
                            <button
                                onClick={() => setViewingMessage(null)}
                                className="px-6 py-2 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:border-black transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => handleReply(viewingMessage)}
                                className="px-8 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center gap-2"
                            >
                                <Mail size={14} /> Reply Mail
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

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
                                <RichTextEditor
                                    value={emailBody}
                                    onChange={setEmailBody}
                                    placeholder="Write your response here..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Attachments</label>
                                <div className="flex flex-wrap gap-2">
                                    {emailAttachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1 bg-neutral-100 text-[10px] font-bold border border-neutral-200">
                                            <span>{file.name}</span>
                                            <button onClick={() => setEmailAttachments(prev => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
                                        </div>
                                    ))}
                                    <label className="flex items-center gap-1 px-3 py-1 border border-dashed border-neutral-300 text-[10px] font-bold text-neutral-400 hover:border-black hover:text-black cursor-pointer transition-all">
                                        <Plus size={12} /> Add File
                                        <input type="file" multiple className="hidden" onChange={(e) => setEmailAttachments(prev => [...prev, ...Array.from(e.target.files || [])])} />
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                            <button
                                onClick={sendEmail}
                                disabled={isSendingEmail}
                                className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50"
                            >
                                {isSendingEmail ? "Sending..." : "Send Response"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {isDeleteDialogOpen && leadToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-neutral-200 shadow-3xl w-full max-w-md overflow-hidden p-8 space-y-6"
                    >
                        <div className="space-y-2">
                            <h3 className="text-xl font-light italic">Terminate Data Point?</h3>
                            <p className="text-sm text-neutral-500">
                                You are about to delete <span className="font-bold text-black">{leadToDelete.name}</span>. This action is irreversible and will purge all associated inquiry data.
                            </p>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-neutral-100">
                            <button
                                onClick={() => setIsDeleteDialogOpen(false)}
                                className="flex-1 py-3 text-[10px] uppercase font-bold tracking-[0.2em] border border-neutral-200 hover:bg-neutral-50"
                            >
                                Abort
                            </button>
                            <button
                                onClick={confirmDeleteLead}
                                className="flex-1 py-3 text-[10px] uppercase font-bold tracking-[0.2em] bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200"
                            >
                                Confirm Purge
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {isConvertDialogOpen && leadToConvert && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white border border-neutral-200 shadow-3xl w-full max-w-md overflow-hidden p-8 space-y-6"
                    >
                        <div className="space-y-4 text-center">
                            <div className="mx-auto w-16 h-16 bg-neutral-50 flex items-center justify-center text-black border border-neutral-100">
                                <UserPlus size={32} strokeWidth={1.5} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-light italic">Confirm Client Conversion</h3>
                                <p className="text-sm text-neutral-500">
                                    Are you ready to elevate <span className="font-bold text-black">{leadToConvert.name}</span> to the Client base? This will initiate the project onboarding sequence.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-neutral-100">
                            <button
                                onClick={() => {
                                    setIsConvertDialogOpen(false);
                                    setLeadToConvert(null);
                                }}
                                className="flex-1 py-3 text-[10px] uppercase font-bold tracking-[0.2em] border border-neutral-200 hover:bg-neutral-50"
                            >
                                Not Yet
                            </button>
                            <button
                                onClick={() => {
                                    convertToClient(leadToConvert);
                                    setIsConvertDialogOpen(false);
                                    setLeadToConvert(null);
                                }}
                                className="flex-1 py-3 text-[10px] uppercase font-bold tracking-[0.2em] bg-black text-white hover:bg-neutral-800 shadow-lg shadow-neutral-200"
                            >
                                Finalize Conversion
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
