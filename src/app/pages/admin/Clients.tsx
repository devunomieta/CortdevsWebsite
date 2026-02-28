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
    Trash2
} from "lucide-react";

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
    const navigate = useNavigate();

    const handleOnboard = () => {
        navigate("/admin/leads");
    };

    const handleRemind = async (id: string, name: string) => {
        try {
            await supabase.from('notifications').insert([{
                type: 'System',
                message: `Sent review reminder to ${name}`,
                link: '/admin/clients'
            }]);
            alert(`Reminder notification queued for ${name}`);
        } catch (err) {
            console.error("Remind error:", err);
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
        } finally {
            setIsLoading(false);
        }
    };

    const deleteClient = async (id: string) => {
        if (!confirm("Are you sure you want to delete this client?")) return;
        try {
            const { error } = await supabase
                .from('clients')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setClients(prev => prev.filter(c => c.id !== id));
            setSelectedClient(null);
        } catch (err) {
            console.error("Error deleting client:", err);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const getStatusStyle = (status: Client["status"]) => {
        switch (status) {
            case "In Progress": return "bg-orange-500";
            case "Launched": return "bg-green-600 shadow-lg shadow-green-100";
            case "Completed": return "bg-blue-500";
            default: return "bg-neutral-500";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Client Portfolios</h2>
                    <p className="text-sm text-neutral-500">Oversee active projects, financial data, and client satisfaction.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchClients}
                        disabled={isLoading}
                        className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                        title="Refresh Clients"
                    >
                        <RefreshCw size={18} className={`text-neutral-500 ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={handleOnboard}
                        className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                    >
                        Onboard New Client <Plus size={14} />
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
                                            <th className="p-6">Client & Company</th>
                                            <th className="p-6">Project Ecosystem</th>
                                            <th className="p-6">Economic Status</th>
                                            <th className="p-6">Milestone</th>
                                            <th className="p-6"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {clients.map((client) => (
                                            <tr
                                                key={client.id}
                                                className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer group ${selectedClient?.id === client.id ? "bg-neutral-50" : ""}`}
                                                onClick={() => setSelectedClient(client)}
                                            >
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
                                                    <span className={`px-3 py-1 text-white text-[10px] font-bold uppercase tracking-tight ${getStatusStyle(client.status)}`}>
                                                        {client.status}
                                                    </span>
                                                </td>
                                                <td className="p-6 text-right">
                                                    <Settings size={16} className="text-neutral-300 group-hover:text-black transition-colors" />
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
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-neutral-50 border-l border-orange-400">
                                    <span className="text-xs font-medium">Michael Scott</span>
                                    <button
                                        onClick={() => handleRemind('dummy-1', 'Michael Scott')}
                                        className="text-[10px] font-bold uppercase text-neutral-400 hover:text-black transition-colors"
                                    >
                                        Remind
                                    </button>
                                </div>
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

                                <div className="p-8 space-y-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Current Milestone</p>
                                        <p className="text-lg font-light italic">{selectedClient.project}</p>
                                    </div>

                                    <div className="space-y-4">
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
