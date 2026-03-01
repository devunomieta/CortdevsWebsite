import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    Briefcase,
    DollarSign,
    FileText,
    Download,
    Clock,
    CheckCircle2,
    AlertCircle,
    Plus,
    Settings,
    Star,
    RefreshCw,
    Trash2,
    Mail,
    PlusCircle,
    ChevronLeft,
    ChevronRight,
    CornerDownRight,
    X,
    Printer,
    Minus,
    ExternalLink,
    Shield,
    Info,
    Layers,
    History,
    Edit
} from "lucide-react";
import { useToast } from "../../components/Toast";

interface Client {
    id: string;
    name: string;
    company: string;
    project: string;
    totalValue: string;
    paid: string;
    status: "In Progress" | "Launched" | "Completed" | "Maintenance";
    email: string;
    review: {
        rating: number;
        text: string;
        isPublic: boolean;
    } | null;
}

export function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [isAddingMilestone, setIsAddingMilestone] = useState(false);
    const [newMilestone, setNewMilestone] = useState({ title: "", description: "" });
    const [isMilestoneLoading, setIsMilestoneLoading] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Onboarding State
    const [showOnboardOptions, setShowOnboardOptions] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);
    const [manualForm, setManualForm] = useState({
        full_name: "",
        email: "",
        company: "",
        project_name: "",
        total_value: "",
        paid_amount: "0"
    });

    // Invoice State
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [invoiceItems, setInvoiceItems] = useState([{ description: "Project Milestone", quantity: 1, rate: 0, amount: 0 }]);
    const [taxRate, setTaxRate] = useState(0);
    const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);

    // Full Details State
    const [showFullDetailsModal, setShowFullDetailsModal] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState<"Overview" | "Roadmap" | "Intelligence" | "Financials" | "Vault">("Overview");
    const [clientIntelligence, setClientIntelligence] = useState<any[]>([]);
    const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false);
    const [clientDocuments, setClientDocuments] = useState<any[]>([]);
    const [isVaultLoading, setIsVaultLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [renamingDoc, setRenamingDoc] = useState<{ id: string, name: string } | null>(null);
    const [docToDelete, setDocToDelete] = useState<{ id: string, url: string } | null>(null);

    const [clientTransactions, setClientTransactions] = useState<any[]>([]);
    const [isFinancialsLoading, setIsFinancialsLoading] = useState(false);

    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleOnboard = () => {
        setShowOnboardOptions(true);
    };

    const handleManualOnboard = async () => {
        if (!manualForm.full_name || !manualForm.project_name) {
            showToast("Required fields missing", "warning");
            return;
        }

        setIsSubmittingManual(true);
        try {
            // 1. Insert Client
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .insert([{
                    full_name: manualForm.full_name,
                    company: manualForm.company,
                    project_name: manualForm.project_name,
                    total_value: manualForm.total_value,
                    paid_amount: manualForm.paid_amount,
                    email: manualForm.email,
                    status: 'In Progress'
                }])
                .select()
                .single();

            if (clientError) throw clientError;

            // 2. Insert Initial Milestone
            const { error: mileError } = await supabase
                .from('project_milestones')
                .insert([{
                    client_id: clientData.id,
                    title: "Project Initialization",
                    description: "Manual onboarding completed. Roadmap phase started.",
                    status: 'Completed'
                }]);

            if (mileError) throw mileError;

            // 3. Create Notification
            await supabase.from('notifications').insert([{
                type: 'System',
                message: `Manually onboarded ${manualForm.full_name}`,
                link: '/admin/clients'
            }]);

            showToast(`${manualForm.full_name} onboarded successfully`, "success");
            setShowManualModal(false);
            setManualForm({
                full_name: "",
                email: "",
                company: "",
                project_name: "",
                total_value: "",
                paid_amount: "0"
            });
            fetchClients();
        } catch (err: any) {
            console.error("Manual onboarding failed:", err);
            showToast(err.message || "Failed to onboard client", "error");
        } finally {
            setIsSubmittingManual(false);
        }
    };

    const handleRemind = async (clientId: string, name: string, email?: string) => {
        try {
            // 1. Create System Notification
            const { error: notifError } = await supabase.from('notifications').insert([{
                type: 'System',
                message: `Sent review reminder to ${name}`,
                link: '/admin/clients'
            }]);

            if (notifError) throw notifError;

            // 2. Log Message (if email provided)
            if (email) {
                await supabase.from('messages').insert([{
                    receiver_email: email,
                    subject: "Review Request: Your Experience with Cortdevs",
                    body: `Hi ${name},\n\nWe hope you're enjoying your project! Could you please take a moment to leave us a review?\n\nBest,\nThe Cortdevs Team`,
                    type: 'Client',
                    is_sent: true
                }]);
            }

            showToast(`Reminder sent to ${name}`, "success");
        } catch (err: any) {
            console.error("Remind error:", err);
            showToast("Failed to send reminder", "error");
        }
    };

    // Invoice Logic
    const addInvoiceItem = () => {
        setInvoiceItems([...invoiceItems, { description: "", quantity: 1, rate: 0, amount: 0 }]);
    };

    const removeInvoiceItem = (index: number) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    };

    const updateInvoiceItem = (index: number, field: string, value: any) => {
        const newItems = [...invoiceItems];
        (newItems[index] as any)[field] = value;
        if (field === 'quantity' || field === 'rate') {
            newItems[index].amount = newItems[index].quantity * newItems[index].rate;
        }
        setInvoiceItems(newItems);
    };

    const calculateSubtotal = () => invoiceItems.reduce((acc, item) => acc + item.amount, 0);
    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        return subtotal + (subtotal * (taxRate / 100));
    };

    const handlePrintInvoice = () => {
        window.print();
    };

    const handleEmailInvoice = async () => {
        if (!selectedClient) return;
        try {
            const subtotal = calculateSubtotal();
            const total = calculateTotal();

            const itemizedRows = invoiceItems.map(item => `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.rate.toLocaleString()}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount.toLocaleString()}</td>
                </tr>
            `).join('');

            const emailBody = `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 30px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                        <h2 style="margin: 0;">CORTDEVS</h2>
                        <div style="text-align: right;">
                            <p style="margin: 0; color: #666;">Invoice: ${invoiceNumber}</p>
                            <p style="margin: 0; color: #666;">Date: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div style="margin-bottom: 40px;">
                        <h4 style="margin-bottom: 10px;">Bill To:</h4>
                        <p style="margin: 0; font-weight: bold;">${selectedClient.name}</p>
                        <p style="margin: 0; color: #666;">${selectedClient.company || 'Private Client'}</p>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                        <thead>
                            <tr style="background: #f9f9f9;">
                                <th style="padding: 10px; text-align: left;">Description</th>
                                <th style="padding: 10px; text-align: center;">Qty</th>
                                <th style="padding: 10px; text-align: right;">Rate</th>
                                <th style="padding: 10px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemizedRows}
                        </tbody>
                    </table>
                    <div style="text-align: right;">
                        <p style="margin: 5px 0;">Subtotal: $${subtotal.toLocaleString()}</p>
                        <p style="margin: 5px 0;">Tax (${taxRate}%): $${(subtotal * (taxRate / 100)).toLocaleString()}</p>
                        <h3 style="margin: 10px 0;">Total: $${total.toLocaleString()}</h3>
                    </div>
                    <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 20px; font-size: 12px; color: #999;">
                        Thank you for choosing Cortdevs for your digital solutions. We look forward to our continued partnership.
                    </div>
                </div>
            `;

            const { error } = await supabase.from('messages').insert([{
                receiver_email: selectedClient.email || '', // Client email if available
                subject: `Invoice ${invoiceNumber} from Cortdevs`,
                body: emailBody,
                type: 'Direct'
            }]);

            if (error) throw error;
            showToast("Invoice sent to client mailbox", "success");
            setShowInvoiceModal(false);
        } catch (err: any) {
            showToast("Failed to send invoice", "error");
        }
    };

    const fetchClientIntelligence = async (email: string) => {
        if (!email) {
            setClientIntelligence([]);
            return;
        }
        setIsIntelligenceLoading(true);
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`receiver_email.eq."${email}", body.ilike."%${email}%"`) // Fallback for body content
                .order('created_at', { ascending: false });
            if (error) throw error;
            setClientIntelligence(data || []);
        } catch (err) {
            console.error("Intelligence fetch error:", err);
        } finally {
            setIsIntelligenceLoading(false);
        }
    };

    const fetchClientDocuments = async (clientId: string) => {
        setIsVaultLoading(true);
        try {
            const { data, error } = await supabase
                .from('client_documents')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setClientDocuments(data || []);
        } catch (err) {
            console.error("Vault fetch error:", err);
        } finally {
            setIsVaultLoading(false);
        }
    };

    const fetchClientTransactions = async (clientId: string) => {
        setIsFinancialsLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('client_id', clientId)
                .order('date', { ascending: false });
            if (error) throw error;
            setClientTransactions(data || []);
        } catch (err) {
            console.error("Transactions fetch error:", err);
        } finally {
            setIsFinancialsLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !selectedClient) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${selectedClient.id}/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('client-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('client-assets')
                .getPublicUrl(filePath);

            // 3. Register in database
            const { error: dbError } = await supabase
                .from('client_documents')
                .insert([{
                    client_id: selectedClient.id,
                    name: file.name,
                    file_url: publicUrl,
                    type: file.type,
                    size: file.size
                }]);

            if (dbError) throw dbError;

            showToast("Asset synchronized to Vault.", "success");
            fetchClientDocuments(selectedClient.id);
        } catch (err: any) {
            console.error("Upload error:", err);
            showToast(err.message || "Upload failed", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadFile = async (url: string, fileName: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Download error:", err);
            showToast("Download failed", "error");
        }
    };

    const handleRenameFile = async (docId: string, newName: string) => {
        if (!newName.trim()) return;
        try {
            const { error } = await supabase
                .from('client_documents')
                .update({ name: newName })
                .eq('id', docId);

            if (error) throw error;
            showToast("Asset renamed.", "success");
            setRenamingDoc(null);
            if (selectedClient) fetchClientDocuments(selectedClient.id);
        } catch (err) {
            console.error("Rename error:", err);
            showToast("Rename failed", "error");
        }
    };

    const handleDeleteFile = async (docId: string, fileUrl: string) => {
        try {
            const pathParts = fileUrl.split('client-assets/');
            const filePath = pathParts[1];

            const { error: storageError } = await supabase.storage
                .from('client-assets')
                .remove([filePath]);

            if (storageError) throw storageError;

            const { error: dbError } = await supabase
                .from('client_documents')
                .delete()
                .eq('id', docId);

            if (dbError) throw dbError;

            showToast("Asset purged from Vault.", "success");
            setDocToDelete(null);
            if (selectedClient) fetchClientDocuments(selectedClient.id);
        } catch (err: any) {
            console.error("Delete error:", err);
            showToast("Failed to purge asset", "error");
        }
    };

    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const mappedClients: Client[] = data.map((item: any) => ({
                    id: item.id,
                    name: item.full_name,
                    company: item.company,
                    project: item.project_name,
                    totalValue: item.total_value,
                    paid: item.paid_amount,
                    status: item.status as Client["status"],
                    email: item.email || '',
                    review: item.review
                }));
                setClients(mappedClients);
            }
        } catch (err) {
            console.error("Error fetching clients:", err);
            showToast("Failed to load clients", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const pendingReviewClients = clients.filter(c => !c.review && (c.status === 'Completed' || c.status === 'Launched'));

    const deleteClient = async (id: string) => {
        if (!confirm("Are you sure you want to delete this client?")) return;
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast("Client profile decommissioned", "success");
            setClients(prev => prev.filter(c => c.id !== id));
            setSelectedClient(null);
        } catch (err: any) {
            console.error("Error deleting client:", err);
            showToast("Deletion failed: " + err.message, "error");
        }
    };

    const fetchMilestones = async (clientId: string) => {
        setIsMilestoneLoading(true);
        try {
            const { data, error } = await supabase
                .from('project_milestones')
                .select('*')
                .eq('client_id', clientId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            setMilestones(data || []);
        } catch (err) {
            console.error("Error fetching milestones:", err);
        } finally {
            setIsMilestoneLoading(false);
        }
    };

    const addMilestone = async () => {
        if (!selectedClient || !newMilestone.title) return;
        try {
            const { data, error } = await supabase
                .from('project_milestones')
                .insert([{
                    client_id: selectedClient.id,
                    title: newMilestone.title,
                    description: newMilestone.description,
                    status: 'Pending'
                }])
                .select()
                .single();
            if (error) throw error;
            setMilestones(prev => [...prev, data]);
            setNewMilestone({ title: "", description: "" });
            setIsAddingMilestone(false);
            showToast("Milestone deployed.", "success");
        } catch (err) {
            showToast("Deployment failed", "error");
        }
    };

    const updateMilestoneStatus = async (id: string, status: string) => {
        try {
            const { error } = await supabase
                .from('project_milestones')
                .update({ status })
                .eq('id', id);
            if (error) throw error;
            setMilestones(prev => prev.map(m => m.id === id ? { ...m, status } : m));
        } catch (err) {
            showToast("Status sync failed", "error");
        }
    };

    const deleteMilestone = async (id: string) => {
        try {
            const { error } = await supabase
                .from('project_milestones')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setMilestones(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            showToast("Purge failed", "error");
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    useEffect(() => {
        if (selectedClient) {
            fetchMilestones(selectedClient.id);
            fetchClientIntelligence(selectedClient.id);
            fetchClientDocuments(selectedClient.id);
            fetchClientTransactions(selectedClient.id);
        } else {
            setMilestones([]);
            setClientIntelligence([]);
            setClientDocuments([]);
        }
    }, [selectedClient]);

    const totalPages = Math.ceil(clients.length / itemsPerPage);
    const paginatedClients = clients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusStyle = (status: Client["status"]) => {
        switch (status) {
            case "In Progress": return "bg-orange-500 hover:bg-orange-600";
            case "Launched": return "bg-green-600 shadow-lg shadow-green-100";
            case "Completed": return "bg-blue-500";
            default: return "bg-neutral-500";
        }
    };

    const currentMilestone = milestones.filter(m => m.status === 'In Progress')[0] || milestones.filter(m => m.status === 'Pending')[0] || milestones[milestones.length - 1];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                <div className="w-full">
                    <h2 className="text-2xl font-light tracking-tight italic">Client Portfolios</h2>
                    <p className="text-sm text-neutral-500 mt-1">Oversee active projects, financial data, and client satisfaction.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={fetchClients}
                        disabled={isLoading}
                        className="flex-1 sm:flex-none p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                        title="Refresh Clients"
                    >
                        <RefreshCw size={18} className={`mx-auto text-neutral-500 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={handleOnboard}
                        className="flex-1 sm:flex-none bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                    >
                        Onboard <Plus size={14} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white border border-neutral-200 min-h-[400px]">
                        {isLoading && clients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <RefreshCw className="w-8 h-8 text-neutral-200 animate-spin mb-4" />
                                <p className="text-sm text-neutral-400 italic font-light">Accessing secure archives...</p>
                            </div>
                        ) : clients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
                                <Briefcase size={40} className="mb-4 opacity-20" />
                                <p className="text-sm italic">No active clients found in the ecosystem.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                            <th className="p-6 w-16">S/N</th>
                                            <th className="p-6">Client & Company</th>
                                            <th className="p-6">Project Ecosystem</th>
                                            <th className="p-6">Economic Status</th>
                                            <th className="p-6">Milestone</th>
                                            <th className="p-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {paginatedClients.map((client, index) => (
                                            <tr
                                                key={client.id}
                                                className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer group ${selectedClient?.id === client.id ? "bg-neutral-50" : ""}`}
                                                onClick={() => setSelectedClient(client)}
                                            >
                                                <td className="p-6 text-neutral-300 font-mono text-xs">
                                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                                </td>
                                                <td className="p-6">
                                                    <p className="font-semibold text-neutral-900">{client.name}</p>
                                                    <p className="text-xs text-neutral-500">{client.company}</p>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase size={14} className="text-neutral-400" />
                                                        <span className="font-light">{client.project}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <p className="font-medium text-neutral-900">{client.totalValue}</p>
                                                    <p className="text-[10px] text-green-600 font-bold italic">{client.paid} PAID</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-3 py-1 text-white text-[10px] font-bold uppercase tracking-tight whitespace-nowrap inline-block ${getStatusStyle(client.status)}`}>
                                                        {client.status}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <div className="relative group/btn inline-block">
                                                        <Settings size={16} className="text-neutral-300 group-hover:text-black transition-colors" />
                                                        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-black text-white text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                            Project Controls
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-neutral-900 p-8 text-white relative overflow-hidden">
                            <h3 className="text-3xl font-light italic mb-2">Revenue<br />Stream</h3>
                            <p className="text-4xl font-bold tracking-tighter">
                                ${clients.reduce((acc, c) => acc + parseFloat(c.totalValue.replace(/[^0-9.]/g, '') || "0"), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <div className="mt-6 flex gap-4">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Total Contract Value</div>
                            </div>
                            <DollarSign size={80} className="absolute -bottom-4 -right-4 opacity-5" />
                        </div>

                        <div className="bg-white border border-neutral-200 p-8">
                            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-400 mb-6">Pending Review Requests</h3>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {pendingReviewClients.length === 0 ? (
                                    <div className="py-4 text-center border border-dashed border-neutral-100 rounded">
                                        <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">No pending reviews</p>
                                    </div>
                                ) : (
                                    pendingReviewClients.map(client => (
                                        <div key={client.id} className="flex items-center justify-between p-4 bg-neutral-50 border-l-2 border-orange-400 hover:bg-neutral-100 transition-all">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-semibold">{client.name}</span>
                                                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter">{client.company}</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemind(client.id, client.name)}
                                                className="px-3 py-1 bg-white border border-neutral-200 text-[9px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-1"
                                            >
                                                Remind <Mail size={10} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Panel */}
                <div className="space-y-6">
                    <AnimatePresence mode="wait">
                        {selectedClient ? (
                            <motion.div
                                key={selectedClient.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white border border-neutral-200 shadow-2xl overflow-hidden"
                            >
                                <div className="p-6 bg-neutral-900 text-white flex justify-between items-center">
                                    <h3 className="font-bold uppercase tracking-[0.2em] text-xs">Project Dossier</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => deleteClient(selectedClient.id)}
                                            className="p-2 border border-neutral-100 hover:bg-red-600 hover:text-white transition-all text-red-500"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <CheckCircle2 size={16} className="text-green-400" />
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 space-y-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Current Milestone</p>
                                        <p className="text-lg font-light italic leading-tight">
                                            {currentMilestone ? currentMilestone.title : "No active milestone"}
                                        </p>
                                        {currentMilestone && (
                                            <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest mt-1">
                                                [{currentMilestone.status}]
                                            </p>
                                        )}
                                    </div>

                                    {/* Milestone Manager */}
                                    <div className="space-y-4 pt-4 border-t border-neutral-50">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Milestones</p>
                                            <button
                                                onClick={() => setIsAddingMilestone(!isAddingMilestone)}
                                                className="text-[10px] font-bold uppercase tracking-widest text-neutral-900 border-b border-black flex items-center gap-1"
                                            >
                                                {isAddingMilestone ? "Cancel" : "Add New"} <PlusCircle size={12} />
                                            </button>
                                        </div>

                                        <AnimatePresence>
                                            {isAddingMilestone && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden space-y-2 pb-4"
                                                >
                                                    <input
                                                        type="text"
                                                        placeholder="Milestone Title"
                                                        value={newMilestone.title}
                                                        onChange={(e) => setNewMilestone(prev => ({ ...prev, title: e.target.value }))}
                                                        className="w-full p-2 text-xs border border-neutral-200 outline-none focus:border-black"
                                                    />
                                                    <textarea
                                                        placeholder="Quick description..."
                                                        value={newMilestone.description}
                                                        onChange={(e) => setNewMilestone(prev => ({ ...prev, description: e.target.value }))}
                                                        className="w-full p-2 text-xs border border-neutral-200 outline-none focus:border-black h-16 resize-none"
                                                    />
                                                    <button
                                                        onClick={addMilestone}
                                                        className="w-full py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest"
                                                    >
                                                        Deploy Milestone
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                            {isMilestoneLoading ? (
                                                <div className="flex justify-center py-4"><RefreshCw size={14} className="animate-spin text-neutral-200" /></div>
                                            ) : milestones.length === 0 ? (
                                                <p className="text-[10px] italic text-neutral-400">Initialize project roadmap...</p>
                                            ) : (
                                                milestones.map((m) => (
                                                    <div key={m.id} className="group/m p-3 bg-neutral-50 border border-neutral-100 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2">
                                                                <CornerDownRight size={12} className="text-neutral-300" />
                                                                <span className="text-xs font-semibold">{m.title}</span>
                                                            </div>
                                                            <button onClick={() => deleteMilestone(m.id)} className="opacity-0 group-hover/m:opacity-100 text-red-400 hover:text-red-600 transition-all">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['Pending', 'In Progress', 'Completed'].map((s) => (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => updateMilestoneStatus(m.id, s)}
                                                                    className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-tighter transition-all border ${m.status === s
                                                                        ? (s === 'Completed' ? 'bg-green-600 text-white border-green-600' : s === 'In Progress' ? 'bg-orange-500 text-white border-orange-500' : 'bg-neutral-900 text-white border-neutral-900')
                                                                        : 'bg-white text-neutral-400 border-neutral-100 hover:border-neutral-300'
                                                                        }`}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-6 border-t border-neutral-50">
                                        <button
                                            onClick={() => setShowInvoiceModal(true)}
                                            className="w-full p-4 border border-neutral-100 flex items-center justify-between group hover:bg-neutral-900 hover:text-white transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText size={16} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-left">Generate Invoice</span>
                                            </div>
                                            <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>

                                        <button
                                            onClick={() => {
                                                setShowFullDetailsModal(true);
                                                setActiveDetailTab("Vault");
                                            }}
                                            className="w-full p-4 border border-neutral-100 flex items-center justify-between group hover:bg-neutral-900 hover:text-white transition-all text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Download size={16} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Project Assets (Mojo)</span>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setShowFullDetailsModal(true)}
                                            className="w-full p-4 bg-black text-white flex items-center justify-between group hover:bg-neutral-800 transition-all shadow-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Layers size={16} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-left">Full Details</span>
                                            </div>
                                            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>

                                    {selectedClient.review && (
                                        <div className="p-4 bg-yellow-50/50 border border-yellow-100 space-y-3">
                                            <div className="flex gap-1">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={12} className={i < selectedClient.review!.rating ? "fill-yellow-400 text-yellow-400" : "text-neutral-200"} />
                                                ))}
                                            </div>
                                            <p className="text-xs italic text-neutral-600 leading-relaxed">"{selectedClient.review.text}"</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Public Review</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <div className="p-12 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-300 text-center space-y-4">
                                <Briefcase size={40} className="stroke-1 opacity-20" />
                                <p className="text-xs italic">Select a client profile<br />to access project controls</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Choice Modal */}
            <AnimatePresence>
                {showOnboardOptions && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white border border-neutral-200 shadow-3xl w-full max-w-sm overflow-hidden text-black"
                        >
                            <div className="p-8 space-y-8">
                                <div className="text-center">
                                    <PlusCircle size={40} className="mx-auto mb-4 text-neutral-300" />
                                    <h3 className="text-xl font-light italic">Start Onboarding</h3>
                                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-2 px-4 leading-loose">
                                        Choose how you want to ingest this client profile into the ecosystem.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={() => {
                                            setShowOnboardOptions(false);
                                            navigate("/admin/leads");
                                            showToast("Select a lead to convert", "info");
                                        }}
                                        className="p-6 border border-neutral-100 hover:border-black transition-all text-left bg-neutral-50/50 group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white border border-neutral-100">Path A</span>
                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all text-neutral-400" />
                                        </div>
                                        <p className="font-semibold text-sm">Convert from Leads</p>
                                        <p className="text-[9px] text-neutral-400 uppercase mt-1">Transform existing lead data</p>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowOnboardOptions(false);
                                            setShowManualModal(true);
                                        }}
                                        className="p-6 border border-neutral-100 hover:border-black transition-all text-left bg-neutral-50/50 group"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-white border border-neutral-100">Path B</span>
                                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-all text-neutral-400" />
                                        </div>
                                        <p className="font-semibold text-sm">Manual Onboarding</p>
                                        <p className="text-[9px] text-neutral-400 uppercase mt-1">Direct detail entry</p>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setShowOnboardOptions(false)}
                                    className="w-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all pt-4"
                                >
                                    Dismiss Selection
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Manual Onboarding Modal */}
            <AnimatePresence>
                {showManualModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            className="bg-white border border-neutral-200 shadow-3xl w-full max-w-xl overflow-hidden text-black"
                        >
                            <div className="p-6 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-light italic">Manual Portfolio Entry</h3>
                                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Client & Project Initialization</p>
                                </div>
                                <button onClick={() => setShowManualModal(false)} className="text-neutral-400 hover:text-black">
                                    <Settings size={20} className="animate-spin-slow" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Full Name *</label>
                                        <input
                                            type="text"
                                            value={manualForm.full_name}
                                            onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={manualForm.email}
                                            onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Company</label>
                                        <input
                                            type="text"
                                            value={manualForm.company}
                                            onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="Acme Corp"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Project Name *</label>
                                        <input
                                            type="text"
                                            value={manualForm.project_name}
                                            onChange={(e) => setManualForm({ ...manualForm, project_name: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="E-commerce Build"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Total Value</label>
                                        <input
                                            type="text"
                                            value={manualForm.total_value}
                                            onChange={(e) => setManualForm({ ...manualForm, total_value: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="$5,000.00"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Initial Paid Amount</label>
                                        <input
                                            type="text"
                                            value={manualForm.paid_amount}
                                            onChange={(e) => setManualForm({ ...manualForm, paid_amount: e.target.value })}
                                            className="w-full p-3 border border-neutral-100 bg-neutral-50 focus:bg-white focus:border-black outline-none transition-all text-xs"
                                            placeholder="$2,500.00"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-4">
                                <button
                                    onClick={() => setShowManualModal(false)}
                                    className="px-6 py-2 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:border-black transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleManualOnboard}
                                    disabled={isSubmittingManual}
                                    className="px-8 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmittingManual ? (
                                        <>Initializing... <RefreshCw size={12} className="animate-spin" /></>
                                    ) : (
                                        <>Deploy Portfolio <Plus size={14} /></>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Invoice Generation Modal */}
            <AnimatePresence>
                {showInvoiceModal && selectedClient && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-lg overflow-y-auto print:bg-white print:p-0">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white border border-neutral-200 shadow-3xl w-full max-w-4xl overflow-hidden text-black print:border-0 print:shadow-none print:max-w-none"
                        >
                            {/* Modal Header (Hide on Print) */}
                            <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex justify-between items-center print:hidden">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Financial Engine / Invoice ${invoiceNumber}</span>
                                </div>
                                <button onClick={() => setShowInvoiceModal(false)} className="text-neutral-400 hover:text-black">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-12 space-y-12">
                                {/* Invoice Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-4xl font-light tracking-tighter italic mb-1">CORTDEVS</h1>
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Premium Web Solutions</p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-light uppercase tracking-widest mb-2">Invoice</h2>
                                        <p className="text-xs text-neutral-500 font-mono">#{invoiceNumber}</p>
                                        <p className="text-xs text-neutral-500 font-mono">{new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Billing Info */}
                                <div className="grid grid-cols-2 gap-12 border-y border-neutral-100 py-8">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Bill To</p>
                                        <h3 className="text-lg font-semibold">{selectedClient.name}</h3>
                                        <p className="text-sm text-neutral-500 italic">{selectedClient.company || 'Private Client'}</p>
                                        <p className="text-xs text-neutral-400 mt-2">{selectedClient.project}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Issuer</p>
                                        <h3 className="text-lg font-semibold">Cortdevs Agency</h3>
                                        <p className="text-sm text-neutral-500 italic">Financial Department</p>
                                        <p className="text-xs text-neutral-400 mt-2">projects@cortdevs.com</p>
                                    </div>
                                </div>

                                {/* Itemized Table */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-12 gap-4 pb-4 border-b-2 border-black text-[10px] font-bold uppercase tracking-widest">
                                        <div className="col-span-6">Description</div>
                                        <div className="col-span-2 text-center">Qty</div>
                                        <div className="col-span-2 text-right">Rate</div>
                                        <div className="col-span-2 text-right">Amount</div>
                                    </div>

                                    <div className="space-y-4">
                                        {invoiceItems.map((item, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-4 items-center group">
                                                <div className="col-span-6">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => updateInvoiceItem(idx, 'description', e.target.value)}
                                                        placeholder="Item description..."
                                                        className="w-full text-sm border-b border-transparent hover:border-neutral-200 focus:border-black outline-none py-1 transition-all"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-center">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateInvoiceItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                                        className="w-full text-sm text-center border-b border-transparent hover:border-neutral-200 focus:border-black outline-none py-1"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={item.rate}
                                                        onChange={(e) => updateInvoiceItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="w-full text-sm text-right border-b border-transparent hover:border-neutral-200 focus:border-black outline-none py-1"
                                                    />
                                                </div>
                                                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                                                    <span className="text-sm font-semibold">${item.amount.toLocaleString()}</span>
                                                    <button
                                                        onClick={() => removeInvoiceItem(idx)}
                                                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={addInvoiceItem}
                                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all flex items-center gap-2 pt-4 print:hidden"
                                    >
                                        <PlusCircle size={14} /> Add Billing Row
                                    </button>
                                </div>

                                {/* Totals */}
                                <div className="flex justify-end pt-12">
                                    <div className="w-64 space-y-4">
                                        <div className="flex justify-between text-xs text-neutral-500">
                                            <span>Subtotal</span>
                                            <span>${calculateSubtotal().toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-neutral-500 group">
                                            <span>Tax Rate (%)</span>
                                            <input
                                                type="number"
                                                value={taxRate}
                                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                                className="w-12 text-right border-b border-transparent group-hover:border-neutral-200 focus:border-black outline-none print:hidden"
                                            />
                                            <span className="hidden print:inline">${(calculateSubtotal() * (taxRate / 100)).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-4 border-t-2 border-black">
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Grand Total</span>
                                            <span className="text-2xl font-light tracking-tighter italic">${calculateTotal().toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Note */}
                                <div className="pt-24 opacity-50 text-[9px] uppercase tracking-widest leading-loose max-w-md">
                                    Terms: All digital deliverables remain property of Cortdevs until final settlement. Late payments incur a 5% monthly compounding fee.
                                </div>
                            </div>

                            {/* Modal Footer (Hide on Print) */}
                            <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center print:hidden">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handlePrintInvoice}
                                        className="px-6 py-3 border border-neutral-900 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2"
                                    >
                                        Download / Print <Printer size={14} />
                                    </button>
                                    <button
                                        onClick={handleEmailInvoice}
                                        className="px-6 py-3 border border-neutral-900 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center gap-2"
                                    >
                                        Email to Client <Mail size={14} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowInvoiceModal(false)}
                                    className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Full Details Modal */}
            <AnimatePresence>
                {showFullDetailsModal && selectedClient && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white border border-neutral-200 shadow-4xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden text-black"
                        >
                            {/* Modal Header */}
                            <div className="p-8 border-b border-neutral-100 bg-neutral-50 flex justify-between items-end">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`px-2 py-1 text-[8px] font-bold uppercase tracking-[0.2em] text-white ${getStatusStyle(selectedClient.status)}`}>
                                            {selectedClient.status}
                                        </div>
                                        <span className="text-[10px] font-mono text-neutral-400">ID: {selectedClient.id.slice(0, 8)}</span>
                                    </div>
                                    <h3 className="text-4xl font-light italic leading-none">{selectedClient.name}</h3>
                                    <p className="text-xs text-neutral-500 mt-2 uppercase tracking-widest font-bold">
                                        {selectedClient.company} / {selectedClient.project}
                                    </p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setShowFullDetailsModal(false)}
                                        className="p-3 border border-neutral-200 hover:bg-black hover:text-white transition-all rounded-full"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Tab Navigation */}
                            <div className="flex px-8 border-b border-neutral-100 bg-white sticky top-0 z-10">
                                {["Overview", "Roadmap", "Intelligence", "Financials", "Vault"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveDetailTab(tab as any)}
                                        className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all border-b-2 ${activeDetailTab === tab
                                            ? "border-black text-black"
                                            : "border-transparent text-neutral-400 hover:text-neutral-600"
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeDetailTab}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="space-y-12"
                                    >
                                        {activeDetailTab === "Overview" && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block mb-2">Core Contact</label>
                                                        <div className="p-6 bg-neutral-50 border border-neutral-100 space-y-4">
                                                            <div className="flex items-center gap-3">
                                                                <Info size={16} className="text-neutral-400" />
                                                                <span className="text-sm font-semibold">{selectedClient.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Mail size={16} className="text-neutral-400" />
                                                                <span className="text-sm">{selectedClient.email || "No email provided"}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Briefcase size={16} className="text-neutral-400" />
                                                                <span className="text-sm">{selectedClient.company}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-6 border border-yellow-100 bg-yellow-50/30">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600 mb-2 flex items-center gap-2">
                                                            <Shield size={12} /> Compliance Status
                                                        </p>
                                                        <p className="text-xs italic text-neutral-600 leading-relaxed">
                                                            All contractual milestones are currently synced with the master agreement. No flags detected.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="lg:col-span-2 space-y-8">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block mb-4">Project Ecosystem</label>
                                                        <div className="bg-neutral-900 text-white p-10 relative overflow-hidden">
                                                            <h4 className="text-3xl font-light italic mb-4">{selectedClient.project}</h4>
                                                            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                                                                <span>Active Development</span>
                                                                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                                                                <span>Provisioned</span>
                                                            </div>
                                                            <Briefcase size={120} className="absolute -bottom-10 -right-10 opacity-5" />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="p-6 border border-neutral-100 bg-white">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Contract Value</p>
                                                            <p className="text-xl font-semibold">{selectedClient.totalValue}</p>
                                                        </div>
                                                        <div className="p-6 border border-neutral-100 bg-white shadow-sm border-l-4 border-l-black">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Total Contributions</p>
                                                            <p className="text-xl font-semibold text-green-600">{selectedClient.paid}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeDetailTab === "Roadmap" && (
                                            <div className="max-w-4xl mx-auto space-y-12">
                                                <div className="flex justify-between items-end border-b border-neutral-100 pb-8">
                                                    <div>
                                                        <h4 className="text-2xl font-light italic">Project Phasing</h4>
                                                        <p className="text-xs text-neutral-500">Live deployment tracking and quality assurance checkpoints.</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Completion Rate</p>
                                                        <p className="text-xl font-mono">
                                                            {Math.round((milestones.filter(m => m.status === 'Completed').length / (milestones.length || 1)) * 100)}%
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    {milestones.length === 0 ? (
                                                        <div className="py-20 text-center border-2 border-dashed border-neutral-100 text-neutral-300">
                                                            No milestones provisioned for this portfolio.
                                                        </div>
                                                    ) : (
                                                        milestones.map((m, idx) => (
                                                            <div key={m.id} className="relative pl-12 pb-12 border-l border-neutral-100 last:pb-0 last:border-0">
                                                                <div className={`absolute -left-[5px] top-0 w-[9px] h-[9px] rounded-full ${m.status === 'Completed' ? 'bg-green-600 scale-125 shadow-lg shadow-green-100' : 'bg-neutral-200'
                                                                    }`}></div>
                                                                <div className="bg-white border border-neutral-100 p-8 hover:shadow-xl transition-all group">
                                                                    <div className="flex justify-between items-start mb-4">
                                                                        <div>
                                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Phase {idx + 1}</p>
                                                                            <h5 className="text-lg font-semibold">{m.title}</h5>
                                                                        </div>
                                                                        <div className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest border ${m.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                                            m.status === 'In Progress' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-neutral-50 text-neutral-400 border-neutral-100'
                                                                            }`}>
                                                                            {m.status}
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-sm text-neutral-600 leading-relaxed max-w-2xl">{m.description || "No tactical details recorded for this phase."}</p>
                                                                    <div className="mt-6 pt-6 border-t border-neutral-50 flex items-center gap-2 text-[9px] text-neutral-400 font-mono italic">
                                                                        <Clock size={10} /> Logged: {new Date(m.created_at).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeDetailTab === "Intelligence" && (
                                            <div className="max-w-4xl mx-auto space-y-12">
                                                <header className="flex justify-between items-end border-b border-neutral-100 pb-8">
                                                    <div>
                                                        <h4 className="text-2xl font-light italic">Communication Registry</h4>
                                                        <p className="text-xs text-neutral-500">End-to-end sync of all touchpoints with {selectedClient.name}.</p>
                                                    </div>
                                                    <History size={24} className="text-neutral-200" />
                                                </header>

                                                <div className="space-y-4">
                                                    {isIntelligenceLoading ? (
                                                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                                                            <RefreshCw className="animate-spin text-neutral-200" size={32} />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Loading Intelligence...</p>
                                                        </div>
                                                    ) : clientIntelligence.length === 0 ? (
                                                        <div className="py-20 text-center border-2 border-dashed border-neutral-100 text-neutral-300">
                                                            No communication history found for this entity.
                                                        </div>
                                                    ) : (
                                                        clientIntelligence.map((msg) => (
                                                            <div key={msg.id} className="p-6 border border-neutral-100 hover:bg-neutral-50 transition-all group">
                                                                <div className="flex justify-between items-start mb-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold uppercase tracking-tight text-neutral-400 mb-1">{msg.type} / {new Date(msg.created_at).toLocaleString()}</p>
                                                                        <h6 className="text-sm font-semibold">{msg.subject}</h6>
                                                                    </div>
                                                                    {msg.is_sent ? (
                                                                        <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 border border-green-100">
                                                                            <CheckCircle2 size={10} /> Dispatched
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[8px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-0.5 border border-blue-100">
                                                                            Received
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div
                                                                    className="text-xs text-neutral-600 line-clamp-2 italic"
                                                                    dangerouslySetInnerHTML={{ __html: msg.body }}
                                                                />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeDetailTab === "Financials" && (
                                            <div className="max-w-5xl mx-auto space-y-12">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                    <div className="p-10 bg-black text-white space-y-4 relative overflow-hidden">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Total Contract Value</p>
                                                        <h4 className="text-3xl font-light tracking-tighter italic">{selectedClient.totalValue}</h4>
                                                        <DollarSign size={60} className="absolute -bottom-4 -right-4 opacity-10" />
                                                    </div>
                                                    <div className="p-10 border border-neutral-100 bg-white space-y-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Captured Revenue</p>
                                                        <h4 className="text-3xl font-light tracking-tighter italic text-green-600">{selectedClient.paid}</h4>
                                                    </div>
                                                    <div className="p-10 border border-neutral-100 bg-neutral-50 space-y-4">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Outstanding Balance</p>
                                                        <h4 className="text-3xl font-light tracking-tighter italic text-red-500">
                                                            ${(parseFloat(selectedClient.totalValue.replace(/[^0-9.]/g, '') || "0") - parseFloat(selectedClient.paid.replace(/[^0-9.]/g, '') || "0")).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="bg-white border border-neutral-100">
                                                    <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Live Financial Ledger</h5>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowFullDetailsModal(false);
                                                                setShowInvoiceModal(true);
                                                            }}
                                                            className="text-[10px] font-bold uppercase tracking-widest text-black flex items-center gap-2 hover:bg-neutral-100 px-3 py-1 transition-all"
                                                        >
                                                            New Invoice <PlusCircle size={12} />
                                                        </button>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left">
                                                            <thead>
                                                                <tr className="border-b border-neutral-100 bg-neutral-50/30">
                                                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Date</th>
                                                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Description</th>
                                                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">Category</th>
                                                                    <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-right">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-neutral-50">
                                                                {isFinancialsLoading ? (
                                                                    <tr>
                                                                        <td colSpan={4} className="p-12 text-center text-neutral-400">
                                                                            <RefreshCw className="animate-spin mx-auto mb-2" size={16} />
                                                                            <span className="text-[10px] font-bold uppercase tracking-widest">Syncing Ledger...</span>
                                                                        </td>
                                                                    </tr>
                                                                ) : clientTransactions.length === 0 ? (
                                                                    <tr>
                                                                        <td colSpan={4} className="p-12 text-center text-neutral-300 italic text-xs">
                                                                            No transactions recorded for this client.
                                                                        </td>
                                                                    </tr>
                                                                ) : (
                                                                    clientTransactions.map((tx) => (
                                                                        <tr key={tx.id} className="hover:bg-neutral-50/50 transition-colors">
                                                                            <td className="p-4 text-xs font-medium">{new Date(tx.date).toLocaleDateString()}</td>
                                                                            <td className="p-4 text-xs">{tx.description}</td>
                                                                            <td className="p-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">{tx.category}</td>
                                                                            <td className={`p-4 text-xs font-bold text-right ${tx.type === 'Income' ? 'text-green-600' : 'text-red-500'}`}>
                                                                                {tx.type === 'Income' ? '+' : '-'}${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeDetailTab === "Vault" && (
                                            <div className="max-w-5xl mx-auto space-y-12">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                    <div className="space-y-8">
                                                        <h4 className="text-2xl font-light italic">Digital Assets</h4>
                                                        <div className="space-y-4">
                                                            {isVaultLoading ? (
                                                                <div className="py-20 flex flex-col items-center gap-4">
                                                                    <RefreshCw className="animate-spin text-neutral-200" size={24} />
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Syncing Vault...</p>
                                                                </div>
                                                            ) : clientDocuments.length === 0 ? (
                                                                <div className="py-20 text-center border-2 border-dashed border-neutral-100 text-neutral-300">
                                                                    No assets provisioned in Mojo yet.
                                                                </div>
                                                            ) : (
                                                                clientDocuments.map((doc) => (
                                                                    <div key={doc.id} className="relative group bg-white border border-neutral-100 hover:border-black transition-all p-6">
                                                                        <div className="flex justify-between items-start mb-2">
                                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                                                {(doc.size / 1024 / 1024).toFixed(2)} MB / {doc.type.split('/')[1] || 'FILE'}
                                                                            </span>
                                                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                                                <button
                                                                                    onClick={() => handleDownloadFile(doc.file_url, doc.name)}
                                                                                    className="p-1 hover:text-blue-600 transition-colors"
                                                                                    title="Download"
                                                                                >
                                                                                    <Download size={14} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setRenamingDoc({ id: doc.id, name: doc.name })}
                                                                                    className="p-1 hover:text-green-600 transition-colors"
                                                                                    title="Rename"
                                                                                >
                                                                                    <Edit size={14} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setDocToDelete({ id: doc.id, url: doc.file_url })}
                                                                                    className="p-1 hover:text-red-600 transition-colors"
                                                                                    title="Purge"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <p className="font-semibold text-sm truncate pr-8">{doc.name}</p>
                                                                        <div className="flex justify-between items-end mt-4">
                                                                            <p className="text-[9px] text-neutral-400 uppercase">Status: Provisioned</p>
                                                                            <a
                                                                                href={doc.file_url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-neutral-300 hover:text-black transition-colors"
                                                                            >
                                                                                <ExternalLink size={12} />
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-8">
                                                        <h4 className="text-2xl font-light italic">Registry & Uploads</h4>
                                                        <div className="space-y-4">
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    onChange={handleFileUpload}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                                    disabled={isUploading}
                                                                />
                                                                <div className={`p-12 border border-dashed text-center transition-all ${isUploading ? 'bg-neutral-50 border-neutral-200' : 'border-neutral-200 hover:border-black'}`}>
                                                                    {isUploading ? (
                                                                        <div className="flex flex-col items-center gap-3">
                                                                            <RefreshCw className="animate-spin text-neutral-400" size={24} />
                                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Uploading File...</p>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Sync New Asset</p>
                                                                            <p className="text-[9px] text-neutral-400">Click or drag to provision documents to Vault</p>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-4">
                                <button
                                    onClick={() => setShowFullDetailsModal(false)}
                                    className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-800 transition-all"
                                >
                                    Dismiss Record
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Vault Action Modals */}
            <AnimatePresence>
                {renamingDoc && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white border border-neutral-200 w-full max-w-md p-8 shadow-2xl"
                        >
                            <h4 className="text-xl font-light italic mb-6">Rename Asset</h4>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">New File Name</label>
                                    <input
                                        type="text"
                                        value={renamingDoc.name}
                                        onChange={(e) => setRenamingDoc({ ...renamingDoc, name: e.target.value })}
                                        className="w-full p-3 border border-neutral-200 outline-none focus:border-black text-sm"
                                        onKeyDown={(e) => e.key === 'Enter' && handleRenameFile(renamingDoc.id, renamingDoc.name)}
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={() => handleRenameFile(renamingDoc.id, renamingDoc.name)}
                                        className="flex-1 bg-black text-white py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                                    >
                                        Update Name
                                    </button>
                                    <button
                                        onClick={() => setRenamingDoc(null)}
                                        className="flex-1 border border-neutral-200 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {docToDelete && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white border border-neutral-200 w-full max-w-sm p-10 text-center shadow-2xl"
                        >
                            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={32} />
                            </div>
                            <h4 className="text-xl font-light italic mb-2">Purge Request</h4>
                            <p className="text-xs text-neutral-500 mb-8 leading-relaxed">
                                You are about to permanently remove this asset from the secure vault. This action cannot be reversed.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => handleDeleteFile(docToDelete.id, docToDelete.url)}
                                    className="w-full bg-red-600 text-white py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all"
                                >
                                    Confirm Purge
                                </button>
                                <button
                                    onClick={() => setDocToDelete(null)}
                                    className="w-full border border-neutral-100 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                                >
                                    Abort Action
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
