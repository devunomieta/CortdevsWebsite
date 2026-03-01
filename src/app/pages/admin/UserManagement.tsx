import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../components/Toast";
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
    Mail,
    RefreshCw,
    X
} from "lucide-react";

interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: "Super Admin" | "Project Manager" | "Editor";
    permissions: string[];
    status: "Active" | "Pending" | "Suspended";
    avatar_url?: string;
}

interface AuditLog {
    id: string;
    action: string;
    target_type: string;
    details: any;
    created_at: string;
    actor_email?: string;
}

interface Invitation {
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string;
}

export function UserManagement() {
    const { showToast } = useToast();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [pendingRequests, setPendingRequests] = useState<AdminUser[]>([]);
    const [provisionData, setProvisionData] = useState({
        email: "",
        role: "Editor" as AdminUser["role"],
        permissions: ["Settings"] as string[]
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [duplicateInvite, setDuplicateInvite] = useState<any>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;

            if (data) {
                const mappedUsers: AdminUser[] = data.map((u: any) => ({
                    id: u.id,
                    name: u.full_name || "New User",
                    email: u.email,
                    role: (u.role as AdminUser["role"]) || "Editor",
                    permissions: u.permissions || [],
                    status: (u.status as AdminUser["status"]) || "Pending",
                    avatar_url: u.avatar_url
                }));
                setUsers(mappedUsers.filter(u => u.status !== 'Pending'));
                setPendingRequests(mappedUsers.filter(u => u.status === 'Pending'));
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAuditLogs = async () => {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (!error && data) setAuditLogs(data);
    };

    const handleProvisionUser = async (forceResend: boolean = false) => {
        if (!provisionData.email) return;
        setIsProcessing(true);
        try {
            // Check for existing pending invitation
            if (!forceResend) {
                const { data: existingInvite, error: checkError } = await supabase
                    .from('invitations')
                    .select('*')
                    .eq('email', provisionData.email)
                    .eq('status', 'Pending')
                    .maybeSingle();

                if (checkError) throw checkError;

                if (existingInvite) {
                    showToast("System detected a pending invitation for this entity.", "info");
                    setDuplicateInvite(existingInvite);
                    return;
                }
            }

            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

            if (forceResend && duplicateInvite) {
                // Update existing invitation
                const { error: updateError } = await supabase
                    .from('invitations')
                    .update({ token, created_at: new Date().toISOString() })
                    .eq('id', duplicateInvite.id);

                if (updateError) throw updateError;
            } else {
                // 1. Create Invitation
                const { error: inviteError } = await supabase
                    .from('invitations')
                    .insert([{
                        email: provisionData.email,
                        role: provisionData.role,
                        token: token,
                        status: 'Pending'
                    }]);

                if (inviteError) throw inviteError;
            }

            // 2. Log Action
            await supabase.from('audit_logs').insert([{
                action: forceResend ? 'INVITE_RESENT' : 'USER_PROVISIONED',
                target_type: 'User',
                details: { email: provisionData.email, role: provisionData.role }
            }]);

            // 3. Send real email via API
            const emailBody = `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #000; font-weight: 300; font-style: italic;">Access Invitation: CortDevs Administrative Intelligence</h2>
                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        You have been ${forceResend ? 're-' : ''}provisioned as a <strong>${provisionData.role}</strong> on the CortDevs Professional Portal.
                    </p>
                    <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border: 1px solid #eee; text-align: center;">
                        <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #999; margin-bottom: 10px;">Security Access Token</p>
                        <code style="font-size: 18px; font-weight: bold; color: #000; letter-spacing: 1px;">${token}</code>
                    </div>
                    <p style="font-size: 14px; color: #666; line-height: 1.6;">
                        To complete your activation, please use this token during your initial sign-up process on the portal.
                    </p>
                    <a href="${window.location.origin}/admin/signup?token=${token}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Complete Registration</a>
                </div>
            `;

            const emailResponse = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: provisionData.email,
                    subject: forceResend ? 'RESEND: Your CortDevs Admin Invitation' : 'Action Required: Your CortDevs Admin Invitation',
                    body: emailBody,
                    type: 'Direct'
                })
            });

            if (!emailResponse.ok) {
                const errorData = await emailResponse.json();
                throw new Error(errorData.error || "Failed to transmit invitation email.");
            }

            showToast(forceResend ? "Invitation resent successfully." : "User provisioned successfully. Invitation transmitted.", "success");
            setIsProvisionModalOpen(false);
            setProvisionData({ email: "", role: "Editor", permissions: ["Settings"] });
            setDuplicateInvite(null);
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to provision user.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveUser = async (userId: string) => {
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'Active' })
                .eq('id', userId);

            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                action: 'USER_APPROVED',
                target_type: 'User',
                target_id: userId
            }]);

            showToast("User account approved.", "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to approve user.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Administrative Intelligence</h2>
                    <p className="text-sm text-neutral-500">Manage access levels and operational permissions for your squad.</p>
                </div>
                <button
                    onClick={() => { fetchAuditLogs(); setIsAuditModalOpen(true); }}
                    className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors"
                    title="Security Audit"
                >
                    <Lock size={18} className="text-neutral-500" />
                </button>
                <button
                    onClick={fetchUsers}
                    disabled={isLoading}
                    className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                    title="Refresh Users"
                >
                    <RefreshCw size={18} className={`text-neutral-500 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                    onClick={() => setIsProvisionModalOpen(true)}
                    className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                >
                    Provision User <UserPlus size={14} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-neutral-200 min-h-[400px]">
                        <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                            <Shield size={18} className="text-neutral-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Active Permissions Matrix</h3>
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-32">
                                <RefreshCw className="w-8 h-8 text-neutral-200 animate-spin mb-4" />
                                <p className="text-sm text-neutral-400 italic font-light">Decrypting user matrix...</p>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
                                <Shield size={40} className="mb-4 opacity-20" />
                                <p className="text-sm italic">No administrators found in the system registry.</p>
                            </div>
                        ) : (
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
                        )}
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

                        <button
                            onClick={() => { fetchAuditLogs(); setIsAuditModalOpen(true); }}
                            className="w-full py-4 border border-white/20 text-[10px] uppercase font-bold tracking-[0.3em] hover:bg-white hover:text-black transition-all"
                        >
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
                        {pendingRequests.length === 0 ? (
                            <p className="text-[10px] text-neutral-400 italic">No pending authentication overrides detected.</p>
                        ) : (
                            <div className="space-y-4">
                                {pendingRequests.map(req => (
                                    <div key={req.id} className="p-3 bg-neutral-50 border border-neutral-100 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-xs font-bold">{req.name}</p>
                                                <p className="text-[9px] text-neutral-400">{req.email}</p>
                                            </div>
                                            <span className="text-[8px] bg-black text-white px-1 font-bold">{req.role}</span>
                                        </div>
                                        <button
                                            onClick={() => handleApproveUser(req.id)}
                                            disabled={isProcessing}
                                            className="w-full py-2 bg-white border border-neutral-200 text-[9px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all disabled:opacity-50"
                                        >
                                            {isProcessing ? "Authorizing..." : "Approve Access"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Provision User Modal */}
            <AnimatePresence>
                {isProvisionModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md p-10 relative text-black"
                        >
                            <button
                                onClick={() => setIsProvisionModalOpen(false)}
                                className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="space-y-8">
                                <header>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Personnel Provisioning</p>
                                    <h3 className="text-3xl font-light italic tracking-tight">Access Invite</h3>
                                </header>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Personnel Email</label>
                                        <input
                                            type="email"
                                            value={provisionData.email}
                                            onChange={(e) => {
                                                setProvisionData({ ...provisionData, email: e.target.value });
                                                setDuplicateInvite(null); // Clear duplicate on Change
                                            }}
                                            className={`w-full bg-neutral-50 border p-4 text-sm outline-none transition-all ${duplicateInvite ? 'border-amber-200' : 'border-neutral-100 focus:border-black'}`}
                                            placeholder="admin@cortdevs.com"
                                        />
                                    </div>

                                    {duplicateInvite && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="bg-amber-50 border border-amber-200 p-4 space-y-3"
                                        >
                                            <div className="flex items-center gap-2 text-amber-700">
                                                <AlertCircle size={14} />
                                                <p className="text-[10px] font-bold uppercase tracking-widest">Active Invitation Detected</p>
                                            </div>
                                            <p className="text-[11px] text-amber-600 leading-relaxed italic">
                                                This email is already associated with a pending invitation. You can transmit a new security token to their inbox.
                                            </p>
                                            <button
                                                onClick={() => handleProvisionUser(true)}
                                                disabled={isProcessing}
                                                className="w-full py-3 bg-amber-600 text-white text-[9px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                                            >
                                                {isProcessing ? <RefreshCw size={12} className="animate-spin" /> : <Mail size={12} />}
                                                Resend Security Token
                                            </button>
                                        </motion.div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Authorization Domain</label>
                                        <select
                                            value={provisionData.role}
                                            onChange={(e) => setProvisionData({ ...provisionData, role: e.target.value as AdminUser["role"] })}
                                            className="w-full bg-neutral-50 border border-neutral-100 p-4 text-sm outline-none focus:border-black transition-all appearance-none"
                                        >
                                            <option value="Super Admin">Super Admin (Root Access)</option>
                                            <option value="Project Manager">Project Manager (Operations)</option>
                                            <option value="Editor">Editor (Intelligence)</option>
                                        </select>
                                    </div>
                                </div>

                                {!duplicateInvite && (
                                    <button
                                        onClick={() => handleProvisionUser(false)}
                                        disabled={isProcessing || !provisionData.email}
                                        className="w-full py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-xl shadow-black/10"
                                    >
                                        {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                        Commit Provision
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Security Audit Modal */}
            <AnimatePresence>
                {isAuditModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="bg-white w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col relative text-black"
                        >
                            <button
                                onClick={() => setIsAuditModalOpen(false)}
                                className="absolute top-10 right-10 text-neutral-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="p-10 space-y-8 flex-1 overflow-y-auto">
                                <header>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Security Architecture</p>
                                    <h3 className="text-3xl font-light italic tracking-tight">Audit Trail</h3>
                                </header>

                                <div className="space-y-6">
                                    {auditLogs.length === 0 ? (
                                        <p className="text-sm text-neutral-400 italic">No security events logged in current cycle.</p>
                                    ) : (
                                        auditLogs.map((log) => (
                                            <div key={log.id} className="flex gap-4 p-4 border-l-2 border-black bg-neutral-50">
                                                <div className="p-2 bg-white border border-neutral-100 h-fit">
                                                    <Shield size={14} className="text-neutral-400" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">{log.action.replace('_', ' ')}</span>
                                                        <span className="text-[9px] text-neutral-400 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-neutral-600">
                                                        Target: <span className="font-bold">{log.target_type}</span> {log.details && `(${JSON.stringify(log.details)})`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
