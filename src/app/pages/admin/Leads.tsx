import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    MessageSquare
} from "lucide-react";

interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string;
    service: string;
    budget: string;
    status: "New" | "Contacted" | "Qualified" | "Lost" | "Converted";
    date: string;
    details: string;
}

const mockLeads: Lead[] = [
    {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1 234 567 890",
        service: "Custom Full-Stack App",
        budget: "$10k - $25k",
        status: "New",
        date: "2024-03-27",
        details: "I need a scalable dashboard for my logistics company. Priority on speed and real-time tracking."
    },
    {
        id: "2",
        name: "Sarah Smith",
        email: "sarah@design.co",
        phone: "+44 20 1234 5678",
        service: "Enterprise Shopify",
        budget: "$5k - $10k",
        status: "Contacted",
        date: "2024-03-26",
        details: "Migrating from Magento to Shopify. Need advanced custom sections and custom checkout logic."
    },
    {
        id: "3",
        name: "Robert Black",
        email: "rob@techventures.com",
        phone: "+234 815 684 1952",
        service: "WordPress Development",
        budget: "$2.5k - $5k",
        status: "Qualified",
        date: "2024-03-25",
        details: "Looking for a high-performance corporate site."
    }
];

export function Leads() {
    const [leads, setLeads] = useState<Lead[]>(mockLeads);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredLeads = leads.filter(lead =>
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                    <button className="p-2 border border-neutral-200 hover:bg-neutral-50 transition-colors">
                        <Filter size={20} className="text-neutral-500" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Leads Table */}
                <div className="lg:col-span-2 bg-white border border-neutral-200 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold">
                                    <th className="p-6">Lead Details</th>
                                    <th className="p-6">Interest</th>
                                    <th className="p-6">Status</th>
                                    <th className="p-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer group ${selectedLead?.id === lead.id ? "bg-neutral-50" : ""}`}
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center rounded-full text-neutral-600 font-bold italic">
                                                    {lead.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">{lead.name}</p>
                                                    <p className="text-xs text-neutral-500">{lead.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <p className="font-medium text-neutral-700">{lead.service}</p>
                                            <p className="text-[10px] text-neutral-400 font-bold">{lead.budget}</p>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-3 py-1 text-white text-[10px] font-bold uppercase tracking-tight ${getStatusColor(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <button className="p-2 hover:bg-white hover:shadow-md transition-all text-neutral-400 hover:text-black">
                                                <ChevronRight size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Lead Details Panel */}
                <AnimatePresence mode="wait">
                    {selectedLead ? (
                        <motion.div
                            key={selectedLead.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="bg-white border border-neutral-200 p-8 space-y-8 sticky top-28 shadow-xl"
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-light italic">{selectedLead.name}</h3>
                                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">{selectedLead.date}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 border border-neutral-100 hover:bg-neutral-900 hover:text-white transition-all">
                                        <Mail size={16} />
                                    </button>
                                    <button className="p-2 border border-neutral-100 hover:bg-red-600 hover:text-white transition-all text-red-500">
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
                                    <p className="text-sm leading-relaxed text-neutral-600 italic">"{selectedLead.details}"</p>
                                </div>

                                <div className="pt-4 border-t border-neutral-100 space-y-4">
                                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Update Lead Status</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["New", "Contacted", "Qualified", "Converted"].map(status => (
                                            <button
                                                key={status}
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

                            <button className="w-full py-4 bg-black text-white text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all">
                                Convert to Client <CheckCircle2 size={14} />
                            </button>
                        </motion.div>
                    ) : (
                        <div className="h-64 border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-400 text-sm italic">
                            <MessageSquare size={32} className="mb-4 opacity-20" />
                            Select a lead to view details
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
