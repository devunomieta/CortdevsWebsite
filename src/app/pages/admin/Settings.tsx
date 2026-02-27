import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Upload,
    Globe,
    Image as ImageIcon,
    Save,
    CheckCircle2,
    AlertCircle
} from "lucide-react";
import { useConfig } from "../../context/ConfigContext";

export function Settings() {
    const { config, updateConfig } = useConfig();
    const [formData, setFormData] = useState(config);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus("idle");

        try {
            await updateConfig(formData);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (error) {
            setSaveStatus("error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-light tracking-tight text-neutral-900 italic">Branding & Meta Configuration</h2>
                    <p className="text-sm text-neutral-500 mt-1">Manage your sitewide identity and search engine presence.</p>
                </div>

                <AnimatePresence>
                    {saveStatus === "success" && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 border border-green-100 text-xs font-bold uppercase tracking-widest"
                        >
                            <CheckCircle2 size={14} /> Changes Synchronized
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 pb-20">
                {/* Logos Section */}
                <div className="bg-white border border-neutral-200">
                    <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                        <div className="p-2 bg-neutral-900 text-white"><ImageIcon size={18} /></div>
                        <h3 className="text-sm font-bold uppercase tracking-[0.2em]">Platform Components</h3>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Header Logo (Dark Theme)</label>
                            <div className="flex flex-col gap-4">
                                <div className="h-32 w-full bg-neutral-100 border border-neutral-200 flex items-center justify-center relative group">
                                    <img src={formData.headerLogo} alt="Header Logo" className="max-h-16 object-contain" />
                                    <div className="absolute inset-0 bg-neutral-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                        <Upload size={24} className="text-white" />
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    name="headerLogo"
                                    value={formData.headerLogo}
                                    onChange={handleChange}
                                    className="w-full text-xs font-mono p-3 border border-neutral-200 focus:border-black outline-none transition-all"
                                    placeholder="/logo-dark.svg"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Footer Logo (Light Theme)</label>
                            <div className="flex flex-col gap-4">
                                <div className="h-32 w-full bg-neutral-900 flex items-center justify-center relative group">
                                    <img src={formData.footerLogo} alt="Footer Logo" className="max-h-16 object-contain" />
                                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                        <Upload size={24} className="text-white" />
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    name="footerLogo"
                                    value={formData.footerLogo}
                                    onChange={handleChange}
                                    className="w-full text-xs font-mono p-3 border border-neutral-200 focus:border-black outline-none transition-all"
                                    placeholder="/logo-light.svg"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* SEO & Meta Section */}
                <div className="bg-white border border-neutral-200">
                    <div className="p-6 border-b border-neutral-100 flex items-center gap-3">
                        <div className="p-2 bg-neutral-900 text-white"><Globe size={18} /></div>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Favicon Path</label>
                                <input
                                    type="text"
                                    name="favicon"
                                    value={formData.favicon}
                                    onChange={handleChange}
                                    className="w-full text-xs font-mono p-4 border border-neutral-200 focus:border-black outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 font-bold">Global Meta Description</label>
                            <textarea
                                name="metaDescription"
                                value={formData.metaDescription}
                                onChange={handleChange}
                                rows={4}
                                className="w-full text-sm font-light leading-relaxed p-4 border border-neutral-200 focus:border-black outline-none transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-black text-white px-10 py-5 text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-neutral-800 transition-all disabled:opacity-50 shadow-2xl shadow-black/20"
                >
                    {isSaving ? "Synchronizing..." : "Commit Changes"}
                    <Save size={16} />
                </button>
            </form>
        </div>
    );
}
