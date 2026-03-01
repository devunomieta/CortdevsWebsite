import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../components/Toast";
import {
    Search, Filter, Mail, Send, Settings, History, Plus, X, ChevronRight,
    Search as SearchIcon, Users, UserCheck, MessageSquare, Clock, Shield,
    RefreshCw, Save, Copy, Eye, Trash2, ExternalLink, Filter as FilterIcon,
    AlertCircle, CheckCircle2, MoreHorizontal, User, Edit, ChevronLeft, Layout
} from "lucide-react";
import { RichTextEditor } from "../../components/RichTextEditor";

export function Communications() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<"smtp" | "newsletter" | "templates" | "mailbox">("mailbox");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true); // Renamed from isLoading

    // Form States
    const [smtp, setSmtp] = useState({
        host: "",
        port: 465,
        user: "",
        password: ""
    });

    const [templates, setTemplates] = useState<any[]>([]);
    const [newsletterList, setNewsletterList] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
    const [viewingMessage, setViewingMessage] = useState<any | null>(null);

    // New Compose Modal States
    const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
    const [composeData, setComposeData] = useState({
        to: "",
        subject: "",
        body: "",
        attachments: [] as File[],
        type: "Direct",
        recipients: [] as { id: string; email: string; type: string }[], // For multiple recipients
        segment: "All Subscribers" // For broadcast
    });
    const [isSendingCompose, setIsSendingCompose] = useState(false);

    // New Leads and Clients states
    const [leads, setLeads] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    // Pagination & Health
    const [currentPage, setCurrentPage] = useState(1);
    const [newsletterPage, setNewsletterPage] = useState(1);
    const itemsPerPage = 20;

    const [health, setHealth] = useState({
        mtdCount: 0,
        avgLatency: 24,
        successRate: 100
    });

    // Template Editor State
    const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    // Broadcast State (now integrated into compose modal)
    const [showBroadcastModal, setShowBroadcastModal] = useState(false); // Can be removed if broadcast is fully integrated into compose
    const [broadcastData, setBroadcastData] = useState({ // Can be removed if broadcast is fully integrated into compose
        subject: "",
        body: "",
        segment: "All Subscribers"
    });
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastProgress, setBroadcastProgress] = useState(0);

    const systemTemplates = [
        {
            id: "welcome",
            name: "Welcome New Subscriber",
            desc: "Automated greeting for new newsletter sign-ups.",
            subject: "Welcome to Our Community!",
            body: "Hello {{name}},\n\nThank you for subscribing to our newsletter! We're excited to have you join our community. Stay tuned for updates, exclusive content, and special offers.\n\nBest regards,\nThe Team",
            type: "System",
            placeholders: ["{{name}}"]
        },
        {
            id: "lead_followup",
            name: "Lead Follow-up",
            desc: "Follow-up email for new leads.",
            subject: "Following Up on Your Inquiry",
            body: "Dear {{name}},\n\nThank you for your interest in our services. We received your inquiry and would love to discuss how we can help you further. Please feel free to schedule a call at your convenience.\n\nSincerely,\n{{sender_name}}",
            type: "System",
            placeholders: ["{{name}}", "{{sender_name}}"]
        },
        {
            id: "client_onboarding",
            name: "Client Onboarding",
            desc: "Initial email for new clients.",
            subject: "Welcome Aboard! Your Journey Starts Now",
            body: "Hi {{client_name}},\n\nWelcome to the team! We're thrilled to have you as a client. This email contains important information to get you started. Please review the attached documents and let us know if you have any questions.\n\nLooking forward to a successful partnership,\n{{sender_name}}",
            type: "System",
            placeholders: ["{{client_name}}", "{{sender_name}}"]
        },
        {
            id: "project_proposal",
            name: "Project Proposal",
            desc: "Strategic pitch and scope definition for prospective projects.",
            subject: "Proposal: {{projectTitle}} - Cortdevs",
            body: "Hello {{clientName}},\n\nIt was a pleasure discussing your vision for {{projectTitle}}. Attached is a comprehensive proposal outlining our strategic approach, technical stack, and projected timeline.\n\nWe've tailored this specifically to address your core objectives. Let's build something exceptional.\n\nBest,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{senderName}}"]
        },
        {
            id: "budget_estimate",
            name: "Budgets & Estimates",
            desc: "Detailed financial breakdown for project phases.",
            subject: "Estimate: {{projectTitle}} Breakdown",
            body: "Hi {{clientName}},\n\nFollowing our proposal, here is the detailed budget breakdown for {{projectTitle}}. We've categorized the costs by phase to ensure full transparency.\n\nTotal Estimated Investment: {{totalBudget}}\n\nPlease let us know if you have any questions regarding the line items.\n\nCheers,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{totalBudget}}", "{{senderName}}"]
        },
        {
            id: "project_approval",
            name: "Project Approval",
            desc: "Formal acceptance with direct invoice triggering.",
            subject: "Approved: {{projectTitle}} - Next Steps",
            body: "Fantastic news, {{clientName}}!\n\nYour project, {{projectTitle}}, has been formally approved at the final budget of {{finalBudget}}.\n\nI've generated the initial deposit invoice below. Once payment is confirmed, we'll kick off the discovery phase immediately.\n\n[SEND INVOICE BUTTON]\n\nExcited to get started,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{finalBudget}}", "{{senderName}}"]
        },
        {
            id: "project_review",
            name: "Project Review / Milestone",
            desc: "Periodic progress report and feedback request.",
            subject: "Review Required: {{milestoneName}} - {{projectTitle}}",
            body: "Hello {{clientName}},\n\nWe've hit a key milestone: {{milestoneName}} for your project. Please review the current build at the link below and provide your feedback.\n\nYour input at this stage is critical to staying on trajectory.\n\nReview Link: {{reviewLink}}\n\nBest,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{milestoneName}}", "{{reviewLink}}", "{{senderName}}"]
        },
        {
            id: "project_completion",
            name: "Project Completion & Final Balance",
            desc: "End-of-project wrap-up and final payment request.",
            subject: "Mission Accomplished: {{projectTitle}} is Ready!",
            body: "Hi {{clientName}},\n\nWe're thrilled to announce that {{projectTitle}} is officially complete! It's been an incredible journey.\n\nWe noticed a pending balance of {{pendingBalance}} on your account. You can settle this using the secure link below to proceed with the final handover.\n\n[PAY BALANCE BUTTON]\n\nCongratulations on the launch,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{pendingBalance}}", "{{senderName}}"]
        },
        {
            id: "project_handover",
            name: "Project Handover & Review Request",
            desc: "Final delivery of assets and request for social proof.",
            subject: "Handover Assets: {{projectTitle}}",
            body: "Hello {{clientName}},\n\nHere are all the final assets and documentation for {{projectTitle}}. It's been a pleasure working with you.\n\nIf you enjoyed the experience, we'd love for you to leave a short review here: {{reviewLink}}. Your feedback helps us grow.\n\nStay in touch,\n{{senderName}}",
            type: "System",
            placeholders: ["{{clientName}}", "{{projectTitle}}", "{{reviewLink}}", "{{senderName}}"]
        },
        {
            id: "general_update",
            name: "General Audience Update",
            desc: "High-level update for subscribers and general contacts.",
            subject: "The Latest from Cortdevs: {{month}} Edition",
            body: "Hello friend,\n\nWe've been busy this month! Here are some of the most exciting projects we've launched and some tech insights we thought you'd love.\n\n{{updateContent}}\n\nAs always, thanks for being part of our journey.\n\nBest,\nThe Cortdevs Team",
            type: "General",
            placeholders: ["{{month}}", "{{updateContent}}"]
        }
    ];

    const fetchSMTP = async () => {
        try {
            const { data: smtpData } = await supabase
                .from('smtp_settings')
                .select('*')
                .eq('id', 'main')
                .single();
            if (smtpData) setSmtp({
                host: smtpData.host || "",
                port: smtpData.port || 465,
                user: smtpData.user || "",
                password: smtpData.password || ""
            });
        } catch (err) {
            console.error("Error fetching SMTP settings:", err);
        }
    };

    const fetchTemplates = async () => {
        try {
            const { data: tempData } = await supabase
                .from('email_templates')
                .select('*')
                .order('updated_at', { ascending: false });
            if (tempData) setTemplates(tempData);
        } catch (err) {
            console.error("Error fetching templates:", err);
        }
    };

    const fetchLogs = async () => {
        try {
            const { data: msgData } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });
            if (msgData) {
                setMessages(msgData);

                // Calculate Health
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const mtd = msgData.filter((m: any) => m.created_at >= startOfMonth).length;
                setHealth(prev => ({ ...prev, mtdCount: mtd }));
            }
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const [leadsRes, clientsRes, subsRes] = await Promise.all([
                supabase.from('leads').select('*').order('created_at', { ascending: false }),
                supabase.from('clients').select('*').order('created_at', { ascending: false }),
                supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false })
            ]);

            setLeads(leadsRes.data || []);
            setClients(clientsRes.data || []);
            setNewsletterList(subsRes.data || []);
        } catch (err) {
            console.error("Error fetching communication data:", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        fetchSMTP();
        fetchTemplates();
        fetchLogs();
        fetchData();
    }, []);

    const handleSaveTemplate = async () => {
        if (!editingTemplate.name || !editingTemplate.body) {
            showToast("Required fields missing", "warning");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('email_templates')
                .upsert({
                    id: editingTemplate.id || undefined,
                    name: editingTemplate.name,
                    subject: editingTemplate.subject || "",
                    body: editingTemplate.body,
                    type: editingTemplate.type || "Custom", // Changed default type to Custom
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;
            showToast("Template persisted to registry.", "success");
            setShowTemplateModal(false);
            setEditingTemplate(null);
            fetchTemplates(); // Refresh templates
        } catch (err: any) {
            showToast("Registry error: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm("Are you sure you want to decommission this template?")) return;

        try {
            const { error } = await supabase
                .from('email_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast("Template purged from registry", "success");
            fetchTemplates(); // Refresh templates
        } catch (err: any) {
            showToast("Deletion failed", "error");
        }
    };

    const [isTesting, setIsTesting] = useState(false);

    const handleSaveSmtp = async () => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('smtp_settings')
                .upsert({
                    id: 'main',
                    ...smtp,
                    updated_at: new Date().toISOString()
                });
            if (error) throw error;
            showToast("SMTP protocols updated successfully.", "success");
        } catch (err: any) {
            showToast("SMTP sync failed: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReply = (msg: any) => {
        setComposeData({
            to: msg.receiver_email,
            subject: `Re: ${msg.subject || 'Our Discussion'}`,
            body: `<br/><br/><hr/><blockquote>${msg.body}</blockquote>`,
            attachments: [],
            type: 'Admin Reply',
            recipients: [{ id: msg.receiver_email, email: msg.receiver_email, type: 'Direct' }],
            segment: "Direct"
        });
        setViewingMessage(null);
        setIsComposeModalOpen(true);
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

    const handleTestConnection = async () => {
        setIsTesting(true);
        try {
            const response = await fetch('/api/test-smtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(smtp)
            });
            const data = await response.json();
            if (data.success) {
                showToast("SMTP connectivity verified.", "success");
            } else {
                showToast(data.error || "Connection test failed.", "error");
            }
        } catch (err: any) {
            showToast("Network error: Check console for logs.", "error");
        } finally {
            setIsTesting(false);
        }
    };

    const sendComposeEmail = async () => {
        if (!composeData.subject || !composeData.body || (composeData.recipients.length === 0 && !composeData.to)) {
            showToast("Please fill in all required fields and select recipients.", "warning");
            return;
        }

        setIsSendingCompose(true);
        try {
            const uploadedFiles = [];
            for (const file of composeData.attachments) {
                const url = await uploadToSupabase(file, 'direct-emails');
                uploadedFiles.push({ name: file.name, url });
            }

            let recipientsToSend: { email: string; name?: string }[] = [];
            if (composeData.segment === "Direct" && composeData.to) {
                recipientsToSend.push({ email: composeData.to });
            } else if (composeData.segment === "Selected") {
                recipientsToSend = composeData.recipients.map(r => ({ email: r.email }));
            } else if (composeData.segment === "All Subscribers") {
                recipientsToSend = newsletterList.filter(s => s.status === 'Subscribed').map(s => ({ email: s.email }));
            } else if (composeData.segment === "All Leads") {
                recipientsToSend = leads.map(l => ({ email: l.email, name: l.name }));
            } else if (composeData.segment === "All Clients") {
                recipientsToSend = clients.map(c => ({ email: c.email, name: c.name }));
            }

            if (recipientsToSend.length === 0) {
                showToast("No recipients found for the selected segment.", "warning");
                setIsSendingCompose(false);
                return;
            }

            const totalRecipients = recipientsToSend.length;
            let successfulSends = 0;

            for (const recipient of recipientsToSend) {
                const personalizedBody = composeData.body.replace(/\{\{name\}\}/g, recipient.name || recipient.email.split('@')[0])
                    .replace(/\{\{client_name\}\}/g, recipient.name || recipient.email.split('@')[0])
                    .replace(/\{\{sender_name\}\}/g, "Admin"); // Example placeholder replacement

                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: recipient.email,
                        subject: composeData.subject,
                        body: personalizedBody,
                        attachments: uploadedFiles,
                        type: composeData.type
                    })
                });

                if (response.ok) {
                    successfulSends++;
                } else {
                    const errData = await response.json();
                    console.error(`Failed to send email to ${recipient.email}:`, errData.error);
                }
            }

            if (successfulSends > 0) {
                showToast(`Successfully sent ${successfulSends} of ${totalRecipients} emails.`, "success");
            } else {
                showToast("Failed to send any emails.", "error");
            }

            setIsComposeModalOpen(false);
            setComposeData({
                to: "", subject: "", body: "", attachments: [], type: "Direct", recipients: [], segment: "All Subscribers"
            });
            fetchLogs(); // Refresh logs
        } catch (err: any) {
            console.error("Error sending email:", err);
            showToast(err.message || "Failed to complete transmission", "error");
        } finally {
            setIsSendingCompose(false);
        }
    };

    const openCompose = (template?: any, isCustomTemplate: boolean = false) => {
        let initialBody = template?.body || "";
        let initialSubject = template?.subject || "";
        let initialType = template?.type || "Direct";

        if (isCustomTemplate) {
            initialType = "Custom Template";
        } else if (template && template.id === "welcome") {
            initialType = "Welcome Email";
        } else if (template && template.id === "lead_followup") {
            initialType = "Lead Follow-up";
        } else if (template && template.id === "client_onboarding") {
            initialType = "Client Onboarding";
        }

        setComposeData({
            to: "",
            subject: initialSubject,
            body: initialBody,
            attachments: [],
            type: initialType,
            recipients: [],
            segment: "All Subscribers"
        });
        setIsComposeModalOpen(true);
    };

    const totalPages = Math.ceil(messages.length / itemsPerPage);
    const paginatedMessages = messages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const allRecipients = [
        ...newsletterList.map(s => ({ id: s.id, email: s.email, type: 'Subscriber' })),
        ...leads.map(l => ({ id: l.id, email: l.email, type: 'Lead' })),
        ...clients.map(c => ({ id: c.id, email: c.email, type: 'Client' }))
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-light tracking-tight italic">Communications Hub</h2>
                    <p className="text-sm text-neutral-500">Manage SMTP protocols, outreach campaigns, and branding templates.</p>
                </div>
                <button
                    onClick={() => openCompose()}
                    className="px-6 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center gap-2"
                >
                    <Send size={14} /> New Compose
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 gap-8">
                {[
                    { id: "smtp", label: "SMTP Configuration", icon: <Settings size={14} /> },
                    { id: "newsletter", label: "Newsletter & Outreach", icon: <Users size={14} /> },
                    { id: "templates", label: "Mail Templates", icon: <Layout size={14} /> },
                    { id: "mailbox", label: "Mailbox", icon: <Mail size={14} /> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`pb-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all relative ${activeTab === tab.id ? "text-black" : "text-neutral-400 hover:text-black"
                            }`}
                    >
                        {tab.icon} {tab.label}
                        {activeTab === tab.id && (
                            <motion.div layoutId="tab-active" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-black" />
                        )}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-2 space-y-8">
                    {activeTab === "smtp" && (
                        <div className="bg-white border border-neutral-200 p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">SMTP Host</label>
                                    <input
                                        type="text"
                                        value={smtp.host}
                                        onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">SMTP Port</label>
                                    <input
                                        type="number"
                                        value={smtp.port}
                                        onChange={(e) => setSmtp({ ...smtp, port: parseInt(e.target.value) || 0 })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth User</label>
                                    <input
                                        type="text"
                                        value={smtp.user}
                                        onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Auth Password</label>
                                    <input
                                        type="password"
                                        value={smtp.password}
                                        onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                                        className="w-full text-xs font-mono p-4 border border-neutral-100 focus:border-black outline-none transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-neutral-50 flex justify-between items-center">
                                <button
                                    onClick={handleTestConnection}
                                    disabled={isTesting}
                                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-all disabled:opacity-50"
                                >
                                    {isTesting ? "Validating..." : "Test Connection"} <Clock size={14} className={isTesting ? "animate-spin" : ""} />
                                </button>
                                <button
                                    onClick={handleSaveSmtp}
                                    disabled={isSaving}
                                    className="bg-black text-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:bg-neutral-400"
                                >
                                    {isSaving ? "Saving..." : "Commit Config"}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === "newsletter" && (
                        <div className="bg-white border border-neutral-200 overflow-hidden">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest font-bold">Subscription Intelligence</h3>
                                <div className="flex gap-4">
                                    <button
                                        onClick={fetchData}
                                        disabled={isLoadingData}
                                        className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1"
                                    >
                                        <RefreshCw size={12} className={isLoadingData ? "animate-spin" : ""} />
                                    </button>
                                    <button className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black flex items-center gap-1">
                                        Export CSV <CheckCircle2 size={12} />
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-[300px]">
                                {isLoadingData ? (
                                    <div className="flex items-center justify-center py-20">
                                        <RefreshCw className="w-6 h-6 text-neutral-200 animate-spin" />
                                    </div>
                                ) : newsletterList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                                        <Users size={32} className="opacity-10 mb-2" />
                                        <p className="text-xs italic tracking-wide">No active subscribers in the network.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
                                                <th className="p-4 w-12 text-center">S/N</th>
                                                <th className="p-4">Email Address</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4 text-right">Incepted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {newsletterList.slice((newsletterPage - 1) * itemsPerPage, newsletterPage * itemsPerPage).map((item, i) => (
                                                <tr key={i} className="border-b border-neutral-50 group hover:bg-neutral-50 transition-all">
                                                    <td className="p-4 text-center text-neutral-400 font-mono text-[10px] font-bold">
                                                        {((newsletterPage - 1) * itemsPerPage) + i + 1}
                                                    </td>
                                                    <td className="p-4 font-medium">{item.email}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${item.status === 'Subscribed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right text-neutral-400">
                                                        {new Date(item.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {newsletterList.length > itemsPerPage && (
                                <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                    <p>Page {newsletterPage} of {Math.ceil(newsletterList.length / itemsPerPage)}</p>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={newsletterPage === 1}
                                            onClick={() => setNewsletterPage(prev => prev - 1)}
                                            className="p-2 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <button
                                            disabled={newsletterPage >= Math.ceil(newsletterList.length / itemsPerPage)}
                                            onClick={() => setNewsletterPage(prev => prev + 1)}
                                            className="p-2 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "templates" && (
                        <div className="space-y-12">
                            <section>
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h3 className="text-xl font-light italic">System Intelligence Templates</h3>
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">High-Conversion Communication Protocols</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {systemTemplates.map((template) => (
                                        <div key={template.id} className="bg-neutral-50 border border-neutral-100 p-6 flex flex-col justify-between group hover:border-black transition-all">
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-widest mb-2">{template.name}</p>
                                                <p className="text-[10px] text-neutral-400 leading-relaxed mb-4">{template.desc}</p>
                                                <div className="flex flex-wrap gap-1 mb-6">
                                                    {template.placeholders.map(p => (
                                                        <span key={p} className="px-2 py-0.5 bg-neutral-100 text-[9px] text-neutral-400 font-mono border border-neutral-200">
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => openCompose(template)}
                                                className="w-full py-3 bg-white border border-neutral-200 text-[10px] font-bold uppercase tracking-widest group-hover:bg-black group-hover:text-white transition-all shadow-sm"
                                            >
                                                Configure & Send
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h3 className="text-xl font-light italic">Custom Customizations</h3>
                                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Bespoke Registry Templates</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingTemplate({ name: "", subject: "", body: "" });
                                            setShowTemplateModal(true);
                                        }}
                                        className="px-6 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center gap-2"
                                    >
                                        <Plus size={14} /> New Protocol
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {templates.map((template) => (
                                        <div key={template.id} className="bg-white border border-neutral-200 p-6 flex flex-col justify-between hover:shadow-xl transition-all group">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-xs font-bold uppercase tracking-widest">{template.name}</p>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingTemplate(template); setShowTemplateModal(true); }} className="text-neutral-400 hover:text-black"><Edit size={12} /></button>
                                                        <button onClick={() => handleDeleteTemplate(template.id)} className="text-neutral-400 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-neutral-400 truncate mb-4">{template.subject}</p>
                                            </div>
                                            <button
                                                onClick={() => openCompose(template, true)}
                                                className="w-full py-3 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-all shadow-sm"
                                            >
                                                Send Template
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === "mailbox" && (
                        <div className="space-y-6 text-black">
                            <div className="bg-white border border-neutral-200 overflow-hidden">
                                <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Communication Logs</h3>
                                    <div className="flex gap-4">
                                        <span className="text-[9px] font-bold uppercase text-neutral-400">{messages.length} Messages Total</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-neutral-100 text-[9px] uppercase tracking-widest text-neutral-400 font-bold bg-white">
                                                <th className="p-4 w-12 text-center">S/N</th>
                                                <th className="p-4">Recipient</th>
                                                <th className="p-4">Subject</th>
                                                <th className="p-4">Category</th>
                                                <th className="p-4 text-right">Date Transmitted</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-xs">
                                            {messages.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-12 text-center text-neutral-400 italic">
                                                        No message history recorded yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedMessages.map((msg, idx) => (
                                                    <tr
                                                        key={msg.id}
                                                        onClick={() => setViewingMessage(msg)}
                                                        className={`border-b border-neutral-50 hover:bg-neutral-50 transition-all cursor-pointer ${selectedMessage?.id === msg.id ? 'bg-neutral-50' : ''}`}
                                                    >
                                                        <td className="p-4 text-center text-neutral-400 font-mono text-[10px] font-bold">
                                                            {((currentPage - 1) * itemsPerPage) + idx + 1}
                                                        </td>
                                                        <td className="p-4 font-medium">{msg.receiver_email}</td>
                                                        <td className="p-4">
                                                            <div className="max-w-[200px] truncate">{msg.subject || "(No Subject)"}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="px-2 py-0.5 bg-neutral-100 text-[9px] font-bold uppercase tracking-tight">
                                                                {msg.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right text-neutral-400 font-mono text-[10px]">
                                                            {new Date(msg.created_at).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                        <p>Page {currentPage} of {totalPages}</p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={currentPage === 1}
                                                onClick={() => setCurrentPage(prev => prev - 1)}
                                                className="p-2 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30"
                                            >
                                                <ChevronLeft size={14} />
                                            </button>
                                            <button
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(prev => prev + 1)}
                                                className="p-2 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <AnimatePresence>
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
                            </AnimatePresence>

                            {/* The following email modal code is no longer needed as handleReply now uses the main compose modal */}
                            {/* {isEmailModalOpen && (
                                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                        className="bg-white border border-neutral-200 shadow-2xl w-full max-w-lg overflow-hidden text-black"
                                    >
                                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                                            <div>
                                                <h3 className="text-lg font-light italic">Compose Response</h3>
                                                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">To: {emailTo}</p>
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
                            )} */}
                        </div>
                    )}
                </div>

                {/* Sidebar Controls */}
                <div className="space-y-8">
                    <div className="bg-neutral-900 text-white p-8 space-y-6 relative overflow-hidden">
                        <h3 className="text-xl font-light italic leading-tight">Mass Outreach<br />Engine</h3>
                        <p className="text-xs text-neutral-400 leading-relaxed uppercase tracking-widest">Broadcast dynamic communications to your entire intelligence network.</p>
                        <button
                            onClick={() => openCompose({ segment: "All Subscribers", type: "Broadcast" })} // Open compose modal with broadcast pre-selected
                            className="w-full py-4 bg-white text-black text-[10px] uppercase font-bold tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-neutral-100 transition-all"
                        >
                            Compose Broadcast <Send size={14} />
                        </button>
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    </div>

                    <div className="p-6 bg-white border border-neutral-200">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Transmission Health</h3>
                        <div className="space-y-4 text-black">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-500">SMTP Response</span>
                                <span className="text-green-600 font-bold">{health.avgLatency}ms</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-500">Mails Sent (MTD)</span>
                                <span className="font-bold font-mono">{health.mtdCount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-neutral-500">Success Rate</span>
                                <span className="text-blue-600 font-bold">{health.successRate}%</span>
                            </div>
                            <div className="w-full h-1 bg-neutral-100">
                                <div className="h-full bg-black transition-all duration-1000" style={{ width: `${health.successRate}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compose & Outreach Modal */}
            <AnimatePresence>
                {isComposeModalOpen && (
                    <div className="fixed inset-0 z-[202] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            className="bg-white w-full max-w-5xl h-[90vh] flex flex-col relative overflow-hidden text-black shadow-3xl"
                        >
                            <button
                                onClick={() => setIsComposeModalOpen(false)}
                                className="absolute top-6 right-6 text-neutral-400 hover:text-black transition-colors z-10"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex flex-1 overflow-hidden">
                                {/* Left Side: Configuration */}
                                <div className="w-1/3 border-r border-neutral-100 p-8 overflow-y-auto space-y-8 bg-neutral-50/50">
                                    <header>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Transmission Config</p>
                                        <h3 className="text-2xl font-light italic tracking-tight">Outreach Engine</h3>
                                    </header>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Target Segment</label>
                                            <select
                                                value={composeData.segment}
                                                onChange={(e) => setComposeData({ ...composeData, segment: e.target.value })}
                                                className="w-full bg-white border border-neutral-200 p-3 text-sm focus:outline-none focus:border-black transition-all"
                                            >
                                                <option value="Direct">Single Node (Direct)</option>
                                                <option value="All Subscribers">All Subscribers ({newsletterList.filter(s => s.status === 'Subscribed').length})</option>
                                                <option value="New Leads">New Leads Only ({leads.filter(l => l.status === 'New').length})</option>
                                                <option value="Active Projects">In-Progress Projects ({clients.filter(c => c.status === 'In Progress').length})</option>
                                                <option value="Completed Projects">Past / Completed Projects ({clients.filter(c => c.status === 'Completed').length})</option>
                                                <option value="All Clients">Broad Client Base ({clients.length})</option>
                                                <option value="Selected">Manual Node Selection</option>
                                            </select>
                                        </div>

                                        {composeData.segment === "Direct" && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Target Address</label>
                                                <input
                                                    type="email"
                                                    value={composeData.to}
                                                    onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                                    className="w-full bg-white border border-neutral-200 p-3 text-sm focus:outline-none focus:border-black transition-all font-mono"
                                                    placeholder="node@cortdevs.com"
                                                />
                                            </div>
                                        )}

                                        {composeData.segment === "Selected" && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Select Nodes ({composeData.recipients.length})</label>
                                                <div className="max-h-64 overflow-y-auto border border-neutral-200 bg-white">
                                                    {allRecipients.map(r => (
                                                        <label key={r.id} className="flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer border-b border-neutral-50 last:border-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={composeData.recipients.some(selected => selected.id === r.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setComposeData({ ...composeData, recipients: [...composeData.recipients, r] });
                                                                    } else {
                                                                        setComposeData({ ...composeData, recipients: composeData.recipients.filter(selected => selected.id !== r.id) });
                                                                    }
                                                                }}
                                                                className="rounded border-neutral-300 focus:ring-black"
                                                            />
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-[10px] font-bold truncate">{r.email}</p>
                                                                <p className="text-[8px] uppercase tracking-widest text-neutral-400">{r.type}</p>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-6 border-t border-neutral-200">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4">Transmission Type</p>
                                            <div className="flex flex-wrap gap-2">
                                                {["Direct", "Promotion", "Update", "Protocol", "Custom", "Broadcast"].map(t => (
                                                    <button
                                                        key={t}
                                                        onClick={() => setComposeData({ ...composeData, type: t })}
                                                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border transition-all ${composeData.type === t ? 'bg-black text-white border-black' : 'bg-white text-neutral-400 border-neutral-200'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Composer */}
                                <div className="flex-1 p-12 flex flex-col space-y-8 bg-white overflow-y-auto">
                                    <div className="space-y-6 flex-1">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Subject Line</label>
                                            <input
                                                type="text"
                                                value={composeData.subject}
                                                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                                className="w-full text-xl font-light italic border-b border-neutral-100 py-2 focus:outline-none focus:border-black transition-all bg-transparent"
                                                placeholder="Enter mission-critical subject..."
                                            />
                                        </div>

                                        <div className="space-y-2 flex-1 min-h-[400px]">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 block mb-4">Content Payload (Personalization Enabled)</label>
                                            <RichTextEditor
                                                value={composeData.body}
                                                onChange={(html: string) => setComposeData({ ...composeData, body: html })}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-8 border-t border-neutral-100">
                                        <div className="flex items-center gap-4">
                                            <div className="flex -space-x-2">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[8px] font-bold">
                                                        {i}
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
                                                {composeData.segment === "All Subscribers" ? newsletterList.length : (composeData.segment === "Selected" ? composeData.recipients.length : 1)} Target Nodes Identified
                                            </p>
                                        </div>

                                        <button
                                            onClick={sendComposeEmail}
                                            disabled={isSendingCompose}
                                            className="bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-xl"
                                        >
                                            {isSendingCompose ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                                            Execute Transmission
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Template Editor Modal */}
            <AnimatePresence>
                {showTemplateModal && editingTemplate && (
                    <div className="fixed inset-0 z-[203] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="bg-white w-full max-w-4xl p-10 relative overflow-hidden text-black shadow-2xl"
                        >
                            <button
                                onClick={() => setShowTemplateModal(false)}
                                className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="space-y-8">
                                <header>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Template Registry</p>
                                    <h3 className="text-3xl font-light italic tracking-tight">Template Composer</h3>
                                </header>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Template Name</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.name}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                            className="w-full bg-neutral-50 border border-neutral-100 p-3 text-sm focus:outline-none focus:border-black transition-all"
                                            placeholder="e.g. Project Onboarding"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Subject Line</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.subject}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                                            className="w-full bg-neutral-50 border border-neutral-100 p-3 text-sm focus:outline-none focus:border-black transition-all"
                                            placeholder="Subject for this template..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Payload Structure (HTML/Text)</label>
                                    <RichTextEditor
                                        value={editingTemplate.body}
                                        onChange={(html: string) => setEditingTemplate({ ...editingTemplate, body: html })}
                                    />
                                </div>

                                <div className="flex justify-end pt-4 border-t border-neutral-100">
                                    <button
                                        disabled={isSaving}
                                        onClick={handleSaveTemplate}
                                        className="bg-black text-white px-8 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                        Commit to Registry
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
