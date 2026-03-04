import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    Globe,
    Image as ImageIcon,
    Save,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Database,
    Trash2,
    Zap,
    Lock,
    Unlock,
    ShieldAlert as ShieldIcon,
    CreditCard as CommerceIcon,
    Settings2,
    X
} from "lucide-react";
import { useConfig, BrandingConfig } from "../../context/ConfigContext";
import { supabase } from "../../../lib/supabase";
import { useToast } from "../../components/Toast";
import { useRef, useEffect } from "react";
import { ServerErrors } from "./ServerErrors";

export function Settings() {
    const { showToast } = useToast();
    const { config, updateConfig, getAbstractUrl } = useConfig();
    const [formData, setFormData] = useState(config);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const headerLogoRef = useRef<HTMLInputElement>(null);
    const footerLogoRef = useRef<HTMLInputElement>(null);
    const faviconRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<"branding" | "intelligence" | "meta" | "records" | "commerce">("branding");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [unlockPassword, setUnlockPassword] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const { setMaintenanceMode: toggleMaintenance } = useConfig();
    const [gateways, setGateways] = useState<any[]>([]);
    const [isGatewaysLoading, setIsGatewaysLoading] = useState(false);
    const [editingGateway, setEditingGateway] = useState<any | null>(null);
    const [gatewayConfig, setGatewayConfig] = useState<any>({});

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "headerLogo" | "footerLogo" | "favicon") => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${field}-${Math.random()}.${fileExt}`;
            const filePath = `branding/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath);

            setFormData((prev: BrandingConfig) => ({ ...prev, [field]: publicUrl }));
        } catch (error: any) {
            console.error(`Error uploading ${field}:`, error);
            showToast(`Upload failed: ${error.message}`, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus("idle");

        try {
            await updateConfig(formData);
            setSaveStatus("success");
            showToast("System configuration synchronized.", "success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (error: any) {
            setSaveStatus("error");
            showToast("Serialization failed: " + (error.message || "Unknown error"), "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: BrandingConfig) => ({ ...prev, [name]: value }));
    };

    const handleUnlock = async () => {
        setIsVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Unauthenticated");

            const response = await fetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, password: unlockPassword })
            });

            const result = await response.json();
            if (result.success) {
                setIsUnlocked(true);
                showToast("Access Authorized. High-level controls unlocked.", "success");
            } else {
                throw new Error(result.error || "Verification failed");
            }
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsVerifying(false);
        }
    };

    const fetchGateways = async () => {
        setIsGatewaysLoading(true);
        const { data } = await supabase.from('payment_gateways').select('*').order('name');
        if (data) setGateways(data);
        setIsGatewaysLoading(false);
    };

    useEffect(() => {
        fetchGateways();
    }, []);

    const handleToggleGateway = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('payment_gateways')
                .update({ is_enabled: !currentStatus })
                .eq('id', id);

            if (error) throw error;
            showToast("Commerce gateway status synchronized.", "success");
            fetchGateways();
        } catch (error: any) {
            showToast(error.message, "error");
        }
    };

    const handleOpenGatewayConfig = (gw: any) => {
        setEditingGateway(gw);
        setGatewayConfig(gw.config || {});
    };

    const handleSaveGatewayConfig = async () => {
        if (!editingGateway) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('payment_gateways')
                .update({ config: gatewayConfig })
                .eq('id', editingGateway.id);

            if (error) throw error;
            showToast(`${editingGateway.name} configuration secured.`, "success");
            setEditingGateway(null);
            fetchGateways();
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearSystemData = async (target: string) => {
        if (!confirm(`CRITICAL: You are about to PERMANENTLY delete all ${target}. This action cannot be undone. Proceed?`)) return;

        setIsSaving(true);
        try {
            const response = await fetch('/api/admin/manage-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: `clear_${target.toLowerCase().replace(/ /g, '_')}` })
            });
            const result = await response.json();
            if (result.success) {
                showToast(`System purged: All ${target} removed.`, "success");
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: "branding", label: "Platform Branding", icon: <ImageIcon size={14} /> },
        { id: "intelligence", label: "Operational Intelligence", icon: <AlertCircle size={14} /> },
        { id: "commerce", label: "Global Commerce", icon: <CommerceIcon size={14} /> },
        { id: "meta", label: "Search Engine Meta", icon: <Globe size={14} /> },
        { id: "records", label: "Manage Records", icon: <Database size={14} /> },
    ];

    return (
        <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-2xl font-light tracking-tight text-neutral-900 italic">Site Intelligence & Settings</h2>
                    <p className="text-sm text-neutral-500 mt-1">Orchestrate your sitewide identity and monitor system health.</p>
                </div>

                <AnimatePresence>
                    {saveStatus === "success" && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 border border-green-100 text-xs font-bold uppercase tracking-widest"
                        >
                            <CheckCircle2 size={14} /> System Synchronized
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Premium Tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1.5 border border-neutral-200 w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-6 py-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative ${activeTab === tab.id ? "text-white" : "text-neutral-500 hover:text-black"
                            }`}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            {tab.icon} {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="active-tab"
                                className="absolute inset-0 bg-black"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                    </button>
                ))}
            </div>

            <div className="relative pt-4">
                <AnimatePresence mode="wait">
                    {activeTab === "branding" && (
                        <motion.div
                            key="branding"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="bg-white border border-neutral-200">
                                <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                                    <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Platform Components</h3>
                                </div>
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {/* Header Logo */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Header Logo (Dark Theme)</label>
                                        <div className="flex flex-col gap-4">
                                            <div
                                                onClick={() => headerLogoRef.current?.click()}
                                                className="h-32 w-full bg-neutral-100 border border-neutral-200 flex items-center justify-center relative group overflow-hidden"
                                            >
                                                {formData.headerLogo ? (
                                                    <img
                                                        src={formData.headerLogo}
                                                        alt="Header Logo"
                                                        className="max-h-16 object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/200x80/f5f5f5/a3a3a3?text=Logo+Missing';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="text-neutral-300 flex flex-col items-center gap-2">
                                                        <ImageIcon size={24} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">No Logo Assigned</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                    {isSaving ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload size={24} className="text-white" />}
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={headerLogoRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, "headerLogo")}
                                                />
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={getAbstractUrl(formData.headerLogo)}
                                                    className="w-full text-[10px] font-mono p-3 bg-neutral-50 border border-neutral-200 outline-none transition-all text-neutral-400 cursor-not-allowed"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-widest text-neutral-300">Abstract Path</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Logo */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Footer Logo (Light Theme)</label>
                                        <div className="flex flex-col gap-4">
                                            <div
                                                onClick={() => footerLogoRef.current?.click()}
                                                className="h-32 w-full bg-neutral-900 flex items-center justify-center relative group overflow-hidden"
                                            >
                                                {formData.footerLogo ? (
                                                    <img
                                                        src={formData.footerLogo}
                                                        alt="Footer Logo"
                                                        className="max-h-16 object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/200x80/171717/404040?text=Logo+Missing';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="text-neutral-700 flex flex-col items-center gap-2">
                                                        <ImageIcon size={24} />
                                                        <span className="text-[10px] font-bold uppercase tracking-widest">No Logo Assigned</span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                                    {isSaving ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload size={24} className="text-white" />}
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={footerLogoRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, "footerLogo")}
                                                />
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={getAbstractUrl(formData.footerLogo)}
                                                    className="w-full text-[10px] font-mono p-3 bg-neutral-50 border border-neutral-200 outline-none transition-all text-neutral-400 cursor-not-allowed"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-widest text-neutral-300">Abstract Path</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="bg-black text-white px-10 py-5 text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-neutral-800 transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Synchronizing..." : "Commit Branding"}
                                <Save size={16} />
                            </button>
                        </motion.div>
                    )}

                    {activeTab === "intelligence" && (
                        <motion.div
                            key="intelligence"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="bg-white border border-neutral-200">
                                <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                                    <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Anomaly Surveillance</h3>
                                </div>
                                <div className="p-0">
                                    <ServerErrors />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "commerce" && (
                        <motion.div
                            key="commerce"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="bg-white border border-neutral-200 p-8 space-y-8">
                                <header className="space-y-1">
                                    <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Settlement Gateways</h3>
                                    <p className="text-xs text-neutral-400">Enable or disable global payment providers for the Client Portal.</p>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {isGatewaysLoading ? (
                                        <div className="col-span-full py-20 flex justify-center">
                                            <Loader2 size={32} className="animate-spin text-neutral-200" />
                                        </div>
                                    ) : (
                                        gateways.map(gw => (
                                            <div key={gw.id} className="p-6 bg-neutral-50 border border-neutral-100 space-y-6 flex flex-col justify-between group">
                                                <div className="space-y-4">
                                                    <div className="w-12 h-12 bg-white border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:text-black transition-colors">
                                                        {gw.id === 'bank_transfer' ? <Database size={24} /> : <CommerceIcon size={24} />}
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h4 className="text-[10px] font-bold uppercase tracking-widest">{gw.name}</h4>
                                                        <p className="text-[9px] text-neutral-400 uppercase italic">
                                                            {gw.id === 'bank_transfer' ? 'Local Settlement' : 'Digital Gateway'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleToggleGateway(gw.id, gw.is_enabled)}
                                                        className={`flex-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all ${gw.is_enabled
                                                            ? "bg-black text-white"
                                                            : "bg-white text-neutral-300 border border-neutral-100 hover:border-black hover:text-black"
                                                            }`}
                                                    >
                                                        {gw.is_enabled ? "Deactivate" : "Activate"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenGatewayConfig(gw)}
                                                        className="px-4 py-3 bg-neutral-100 border border-neutral-200 text-neutral-600 hover:bg-black hover:text-white transition-all group"
                                                        title="Configure"
                                                    >
                                                        <Settings2 size={14} className="group-hover:rotate-90 transition-transform duration-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Gateway Configuration Modal */}
                            <AnimatePresence>
                                {editingGateway && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-white border border-neutral-200 w-full max-w-lg p-6 md:p-10 relative shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar"
                                        >
                                            <button
                                                onClick={() => setEditingGateway(null)}
                                                className="absolute top-4 right-4 md:top-8 md:right-8 text-neutral-400 hover:text-black z-50"
                                            >
                                                <X size={20} />
                                            </button>
                                            <header className="mb-8">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Gateway Intelligence</p>
                                                <h3 className="text-3xl font-light italic text-black">Configure {editingGateway.name}</h3>
                                            </header>

                                            <div className="space-y-6">
                                                {editingGateway.id === 'bank_transfer' ? (
                                                    <>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Bank Name</label>
                                                            <input
                                                                type="text"
                                                                value={gatewayConfig.bankName || ""}
                                                                onChange={(e) => setGatewayConfig({ ...gatewayConfig, bankName: e.target.value })}
                                                                className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                                                placeholder="e.g. Zenith Bank"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Account Name</label>
                                                            <input
                                                                type="text"
                                                                value={gatewayConfig.accountName || ""}
                                                                onChange={(e) => setGatewayConfig({ ...gatewayConfig, accountName: e.target.value })}
                                                                className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                                                                placeholder="e.g. CortDevs Creative Studio"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Account Number</label>
                                                            <input
                                                                type="text"
                                                                value={gatewayConfig.accountNumber || ""}
                                                                onChange={(e) => setGatewayConfig({ ...gatewayConfig, accountNumber: e.target.value })}
                                                                className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm font-mono"
                                                                placeholder="0123456789"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Instructions</label>
                                                            <textarea
                                                                value={gatewayConfig.instructions || ""}
                                                                onChange={(e) => setGatewayConfig({ ...gatewayConfig, instructions: e.target.value })}
                                                                className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-xs resize-none h-24 italic"
                                                                placeholder="e.g. Please upload receipt after transfer for immediate confirmation."
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Public Key / Client ID</label>
                                                            <input
                                                                type="text"
                                                                value={gatewayConfig.publicKey || ""}
                                                                onChange={(e) => setGatewayConfig({ ...gatewayConfig, publicKey: e.target.value })}
                                                                className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-xs font-mono"
                                                                placeholder="pk_test_..."
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Secret Key / Secret ID</label>
                                                            <div className="relative">
                                                                <input
                                                                    type="password"
                                                                    value={gatewayConfig.secretKey || ""}
                                                                    onChange={(e) => setGatewayConfig({ ...gatewayConfig, secretKey: e.target.value })}
                                                                    className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-xs font-mono pr-12"
                                                                    placeholder="sk_test_..."
                                                                />
                                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300">
                                                                    <Lock size={14} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-neutral-50 border border-neutral-100">
                                                            <p className="text-[9px] text-neutral-400 uppercase tracking-widest leading-relaxed italic">
                                                                Keys are encrypted at rest and transmitted over secure SSL/TLS.
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <button
                                                onClick={handleSaveGatewayConfig}
                                                disabled={isSaving}
                                                className="w-full mt-10 bg-black text-white py-5 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-neutral-800 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                                Secure Configuration
                                            </button>
                                        </motion.div>
                                    </div>
                                )}
                            </AnimatePresence>

                            <div className="bg-neutral-900 text-white p-10 relative overflow-hidden">
                                <header className="space-y-2 relative z-10">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Treasury Compliance</p>
                                    <h3 className="text-2xl font-light italic">Automatic Wallet Provisioning</h3>
                                    <p className="text-xs text-neutral-400 max-w-lg leading-relaxed">
                                        All project settlements received via these gateways are automatically tracked in the
                                        <strong> Central Treasury</strong> and reflected in the specific project dossiers.
                                    </p>
                                </header>
                                <div className="absolute top-0 right-0 p-10 opacity-5">
                                    <ShieldIcon size={160} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "meta" && (
                        <motion.div
                            key="meta"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="bg-white border border-neutral-200">
                                <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                                    <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Search Engine Architecture</h3>
                                </div>
                                <div className="p-8 space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Global Site Title</label>
                                        <input
                                            type="text"
                                            name="siteTitle"
                                            value={formData.siteTitle}
                                            onChange={handleChange}
                                            className="w-full text-lg font-light p-4 border border-neutral-200 focus:border-black outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Favicon</label>
                                        <div className="flex items-center gap-6">
                                            <div
                                                onClick={() => faviconRef.current?.click()}
                                                className="h-16 w-16 bg-neutral-50 border border-neutral-200 flex items-center justify-center relative group overflow-hidden cursor-pointer"
                                            >
                                                {formData.favicon ? (
                                                    <img
                                                        src={formData.favicon}
                                                        alt="Favicon"
                                                        className="w-8 h-8 object-contain"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/32x32/f5f5f5/a3a3a3?text=F';
                                                        }}
                                                    />
                                                ) : (
                                                    <Globe size={24} className="text-neutral-300" />
                                                )}
                                                <div className="absolute inset-0 bg-neutral-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Upload size={16} className="text-white" />
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={faviconRef}
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e, "favicon")}
                                                />
                                            </div>
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={getAbstractUrl(formData.favicon)}
                                                    className="w-full text-[10px] font-mono p-4 bg-neutral-50 border border-neutral-200 outline-none transition-all text-neutral-400 cursor-not-allowed"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-widest text-neutral-300">Abstract Path</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Global Meta Description</label>
                                        <textarea
                                            name="metaDescription"
                                            value={formData.metaDescription}
                                            onChange={handleChange}
                                            rows={6}
                                            className="w-full text-sm font-light leading-relaxed p-4 border border-neutral-200 focus:border-black outline-none transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={isSaving}
                                className="bg-black text-white px-10 py-5 text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-neutral-800 transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Synchronizing..." : "Commit Meta Data"}
                                <Save size={16} />
                            </button>
                        </motion.div>
                    )}

                    {activeTab === "records" && (
                        <motion.div
                            key="records"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <AnimatePresence mode="wait">
                                {!isUnlocked ? (
                                    <motion.div
                                        key="lock"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="bg-black text-white p-12 flex flex-col items-center justify-center text-center space-y-8"
                                    >
                                        <div className="w-16 h-16 bg-white/5 border border-white/10 flex items-center justify-center rounded-full">
                                            <Lock size={24} className="text-white opacity-40" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-xl font-light italic">Security Clearance Required</h3>
                                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Manage Records requires Super Admin Authorization</p>
                                        </div>
                                        <div className="max-w-xs w-full space-y-4">
                                            <input
                                                type="password"
                                                value={unlockPassword}
                                                onChange={(e) => setUnlockPassword(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                                placeholder="ENTER SECURITY KEY"
                                                className="w-full bg-white/5 border border-white/10 p-4 text-center text-sm outline-none focus:border-white transition-all font-mono"
                                            />
                                            <button
                                                onClick={handleUnlock}
                                                disabled={isVerifying || !unlockPassword}
                                                className="w-full py-4 bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-neutral-200 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                            >
                                                {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                                                Verify Clearance
                                            </button>
                                        </div>
                                        <p className="text-[9px] text-neutral-600 uppercase tracking-widest italic leading-relaxed">
                                            Actions within this domain are irreversible. <br />
                                            Operation will be recorded in the security audit trail.
                                        </p>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="unlocked"
                                        className="space-y-8"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Maintenance Mode */}
                                            <div className="bg-white border border-neutral-200 p-8 space-y-6">
                                                <div className="flex items-center gap-3 text-amber-600">
                                                    <ShieldIcon size={18} />
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Global Maintenance Protocol</h3>
                                                </div>
                                                <p className="text-sm text-neutral-500 font-light italic leading-relaxed">
                                                    Taking the platform offline will redirect all public traffic to the maintenance sector.
                                                </p>
                                                <div className="flex items-center justify-between p-4 bg-neutral-50 border border-neutral-100">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Maintenance Mode</span>
                                                    <button
                                                        onClick={() => {
                                                            const newState = !config.maintenanceMode;
                                                            toggleMaintenance(newState);
                                                            showToast(newState ? "Global Maintenance Protocol Activated." : "Platform Visibility Restored.", "success");
                                                        }}
                                                        className={`w-14 h-7 rounded-full relative transition-all duration-500 ${config.maintenanceMode ? 'bg-amber-500' : 'bg-neutral-200'}`}
                                                    >
                                                        <div className={`absolute top-1 w-5 h-5 bg-white shadow-md transition-all duration-500 ${config.maintenanceMode ? 'left-8' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* System Cache */}
                                            <div className="bg-white border border-neutral-200 p-8 space-y-6">
                                                <div className="flex items-center gap-3 text-blue-600">
                                                    <Zap size={18} />
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest">Context Synchronization</h3>
                                                </div>
                                                <p className="text-sm text-neutral-500 font-light italic leading-relaxed">
                                                    Clearing the system cache will reset local session intelligence and temporary data.
                                                </p>
                                                <button
                                                    onClick={() => {
                                                        localStorage.clear();
                                                        sessionStorage.clear();
                                                        window.location.reload();
                                                    }}
                                                    className="w-full py-4 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3"
                                                >
                                                    Flush System Cache <Zap size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Data Destruction Suite */}
                                        <div className="bg-neutral-900 p-10 space-y-8">
                                            <div className="space-y-2">
                                                <h4 className="text-white text-lg font-light italic">Data Destruction Suite</h4>
                                                <div className="h-px bg-white/10 w-full" />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-4 p-6 border border-white/5 bg-white/5 hover:border-red-500/50 transition-all group">
                                                    <h5 className="text-white text-[10px] uppercase font-bold tracking-widest flex items-center justify-between">
                                                        Leads & Projects Intelligence
                                                        <Trash2 size={12} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
                                                    </h5>
                                                    <p className="text-[11px] text-neutral-500 font-light leading-relaxed">Delete all Lead inquiries and manually onboarded project data.</p>
                                                    <button
                                                        onClick={() => handleClearSystemData("Leads and Projects")}
                                                        className="w-full py-3 bg-white/5 text-white text-[9px] uppercase font-bold tracking-widest hover:bg-red-600 transition-all"
                                                    >
                                                        Purge Intelligence
                                                    </button>
                                                </div>

                                                <div className="space-y-4 p-6 border border-white/5 bg-white/5 hover:border-red-500/50 transition-all group">
                                                    <h5 className="text-white text-[10px] uppercase font-bold tracking-widest flex items-center justify-between">
                                                        Client Access Data
                                                        <Trash2 size={12} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
                                                    </h5>
                                                    <p className="text-[11px] text-neutral-500 font-light leading-relaxed">Delete all client profiles, project assignments, and payment history.</p>
                                                    <button
                                                        onClick={() => handleClearSystemData("Clients Data")}
                                                        className="w-full py-3 bg-white/5 text-white text-[9px] uppercase font-bold tracking-widest hover:bg-red-600 transition-all"
                                                    >
                                                        Purge Client Base
                                                    </button>
                                                </div>

                                                <div className="space-y-4 p-6 border border-white/5 bg-white/5 hover:border-red-500/50 transition-all group">
                                                    <h5 className="text-white text-[10px] uppercase font-bold tracking-widest flex items-center justify-between">
                                                        Financial Ledger
                                                        <Trash2 size={12} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
                                                    </h5>
                                                    <p className="text-[11px] text-neutral-500 font-light leading-relaxed">Delete all income and expense records across the platform.</p>
                                                    <button
                                                        onClick={() => handleClearSystemData("Transaction Data")}
                                                        className="w-full py-3 bg-white/5 text-white text-[9px] uppercase font-bold tracking-widest hover:bg-red-600 transition-all"
                                                    >
                                                        Purge Ledger
                                                    </button>
                                                </div>

                                                <div className="space-y-4 p-6 border border-white/5 bg-white/5 hover:border-red-500/50 transition-all group">
                                                    <h5 className="text-white text-[10px] uppercase font-bold tracking-widest flex items-center justify-between">
                                                        Analytics Reports
                                                        <Trash2 size={12} className="text-neutral-600 group-hover:text-red-500 transition-colors" />
                                                    </h5>
                                                    <p className="text-[11px] text-neutral-500 font-light leading-relaxed">Clear all accumulated session data and analytics intelligence.</p>
                                                    <button
                                                        onClick={() => handleClearSystemData("Analytics Report")}
                                                        className="w-full py-3 bg-white/5 text-white text-[9px] uppercase font-bold tracking-widest hover:bg-red-600 transition-all"
                                                    >
                                                        Purge Analytics
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-amber-500 bg-amber-500/10 p-4 border border-amber-500/20">
                                                <ShieldIcon size={24} className="shrink-0" />
                                                <p className="text-[10px] italic leading-relaxed">
                                                    CRITICAL WARNING: These control mechanisms bypassing standard safety protocols. <br />
                                                    Execution will trigger a permanent erasure event in the centralized database.
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
