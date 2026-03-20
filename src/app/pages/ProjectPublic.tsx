import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import {
    Search,
    Rocket,
    Clock,
    CheckCircle2,
    CreditCard,
    Shield,
    RefreshCw,
    Mail,
    ArrowRight,
    Layers,
    ChevronDown,
    Upload,
    FileText,
    ExternalLink,
    AlertCircle,
    Globe,
    Landmark,
    Banknote
} from "lucide-react";
import { PaystackButton } from "react-paystack";
import { useToast } from "../components/Toast";

export function ProjectPublic() {
    const [email, setEmail] = useState("");
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [gateways, setGateways] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [selectedGateway, setSelectedGateway] = useState<any | null>(null);
    const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const { showToast } = useToast();

    // Fetch enabled gateways on load
    useEffect(() => {
        const fetchGateways = async () => {
            const { data } = await supabase
                .from('payment_gateways')
                .select('*')
                .eq('is_enabled', true);
            if (data) setGateways(data);
        };
        fetchGateways();
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError(null);
        setProjects([]);
        setSelectedIndex(0);

        try {
            const { data, error: supabaseError } = await supabase
                .from('clients')
                .select('*')
                .eq('email', email)
                .order('created_at', { ascending: false });

            if (supabaseError) throw supabaseError;

            if (!data || data.length === 0) {
                setError("No tactical dossiers matched these coordinates.");
            } else {
                setProjects(data);
                if (data[0]) {
                    fetchDocuments(data[0].id);
                    const bal = calculateBalance(data[0].total_value, data[0].paid_amount).replace(/[^0-9.]/g, '');
                    setPaymentAmount(bal);
                }
            }
        } catch (err: any) {
            setError("Synchronization failure. Secure systems offline.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocuments = async (clientId: string) => {
        const { data } = await supabase
            .from('client_documents')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        if (data) setProjectDocuments(data);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !project) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `portal_uploads/${project.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('client-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('client-assets')
                .getPublicUrl(filePath);

            await supabase.from('client_documents').insert([{
                client_id: project.id,
                name: file.name,
                file_url: publicUrl,
                type: file.type,
                size: file.size
            }]);

            // Create notification for admin
            await supabase.from('notifications').insert([{
                type: 'System',
                message: `Portal Upload: ${project.full_name} added an asset to ${project.project_name}`,
                link: '/admin/clients'
            }]);

            fetchDocuments(project.id);
        } catch (err: any) {
            console.error("Upload failed:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !project) return;

        setIsSubmittingReceipt(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `receipt-${Math.random()}.${fileExt}`;
            const filePath = `receipts/${project.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('client-assets')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('client-assets')
                .getPublicUrl(filePath);

            const { error: confirmationError } = await supabase
                .from('payment_confirmations')
                .insert([{
                    client_id: project.id,
                    project_id: project.id,
                    amount: parseFloat(calculateBalance(project.total_value, project.paid_amount).replace(/[^0-9.]/g, '')) || 0,
                    receipt_url: publicUrl,
                    status: 'Pending'
                }]);

            if (confirmationError) throw confirmationError;

            // Notify admin
            await supabase.from('notifications').insert([{
                type: 'System',
                message: `Payment Receipt: ${project.full_name} uploaded a receipt for ${project.project_name}`,
                link: '/admin/transactions'
            }]);

            setSelectedGateway(null);
            alert("Receipt transmitted. Our treasury team will verify and update your balance shortly.");
        } catch (err: any) {
            console.error("Receipt upload failed:", err);
            alert("Failed to transmit receipt. Please try again.");
        } finally {
            setIsSubmittingReceipt(false);
        }
    };

    const handlePaymentSuccess = async (reference: any) => {
        if (!project || !selectedGateway) return;

        const amountNum = parseFloat(paymentAmount) || 0;

        try {
            // Call secure API to verify and update
            const response = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reference: reference.reference,
                    projectId: project.id,
                    gatewayId: selectedGateway.id,
                    amount: amountNum
                })
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Synchronization failure.");

            // Clear selected gateway and show success
            setSelectedGateway(null);
            showToast("Digital Settlement Verified. Your project dossier has been updated in real-time.", "success");

            // Refresh projects
            handleSearch({ preventDefault: () => { } } as any);
        } catch (err: any) {
            console.error("Payment sync failed:", err);
            showToast(err.message || "Payment successful but synchronization failed. Please contact support.", "error");
        }
    };

    const handlePaymentClose = () => {
        showToast("Settlement operation aborted by operator.", "warning");
    };

    const project = projects[selectedIndex];

    const calculateBalance = (total: string, paid: string) => {
        const t = parseFloat(total.replace(/[^0-9.]/g, '')) || 0;
        const p = parseFloat(paid.replace(/[^0-9.]/g, '')) || 0;
        const balance = t - p;
        return balance > 0 ? `$${balance.toLocaleString()}` : "$0";
    };

    const getGatewayIcon = (id: string) => {
        switch (id) {
            case 'paystack': return <Globe size={16} />;
            case 'stripe': return <CreditCard size={16} />;
            case 'paypal': return <Landmark size={16} />;
            case 'bank_transfer': return <Banknote size={16} />;
            default: return <CreditCard size={16} />;
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 font-sans pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto space-y-12">
                {/* Header */}
                <header className="text-center space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.3em]"
                    >
                        <Shield size={12} /> Strategic Portal
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl lg:text-7xl font-light italic tracking-tighter"
                    >
                        Project Intelligence
                    </motion.h1>
                </header>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="max-w-lg mx-auto"
                >
                    <form onSubmit={handleSearch} className="relative group">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300 group-focus-within:text-black transition-colors" size={20} />
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="coordination-email@cortdevs.com"
                            className="w-full bg-neutral-50 border border-neutral-100 p-6 pl-16 text-sm outline-none focus:border-black transition-all shadow-sm"
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="absolute right-2 top-2 bottom-2 bg-primary text-primary-foreground px-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                            Sync
                        </button>
                    </form>
                    {error && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest mt-4"
                        >
                            {error}
                        </motion.p>
                    )}
                </motion.div>

                {/* High-Volume Project Switcher */}
                <AnimatePresence>
                    {projects.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative max-w-sm mx-auto z-50"
                        >
                            <button
                                onClick={() => setShowProjectPicker(!showProjectPicker)}
                                className="w-full flex items-center justify-between p-4 bg-card border border-border text-[10px] font-bold uppercase tracking-widest hover:border-foreground transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <Layers size={14} /> {project.project_name}
                                </span>
                                <ChevronDown size={14} className={`transition-transform ${showProjectPicker ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showProjectPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 5 }}
                                        className="absolute top-full left-0 right-0 mt-1 bg-card border border-border shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                                    >
                                        {projects.map((p, idx) => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setSelectedIndex(idx);
                                                    setShowProjectPicker(false);
                                                    fetchDocuments(p.id);
                                                }}
                                                className={`w-full text-left p-4 text-[9px] font-bold uppercase tracking-[0.2em] transition-all hover:bg-neutral-50 ${idx === selectedIndex ? "text-black bg-neutral-50" : "text-neutral-400"}`}
                                            >
                                                {p.project_name}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Result Section */}
                <AnimatePresence mode="wait">
                    {project && (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -40 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8"
                        >
                            {/* Project Overview */}
                            <div className="lg:col-span-2 space-y-8">
                                <section className="bg-primary text-primary-foreground p-10 space-y-8 relative overflow-hidden group border border-border">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400">Tactical ID: {project.id.slice(0, 8).toUpperCase()}</p>
                                        <h2 className="text-4xl font-light italic tracking-tight">{project.project_name}</h2>
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Operation Status</p>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'Launched' || project.status === 'Completed' ? "bg-green-400" : "bg-orange-400 animate-pulse"}`} />
                                                <p className="text-sm font-light text-neutral-200">{project.status}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Project Value</p>
                                            <p className="text-sm font-light text-neutral-200">{project.total_value}</p>
                                        </div>
                                    </div>

                                    <div className="pt-8 border-t border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-neutral-400">
                                                <Layers size={18} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Current Phase</p>
                                                <p className="text-xs font-semibold">{project.status === 'Launched' ? "Post-Deployment" : "Active Development"}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Rocket size={160} />
                                    </div>
                                </section>

                                {/* Asset Upload & Documents */}
                                <div className="p-8 border border-border space-y-8 bg-card">
                                    <header className="flex justify-between items-center">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Project Assets</p>
                                            <h3 className="text-xl font-light italic">Technical Documentation</h3>
                                        </div>
                                        <label className="cursor-pointer bg-foreground text-background px-6 py-3 text-[9px] font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                                            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                                            Upload Asset
                                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                        </label>
                                    </header>

                                    <div className="space-y-2">
                                        {projectDocuments.length === 0 ? (
                                            <div className="p-8 text-center border border-dashed border-border bg-secondary/10">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest italic">No assets registered to this initiative.</p>
                                            </div>
                                        ) : (
                                            projectDocuments.map(doc => (
                                                <div key={doc.id} className="p-4 bg-secondary/30 border border-border flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-card text-muted-foreground">
                                                            <FileText size={16} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase">{doc.name}</p>
                                                            <p className="text-[9px] text-muted-foreground font-mono">{(doc.size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.created_at).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="p-2 hover:bg-foreground hover:text-background transition-all text-muted-foreground">
                                                        <ExternalLink size={14} />
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Payment/Sidebar */}
                            <div className="space-y-6">
                                <div className="p-8 bg-secondary/30 border border-border space-y-8">
                                    <header className="space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Financial Clearance</p>
                                        <h3 className="text-2xl font-light tracking-tight italic">Secure Settlement</h3>
                                    </header>

                                    <div className="space-y-2">
                                        <div className="p-4 bg-card border border-border flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Settled</span>
                                            <span className="text-sm font-light text-green-600">{project.paid_amount}</span>
                                        </div>
                                        <div className="p-4 bg-card border border-primary flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Balance Due</span>
                                            <span className="text-lg font-light">{calculateBalance(project.total_value, project.paid_amount)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-neutral-400">Strategic Checkout</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {gateways.map(gw => (
                                                <button
                                                    key={gw.id}
                                                    onClick={() => setSelectedGateway(gw)}
                                                    className={`p-3 border transition-all flex flex-col items-center gap-2 group ${selectedGateway?.id === gw.id ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground"}`}
                                                >
                                                    <div className={`p-2 transition-colors ${selectedGateway?.id === gw.id ? "bg-background/10" : "bg-secondary/50 group-hover:bg-foreground group-hover:text-background"}`}>
                                                        {getGatewayIcon(gw.id)}
                                                    </div>
                                                    <span className="text-[8px] font-bold uppercase tracking-widest">{gw.name}</span>
                                                </button>
                                            ))}
                                            {gateways.length === 0 && (
                                                <div className="col-span-2 p-4 text-center border border-dashed border-border">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest italic">Digital gateways synchronizing...</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Selected Gateway Action Area */}
                                    <AnimatePresence mode="wait">
                                        {selectedGateway && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <div className="p-6 bg-card border border-primary space-y-6">
                                                    <div className="space-y-4 pb-6 border-b border-border">
                                                        <div className="space-y-1">
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Payment Amount (USD)</p>
                                                            <div className="relative">
                                                                <input
                                                                    type="number"
                                                                    value={paymentAmount}
                                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                                    className="w-full p-4 pl-10 border border-primary bg-background text-sm font-bold focus:bg-secondary/30 outline-none transition-all"
                                                                    placeholder="0.00"
                                                                />
                                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold leading-none">$</div>
                                                            </div>
                                                            <p className="text-[9px] text-muted-foreground italic">Adjust if you wish to make a partial deposit.</p>
                                                        </div>
                                                    </div>

                                                    <header className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Selected Gateway</p>
                                                            <h4 className="text-sm font-bold uppercase">{selectedGateway.name}</h4>
                                                        </div>
                                                        <button onClick={() => setSelectedGateway(null)} className="text-muted-foreground hover:text-foreground">
                                                            <AlertCircle size={14} className="rotate-45" />
                                                        </button>
                                                    </header>

                                                    {selectedGateway.id === 'bank_transfer' ? (
                                                        <div className="space-y-6">
                                                            <div className="space-y-4 p-4 bg-secondary/30 border border-border">
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    <div>
                                                                        <p className="text-[8px] font-bold uppercase text-neutral-400 tracking-tighter">Bank Name</p>
                                                                        <p className="text-xs font-semibold">{selectedGateway.config?.bankName || "Not Configured"}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[8px] font-bold uppercase text-neutral-400 tracking-tighter">Account Name</p>
                                                                        <p className="text-xs font-semibold">{selectedGateway.config?.accountName || "Not Configured"}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[8px] font-bold uppercase text-neutral-400 tracking-tighter">Account Number</p>
                                                                        <p className="text-sm font-bold font-mono tracking-wider">{selectedGateway.config?.accountNumber || "0000000000"}</p>
                                                                    </div>
                                                                </div>
                                                                {selectedGateway.config?.instructions && (
                                                                    <p className="text-[9px] text-muted-foreground italic border-t border-border pt-3">
                                                                        {selectedGateway.config.instructions}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="space-y-3">
                                                                <p className="text-[9px] font-bold uppercase tracking-widest text-foreground">Upload Settlement Receipt</p>
                                                                <label className="block w-full cursor-pointer group">
                                                                    <div className="p-4 border border-dashed border-border group-hover:border-foreground transition-all flex flex-col items-center gap-2">
                                                                        {isSubmittingReceipt ? (
                                                                            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                                                                        ) : (
                                                                            <Upload size={20} className="text-muted-foreground group-hover:text-foreground" />
                                                                        )}
                                                                        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Attach Proof of Payment (PDF/Image)</span>
                                                                    </div>
                                                                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleReceiptUpload} disabled={isSubmittingReceipt} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        selectedGateway.id === 'paystack' ? (
                                                            <div className="space-y-4">
                                                                <div className="p-6 text-center border border-dashed border-border bg-secondary/30">
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest italic leading-relaxed">
                                                                        You are about to settle the balance for <span className="text-foreground font-bold">{project.project_name}</span> using our secure Paystack interface.
                                                                    </p>
                                                                </div>
                                                                <PaystackButton
                                                                    className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-90 transition-all flex items-center justify-center gap-3"
                                                                    publicKey={selectedGateway.config?.isTestMode ? selectedGateway.config?.testPublicKey : selectedGateway.config?.publicKey || ""}
                                                                    email={project.email}
                                                                    amount={Math.round((parseFloat(paymentAmount) || 0) * 100)}
                                                                    text="Execute Settlement"
                                                                    onSuccess={handlePaymentSuccess}
                                                                    onClose={handlePaymentClose}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                <div className="p-6 text-center border border-dashed border-border bg-secondary/30">
                                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest italic">
                                                                        Redirecting to secure {selectedGateway.name} checkout...
                                                                    </p>
                                                                </div>
                                                                <button className="w-full py-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-[0.3em] hover:opacity-90 transition-all flex items-center justify-center gap-3">
                                                                    Launch Settlement <ArrowRight size={14} />
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <p className="text-[9px] text-neutral-400 text-center uppercase tracking-widest leading-relaxed">
                                        Secure SSL/TLS layer established.
                                    </p>
                                </div>

                                <div className="p-8 border border-border space-y-4 shadow-sm bg-card">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <AlertCircle size={14} />
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Support Protocol</h4>
                                    </div>
                                    <p className="text-xs text-neutral-500 leading-relaxed italic">
                                        Coordination required for {project.project_name}?
                                    </p>
                                    <a href="mailto:projects@cortdevs.com" className="text-[10px] font-bold uppercase tracking-widest hover:underline block">
                                        projects@cortdevs.com
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
