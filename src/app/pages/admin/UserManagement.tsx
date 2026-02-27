import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    UserPlus,
    Settings,
    MoreVertical,
    Key,
    Lock,
    CheckCircle2,
    AlertCircle,
    Clock,
    Trash2,
    Mail
} from "lucide-react";

interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: "Super Admin" | "Project Manager" | "Editor";
    permissions: string[];
    status: "Active" | "Pending";
}

const mockUsers: AdminUser[] = [
    {
        id: "1",
        name: "HachStack CEO",
        email: "admin@cortdevs.com",
        role: "Super Admin",
        permissions: ["Full Access"],
        status: "Active"
    },
    {
        id: "2",
        name: "Damilola Ade",
        email: "pm@cortdevs.com",
        role: "Project Manager",
        permissions: ["Leads", "Clients", "Comms"],
        status: "Active"
    },
    {
        id: "3",
        name: "External Editor",
        email: "editor@partner.co",
        role: "Editor",
        permissions: ["Settings", "Templates"],
        status: "Pending"
    }
];

export function UserManagement() {
    const [users] = useState<AdminUser[]>(mockUsers);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Administrative Intelligence</h2>
                    <p className="text-sm text-neutral-500">Manage access levels and operational permissions for your squad.</p>
                </div>
                <button
                    onClick={() => setIsInviteModalOpen(true)}
                    className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                >
                    Provision User <UserPlus size={14} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-neutral-200">
                        <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                            <Shield size={18} className="text-neutral-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Active Permissions Matrix</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
                                        <th className="p-4">User</th>
                                        <th className="p-4">Authorization</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Settings</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-bold text-[10px] rounded-sm">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-neutral-900">{user.name}</p>
                                                        <p className="text-[10px] text-neutral-400 font-mono">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium text-black">{user.role}</span>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {user.permissions.map(p => (
                                                            <span key={p} className="text-[8px] bg-neutral-100 text-neutral-500 px-1 border border-neutral-200 uppercase font-bold">{p}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-tighter ${user.status === 'Active' ? 'text-green-600' : 'text-orange-500'}`}>
                                                    {user.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="p-2 text-neutral-300 hover:text-black transition-colors">
                                                    <MoreVertical size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Roles Definition */}
                <div className="space-y-6">
                    <div className="bg-neutral-900 text-white p-8 space-y-8 relative overflow-hidden">
                        <h3 className="text-xl font-light italic">Role Definitons</h3>

                        <div className="space-y-6">
                            {[
                                { r: "Super Admin", d: "Absolute control over infrastructure and finance." },
                                { r: "Project Manager", d: "Manage leads, CRM, and outreach modules." },
                                { r: "Editor", d: "Manage templates, site content, and messaging." },
                            ].map(role => (
                                <div key={role.r} className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{role.r}</p>
                                    <p className="text-xs text-neutral-200 font-light">{role.d}</p>
                                </div>
                            ))}
                        </div>

                        <button className="w-full py-4 border border-white/20 text-[10px] uppercase font-bold tracking-[0.3em] hover:bg-white hover:text-black transition-all">
                            Security Audit Log
                        </button>
                        <div className="absolute top-0 right-0 p-8 transform translate-x-1/2 -translate-y-1/2">
                            <Lock size={120} className="text-white/5 opacity-10" />
                        </div>
                    </div>

                    <div className="p-6 bg-white border border-neutral-200">
                        <div className="flex items-center gap-2 mb-4">
                            <Clock size={14} className="text-orange-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest">Pending Access Requests</h3>
                        </div>
                        <p className="text-[10px] text-neutral-400 italic">No pending authentication overrides detected.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
