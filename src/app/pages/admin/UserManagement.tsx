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
    X,
    Wallet,
    DollarSign,
    ArrowUpRight,
    ArrowDownLeft,
    Banknote,
    Activity,
    FileText,
    Ban,
    UserCheck,
    History,
    Search,
} from "lucide-react";

interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: "Superadmin" | "Admin" | "CTO" | "Devs" | "Operations Officer" | "Sales Officer" | "Client";
    permissions: string[];
    status: "Active" | "Pending" | "Suspended" | "Banned";
    suspended_until?: string;
    banned_at?: string;
    avatar_url?: string;
    wallet_balance?: number;
    wallet_type?: 'Central' | 'Personnel';
    commission_rate?: number;
}

interface WalletTransaction {
    id: string;
    amount: number;
    type: 'Credit' | 'Debit';
    category: string;
    description: string;
    created_at: string;
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
    const [filteredAuditLogs, setFilteredAuditLogs] = useState<AuditLog[]>([]);
    const [pendingRequests, setPendingRequests] = useState<AdminUser[]>([]);
    const [provisionData, setProvisionData] = useState({
        email: "",
        role: "Client" as AdminUser["role"],
        permissions: ["Projects"] as string[]
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [duplicateInvite, setDuplicateInvite] = useState<any>(null);
    const [disburseAmount, setDisburseAmount] = useState("");
    const [disburseDescription, setDisburseDescription] = useState("");
    const [walletHistory, setWalletHistory] = useState<WalletTransaction[]>([]);
    const [commsData, setCommsData] = useState<any[]>([]);
    const [commsSearch, setCommsSearch] = useState("");
    const [commsPage, setCommsPage] = useState(1);
    const [hasMoreComms, setHasMoreComms] = useState(true);
    const [selectedUserManagement, setSelectedUserManagement] = useState<AdminUser | null>(null);
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
    const [managementTab, setManagementTab] = useState("Overview");
    const [suspensionDuration, setSuspensionDuration] = useState("24h");

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;

            if (data) {
                // Fetch wallets in parallel
                const { data: wallets } = await supabase.from('wallets').select('*');

                const mappedUsers: AdminUser[] = data.map((u: any) => {
                    const userWallet = wallets?.find(w => w.user_id === u.id || w.email === u.email);
                    const isSuspended = u.suspended_until && new Date(u.suspended_until) > new Date();
                    const status = isSuspended ? "Suspended" : (u.status as AdminUser["status"]) || "Active";

                    return {
                        id: u.id,
                        name: u.full_name || "New User",
                        email: u.email,
                        role: (u.role as AdminUser["role"]) || "Client",
                        permissions: u.permissions || [],
                        status: status,
                        avatar_url: u.avatar_url,
                        wallet_balance: userWallet?.balance || 0,
                        wallet_type: userWallet?.type || 'Personnel',
                        commission_rate: u.commission_rate || 0,
                        suspended_until: u.suspended_until,
                        banned_at: u.banned_at
                    };
                });
                setUsers(mappedUsers.filter(u => u.status !== 'Pending'));
                setPendingRequests(mappedUsers.filter(u => u.status === 'Pending'));
            }
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAuditLogs = async (userEmail?: string) => {
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

        if (userEmail) {
            query = query.filter('details->>email', 'eq', userEmail);
        }

        const { data, error } = await query.limit(50);

        if (!error && data) {
            const mappedLogs = data.map((log: any) => ({
                ...log,
                severity: (log.action.includes('BANNED') || log.action.includes('PURGE') || log.action.includes('ROLE_ELEVATED')) ? 'High' : 'Normal'
            }));

            if (userEmail) setFilteredAuditLogs(mappedLogs);
            else setAuditLogs(mappedLogs);
        }
    };

    const fetchComms = async (userEmail: string, page: number = 1, search: string = "") => {
        const offset = (page - 1) * 10;
        let query = supabase
            .from('messages')
            .select('*', { count: 'exact' })
            .eq('to', userEmail)
            .order('created_at', { ascending: false })
            .range(offset, offset + 9);

        if (search) {
            query = query.or(`subject.ilike.%${search}%,body.ilike.%${search}%`);
        }

        const { data, count, error } = await query;

        if (!error && data) {
            if (page === 1) setCommsData(data);
            else setCommsData(prev => [...prev, ...data]);
            setHasMoreComms(count ? (offset + data.length < count) : false);
        }
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
            setProvisionData({ email: "", role: "Admin", permissions: ["Settings"] });
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
            showToast("User access authorized.", "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Authorization failed.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTogglePermission = async (userId: string, currentPermissions: string[], permission: string) => {
        const newPermissions = currentPermissions.includes(permission)
            ? currentPermissions.filter(p => p !== permission)
            : [...currentPermissions, permission];

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: newPermissions })
                .eq('id', userId);

            if (error) throw error;
            showToast("System permissions synchronized.", "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to update permissions.", "error");
        }
    };

    const handleUpdateRole = async (userId: string, newRole: AdminUser["role"]) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            showToast(`Role elevated to ${newRole}.`, "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to update role.", "error");
        }
    };

    const handleUpdateCommissionRate = async (userId: string, rate: number) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ commission_rate: rate })
                .eq('id', userId);

            if (error) throw error;
            showToast(`Commission rate set to ${rate}%.`, "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to update commission rate.", "error");
        }
    };

    const handleDisburse = async (targetUser?: AdminUser) => {
        const user = targetUser || selectedUserForWallet;
        if (!user || !disburseAmount) return;
        setIsProcessing(true);

        try {
            const amount = parseFloat(disburseAmount);
            if (isNaN(amount) || amount <= 0) throw new Error("Invalid disbursement amount.");

            // 1. Get Wallet ID
            const { data: wallet } = await supabase
                .from('wallets')
                .select('id, balance')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!wallet) throw new Error("Target wallet synchronization failed.");

            // 2. Perform Transaction
            const { error: txError } = await supabase.from('wallet_transactions').insert([{
                wallet_id: wallet.id,
                amount: amount,
                type: 'Credit',
                category: 'Disbursement',
                description: disburseDescription || 'Administrative Disbursement'
            }]);

            if (txError) throw txError;

            // Update balance
            const { error: balError } = await supabase
                .from('wallets')
                .update({ balance: wallet.balance + (amount) })
                .eq('id', wallet.id);

            if (balError) throw balError;

            // Log it
            await supabase.from('audit_logs').insert([{
                action: 'WALLET_DISBURSEMENT',
                target_type: 'Wallet',
                details: { to: user.email, amount, description: disburseDescription }
            }]);

            showToast(`Transmission of $${amount} to ${user.name} finalized.`, "success");
            setDisburseAmount("");
            setDisburseDescription("");
            fetchUsers();
            if (selectedUserManagement?.id === user.id) {
                fetchWalletHistory(user.id);
            }
        } catch (err: any) {
            showToast(err.message || "Fiscal transmission failed.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const fetchWalletHistory = async (userId: string) => {
        const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', userId).maybeSingle();
        if (wallet) {
            const { data } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('wallet_id', wallet.id)
                .order('created_at', { ascending: false })
                .limit(5);
            if (data) setWalletHistory(data);
        }
    };

    const handleDeleteUser = async (user: AdminUser) => {
        if (user.role === 'Superadmin') {
            showToast("Critical security protocol prevents the deletion of Superadmin identities.", "error");
            return;
        }

        if (!confirm(`Are you certain you wish to purge ${user.email} from the tactical registry? This action is irreversible.`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                action: 'USER_DELETED',
                target_type: 'User',
                details: { email: user.email, name: user.name }
            }]);

            showToast("User successfully purged from the registry.", "success");
            fetchUsers();
        } catch (err: any) {
            showToast(err.message || "Failed to purge user.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSuspend = async (user: AdminUser, duration: string) => {
        setIsProcessing(true);
        try {
            let until = new Date();
            if (duration === "24h") until.setHours(until.getHours() + 24);
            else if (duration === "1w") until.setDate(until.getDate() + 7);
            else if (duration === "30d") until.setDate(until.getDate() + 30);

            const { error } = await supabase
                .from('profiles')
                .update({
                    status: 'Suspended',
                    suspended_until: until.toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                action: 'USER_SUSPENDED',
                target_type: 'User',
                details: { email: user.email, duration, until: until.toISOString() }
            }]);

            showToast(`User suspended until ${until.toLocaleString()}.`, "success");
            fetchUsers();
            if (selectedUserManagement?.id === user.id) {
                setSelectedUserManagement({ ...selectedUserManagement, status: 'Suspended', suspended_until: until.toISOString() });
            }
        } catch (err: any) {
            showToast(err.message || "Failed to suspend user.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBan = async (user: AdminUser) => {
        if (!confirm("Are you ABSOLUTELY certain? This will permanently revoke all access. This action, while reversible by a Superadmin, triggers high-level security alerts.")) return;

        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    status: 'Banned',
                    banned_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                action: 'USER_BANNED',
                target_type: 'User',
                details: { email: user.email }
            }]);

            showToast("User identity has been permanently banned.", "success");
            fetchUsers();
            if (selectedUserManagement?.id === user.id) {
                setSelectedUserManagement({ ...selectedUserManagement, status: 'Banned', banned_at: new Date().toISOString() });
            }
        } catch (err: any) {
            showToast(err.message || "Failed to ban user.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReactivate = async (user: AdminUser) => {
        setIsProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    status: 'Active',
                    suspended_until: null,
                    banned_at: null
                })
                .eq('id', user.id);

            if (error) throw error;

            await supabase.from('audit_logs').insert([{
                action: 'USER_REACTIVATED',
                target_type: 'User',
                details: { email: user.email }
            }]);

            showToast("User access has been restored.", "success");
            fetchUsers();
            if (selectedUserManagement?.id === user.id) {
                setSelectedUserManagement({ ...selectedUserManagement, status: 'Active', suspended_until: undefined, banned_at: undefined });
            }
        } catch (err: any) {
            showToast(err.message || "Failed to restore access.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end gap-6 flex-wrap">
                <div className="flex-1 min-w-[300px]">
                    <h2 className="text-2xl font-light tracking-tight italic">Administrative Intelligence</h2>
                    <p className="text-sm text-neutral-500">Manage access levels and operational permissions for your squad.</p>
                </div>
                <div className="flex items-center gap-2">
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
                                                    <div className="flex flex-col gap-2">
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleUpdateRole(user.id, e.target.value as AdminUser["role"])}
                                                            disabled={user.email === 'projects@cortdevs.com'}
                                                            className={`bg-transparent font-bold text-black outline-none ${user.email === 'projects@cortdevs.com' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:underline'}`}
                                                        >
                                                            <option value="Superadmin">Superadmin</option>
                                                            <option value="Admin">Admin</option>
                                                            <option value="CTO">CTO</option>
                                                            <option value="Operations Officer">Operations Officer</option>
                                                            <option value="Sales Officer">Sales Officer</option>
                                                            <option value="Devs">Devs</option>
                                                            <option value="Client">Client</option>
                                                        </select>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {['Dashboard', 'Leads', 'Clients', 'Transactions', 'Intelligence', 'Personnel', 'Settings'].map(perm => (
                                                                <button
                                                                    key={perm}
                                                                    onClick={() => handleTogglePermission(user.id, user.permissions, perm)}
                                                                    className={`text-[8px] px-1.5 py-0.5 border uppercase font-bold transition-all ${user.permissions.includes(perm)
                                                                        ? "bg-black text-white border-black"
                                                                        : "bg-neutral-50 text-neutral-300 border-neutral-100 hover:border-neutral-300"
                                                                        }`}
                                                                >
                                                                    {perm}
                                                                </button>
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
                                                    <div className="flex justify-end gap-2">
                                                        {user.role !== 'Superadmin' && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user)}
                                                                className="p-2 text-neutral-300 hover:text-red-600 transition-colors"
                                                                title="Purge User"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUserManagement(user);
                                                                setIsManagementModalOpen(true);
                                                                fetchWalletHistory(user.id);
                                                                fetchAuditLogs(user.email);
                                                                fetchComms(user.email, 1);
                                                            }}
                                                            className="p-2 text-neutral-300 hover:text-black transition-colors"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>
                                                    </div>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {[
                                { r: "Superadmin", d: "Absolute infrastructure & fiscal control." },
                                { r: "Admin", d: "High-level operations (Excl. Root deletion)." },
                                { r: "CTO", d: "Project integrity & Developer oversight." },
                                { r: "Operations", d: "HR, Personnel, & System management." },
                                { r: "Sales Officer", d: "Pipeline & Client relationship management." },
                                { r: "Devs", d: "Restricted to assigned project builds." },
                                { r: "Client", d: "Read-only access to own project metrics." },
                            ].map(role => (
                                <div key={role.r} className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{role.r}</p>
                                    <p className="text-xs text-neutral-200 font-light leading-tight">{role.d}</p>
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
                                            <option value="Superadmin">Superadmin (Root Access)</option>
                                            <option value="Admin">Admin (Oversight)</option>
                                            <option value="CTO">CTO (Tech Lead)</option>
                                            <option value="Operations Officer">Operations Officer (HR/Systems)</option>
                                            <option value="Sales Officer">Sales Officer (Pipeline)</option>
                                            <option value="Devs">Developer (Project Specific)</option>
                                            <option value="Client">Client (Portfolio Access)</option>
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

            {/* Account Management Console Modal */}
            <AnimatePresence>
                {isManagementModalOpen && selectedUserManagement && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-5xl h-[85vh] flex overflow-hidden shadow-2xl relative"
                        >
                            <button
                                onClick={() => setIsManagementModalOpen(false)}
                                className="absolute top-8 right-8 z-50 text-neutral-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>

                            {/* Sidebar - Quick Profile & Actions */}
                            <div className="w-80 bg-neutral-900 text-white p-10 flex flex-col overflow-y-auto shrink-0">
                                <div className="space-y-8">
                                    <header className="space-y-4">
                                        <div className="w-20 h-20 bg-white text-black flex items-center justify-center font-bold text-3xl rounded-sm">
                                            {selectedUserManagement.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-light italic tracking-tight leading-tight">{selectedUserManagement.name}</h3>
                                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono mt-1">{selectedUserManagement.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest ${selectedUserManagement.status === 'Active' ? 'bg-green-500' :
                                                selectedUserManagement.status === 'Suspended' ? 'bg-orange-500' :
                                                    selectedUserManagement.status === 'Banned' ? 'bg-red-500' : 'bg-neutral-500'
                                                } text-white`}>
                                                {selectedUserManagement.status}
                                            </span>
                                            {selectedUserManagement.status === 'Suspended' && (
                                                <span className="text-[8px] text-neutral-500 italic">
                                                    Until {new Date(selectedUserManagement.suspended_until!).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </header>

                                    <nav className="space-y-1">
                                        <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-600 mb-4">Security Enforcement</p>

                                        {selectedUserManagement.status === 'Active' ? (
                                            <>
                                                <div className="space-y-4 p-4 border border-white/5 bg-white/5">
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Suspend Access</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {['24h', '1w', '30d'].map((d) => (
                                                            <button
                                                                key={d}
                                                                onClick={() => handleSuspend(selectedUserManagement, d)}
                                                                className="py-2 border border-white/10 text-[9px] font-bold hover:bg-white hover:text-black transition-all"
                                                            >
                                                                {d.toUpperCase()}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleBan(selectedUserManagement)}
                                                    className="w-full flex items-center gap-3 p-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                                                >
                                                    <Ban size={14} /> Ban Permanent
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => handleReactivate(selectedUserManagement)}
                                                className="w-full flex items-center gap-3 p-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all shadow-lg"
                                            >
                                                <UserCheck size={14} /> Restore Access
                                            </button>
                                        )}

                                        {selectedUserManagement.role !== 'Superadmin' && (
                                            <button
                                                onClick={() => {
                                                    if (confirm("FINAL WARNING: Purging this identity will eradicate all associated records. Proceed?")) {
                                                        handleDeleteUser(selectedUserManagement);
                                                        setIsManagementModalOpen(false);
                                                    }
                                                }}
                                                className="w-full flex items-center gap-3 p-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500 hover:text-red-500 transition-all"
                                            >
                                                <Trash2 size={14} /> Purge Registry
                                            </button>
                                        )}
                                    </nav>
                                </div>

                                <div className="pt-8 border-t border-white/5">
                                    <div className="flex items-center gap-3 text-neutral-500">
                                        <Key size={14} />
                                        <span className="text-[9px] font-bold uppercase tracking-widest">{selectedUserManagement.role} Account</span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 flex flex-col bg-neutral-50">
                                {/* Tab Navigation */}
                                <div className="bg-white border-b border-neutral-100 flex px-10">
                                    {['Overview', 'Wallet', 'Security Logs', 'Communications'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setManagementTab(tab)}
                                            className={`px-6 py-6 text-[10px] font-bold uppercase tracking-[0.2em] relative transition-colors ${managementTab === tab ? 'text-black' : 'text-neutral-400 hover:text-black'}`}
                                        >
                                            {tab}
                                            {managementTab === tab && (
                                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Content Scrollable */}
                                <div className="flex-1 overflow-y-auto p-12 space-y-12">
                                    {managementTab === 'Overview' && (
                                        <section className="space-y-12">
                                            {/* Profile Grid */}
                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-3">
                                                        <FileText size={16} className="text-neutral-400" />
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Identity Metadata</h4>
                                                    </div>
                                                    <div className="space-y-4 bg-white border border-neutral-100 p-6">
                                                        <div className="flex justify-between border-b border-neutral-50 pb-2">
                                                            <span className="text-[9px] font-bold text-neutral-400 uppercase">Full Name</span>
                                                            <span className="text-[10px] font-bold">{selectedUserManagement.name}</span>
                                                        </div>
                                                        <div className="flex justify-between border-b border-neutral-50 pb-2">
                                                            <span className="text-[9px] font-bold text-neutral-400 uppercase">Registry Email</span>
                                                            <span className="text-[10px] font-bold">{selectedUserManagement.email}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-[9px] font-bold text-neutral-400 uppercase">Access Group</span>
                                                            <span className="text-[10px] font-bold">{selectedUserManagement.role}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="flex items-center gap-3">
                                                        <Shield size={16} className="text-neutral-400" />
                                                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Authorization Parameters</h4>
                                                    </div>
                                                    <div className="bg-white border border-neutral-100 p-6 space-y-4">
                                                        <select
                                                            value={selectedUserManagement.role}
                                                            onChange={(e) => handleUpdateRole(selectedUserManagement.id, e.target.value as AdminUser["role"])}
                                                            disabled={selectedUserManagement.email === 'projects@cortdevs.com'}
                                                            className="w-full bg-neutral-50 border border-neutral-100 p-3 text-sm font-bold outline-none focus:border-black disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="Superadmin">Superadmin</option>
                                                            <option value="Admin">Admin</option>
                                                            <option value="CTO">CTO</option>
                                                            <option value="Operations Officer">Operations Officer</option>
                                                            <option value="Sales Officer">Sales Officer</option>
                                                            <option value="Devs">Devs</option>
                                                            <option value="Client">Client</option>
                                                        </select>
                                                        <p className="text-[8px] text-neutral-400 font-mono leading-relaxed">
                                                            Modifying the authorization domain impacts the collective intelligence visibility and transaction permissions for this identity.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Commission Rate */}
                                            <div className="bg-white border border-neutral-100 p-10 flex justify-between items-center">
                                                <div className="space-y-1">
                                                    <h5 className="text-[10px] font-bold uppercase tracking-widest">Revenue Commission Model</h5>
                                                    <p className="text-[9px] text-neutral-400 font-mono italic">Primary model for Pipeline & Sales Officers.</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="relative group">
                                                        <div className="absolute -top-10 right-0 bg-neutral-900 text-white text-[8px] px-3 py-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl border border-white/10 uppercase tracking-widest">
                                                            Personnel revenue share per project unit.
                                                        </div>
                                                        <input
                                                            type="number"
                                                            defaultValue={selectedUserManagement.commission_rate}
                                                            onBlur={(e) => handleUpdateCommissionRate(selectedUserManagement.id, parseFloat(e.target.value) || 0)}
                                                            className="w-20 bg-neutral-50 border border-neutral-100 p-3 text-2xl font-light outline-none focus:border-black text-center"
                                                        />
                                                    </div>
                                                    <span className="text-2xl font-light text-neutral-300">%</span>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {managementTab === 'Wallet' && (
                                        <section className="space-y-12">
                                            <header className="flex justify-between items-end">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-black text-white rounded-sm">
                                                        <Wallet size={16} />
                                                    </div>
                                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Fiscal Reservoir</h4>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-neutral-400 uppercase font-bold tracking-widest mb-1">Available Liquidity</p>
                                                    <p className="text-4xl font-light italic">${selectedUserManagement.wallet_balance?.toLocaleString()}</p>
                                                </div>
                                            </header>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                                {/* Transaction Feed */}
                                                <div className="bg-white border border-neutral-200 p-8 space-y-6">
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                                                            <History size={12} /> Tactical History
                                                        </p>
                                                        <button className="text-[8px] font-bold uppercase tracking-widest text-neutral-300 hover:text-black underline">Export XLS</button>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {walletHistory.length === 0 ? (
                                                            <div className="py-12 flex flex-col items-center justify-center border border-dashed border-neutral-100 rounded-sm">
                                                                <Clock className="text-neutral-100 mb-2" size={32} />
                                                                <p className="text-[10px] text-neutral-300 italic">No historical disbursements found.</p>
                                                            </div>
                                                        ) : (
                                                            walletHistory.map(tx => (
                                                                <div key={tx.id} className="flex justify-between items-center text-[10px] border-b border-neutral-50 pb-4">
                                                                    <div className="space-y-1">
                                                                        <p className="font-bold text-black uppercase tracking-tight">{tx.description}</p>
                                                                        <p className="text-neutral-400 text-[9px]">{new Date(tx.created_at).toLocaleDateString()} @ {new Date(tx.created_at).toLocaleTimeString()}</p>
                                                                    </div>
                                                                    <div className="text-right space-y-1">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${tx.type === 'Credit' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                                            {tx.type.toUpperCase()}
                                                                        </span>
                                                                        <p className={`text-sm font-light ${tx.type === 'Credit' ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {tx.type === 'Credit' ? '+' : '-'}${tx.amount}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Inject Liquidity */}
                                                <div className="bg-neutral-900 text-white p-10 space-y-8 flex flex-col justify-center">
                                                    <div className="space-y-2">
                                                        <h5 className="text-xs font-bold uppercase tracking-[0.2em]">Manual Fund Injection</h5>
                                                        <p className="text-[9px] text-neutral-500 font-mono">This action will instantaneously update the user's available wallet balance.</p>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-600 ml-1">Transmission Amount (USD)</label>
                                                            <div className="relative">
                                                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                                                                <input
                                                                    type="number"
                                                                    value={disburseAmount}
                                                                    onChange={(e) => setDisburseAmount(e.target.value)}
                                                                    className="w-full bg-white/5 border border-white/10 p-4 pl-12 text-lg outline-none focus:border-white/30 transition-all font-mono"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-bold uppercase tracking-widest text-neutral-600 ml-1">Internal Ledger Memo</label>
                                                            <textarea
                                                                value={disburseDescription}
                                                                onChange={(e) => setDisburseDescription(e.target.value)}
                                                                className="w-full bg-white/5 border border-white/10 p-4 text-xs outline-none focus:border-white/30 h-28 resize-none font-mono"
                                                                placeholder="Operational Bonus / Project Commission Ref #..."
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => handleDisburse(selectedUserManagement)}
                                                            disabled={isProcessing || !disburseAmount}
                                                            className="w-full py-5 bg-white text-black text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-neutral-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                                        >
                                                            {isProcessing ? <RefreshCw className="animate-spin" size={14} /> : <ArrowUpRight size={14} />}
                                                            Execute Protocol
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {managementTab === 'Security Logs' && (
                                        <section className="space-y-8">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-neutral-900 text-white rounded-sm">
                                                    <Activity size={16} />
                                                </div>
                                                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Internal Intelligence Trace</h4>
                                            </div>

                                            <div className="bg-white border border-neutral-200">
                                                <div className="grid grid-cols-4 p-4 text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-400 bg-neutral-50 px-8">
                                                    <span>Action Code</span>
                                                    <span className="col-span-2">Technical Summary</span>
                                                    <span className="text-right">Timestamp</span>
                                                </div>
                                                <div className="divide-y divide-neutral-50">
                                                    {filteredAuditLogs.length > 0 ? (
                                                        filteredAuditLogs.map(log => (
                                                            <div key={log.id} className="grid grid-cols-4 p-5 px-8 items-center text-[10px] hover:bg-neutral-50 transition-colors">
                                                                <div className="flex items-center gap-2">
                                                                    {log.severity === 'High' && <AlertCircle size={10} className="text-red-500" />}
                                                                    <span className={`font-bold ${log.severity === 'High' ? 'text-red-600' : 'text-black'}`}>{log.action}</span>
                                                                </div>
                                                                <div className="col-span-2 text-neutral-500 font-mono text-[9px]">
                                                                    {JSON.stringify(log.details)}
                                                                </div>
                                                                <div className="text-right text-neutral-400">
                                                                    {new Date(log.created_at).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-12 text-center text-neutral-300 italic text-[10px]">
                                                            No security events found for this identity trace.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {managementTab === 'Communications' && (
                                        <section className="space-y-8">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-neutral-900 text-white rounded-sm">
                                                        <Mail size={16} />
                                                    </div>
                                                    <h4 className="text-[10px] font-bold uppercase tracking-[0.3em]">Communication Trace</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search logs..."
                                                            value={commsSearch}
                                                            onChange={(e) => {
                                                                setCommsSearch(e.target.value);
                                                                fetchComms(selectedUserManagement.email, 1, e.target.value);
                                                            }}
                                                            className="pl-8 pr-4 py-2 bg-white border border-neutral-200 text-[10px] outline-none focus:border-black w-48"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white border border-neutral-200 divide-y divide-neutral-50">
                                                {commsData.length > 0 ? (
                                                    commsData.map(msg => (
                                                        <div key={msg.id} className="p-6 space-y-3 hover:bg-neutral-50 transition-colors">
                                                            <div className="flex justify-between items-start">
                                                                <h5 className="text-[11px] font-bold text-black">{msg.subject}</h5>
                                                                <span className="text-[9px] text-neutral-400 font-mono">
                                                                    {new Date(msg.created_at).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] text-neutral-500 italic leading-relaxed line-clamp-2">
                                                                {msg.body.replace(/<[^>]*>?/gm, '')}
                                                            </p>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-20 text-center space-y-4">
                                                        <Mail className="mx-auto text-neutral-100" size={48} />
                                                        <p className="text-[10px] text-neutral-400 italic">No communication history detected.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {hasMoreComms && (
                                                <button
                                                    onClick={() => {
                                                        const nextPage = commsPage + 1;
                                                        setCommsPage(nextPage);
                                                        fetchComms(selectedUserManagement.email, nextPage, commsSearch);
                                                    }}
                                                    className="w-full py-4 border border-neutral-200 text-[9px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                                                >
                                                    Trace Older Communications
                                                </button>
                                            )}
                                        </section>
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
