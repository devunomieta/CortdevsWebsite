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
    CornerDownRight
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

    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleOnboard = () => {
        navigate("/admin/leads");
        showToast("Select a lead to convert into a client.", "info");
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
        } else {
            setMilestones([]);
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
                                        <button className="w-full p-4 border border-neutral-100 flex items-center justify-between group hover:bg-neutral-900 hover:text-white transition-all">
                                            <div className="flex items-center gap-3">
                                                <FileText size={16} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-left">Generate Invoice</span>
                                            </div>
                                            <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>

                                        <button className="w-full p-4 border border-neutral-100 flex items-center justify-between group hover:bg-neutral-900 hover:text-white transition-all">
                                            <div className="flex items-center gap-3">
                                                <Download size={16} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-left">Project Assets (Mojo)</span>
                                            </div>
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
        </div>
    );
}
