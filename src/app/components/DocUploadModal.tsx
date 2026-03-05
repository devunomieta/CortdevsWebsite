import React, { useState, useEffect } from "react";
import { X, Upload, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface DocUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    role: string;
    userId: string;
    editDoc?: {
        id: string;
        title: string;
        category: string;
    } | null;
}

const CATEGORIES = ['Public Docs', 'Tech Docs', 'Analysis', 'Employment Docs', 'Brand Docs'];

export function DocUploadModal({ isOpen, onClose, onSuccess, role, userId, editDoc }: DocUploadModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState(editDoc?.title || "");
    const [category, setCategory] = useState(editDoc?.category || CATEGORIES[0]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (editDoc) {
            setTitle(editDoc.title);
            setCategory(editDoc.category);
        } else {
            setTitle("");
            setCategory(CATEGORIES[0]);
        }
    }, [editDoc, isOpen]);

    if (!isOpen) return null;

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title) return;
        if (!editDoc && !file) return;

        setIsUploading(true);
        setError(null);

        try {
            // 1. Upload to Supabase Storage (if file provided)
            let finalUrl = editDoc ? "" : ""; // Placeholder
            let fileExt = "";

            if (file) {
                fileExt = file.name.split('.').pop() || "";
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${category.toLowerCase().replace(' ', '-')}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('documentation')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('documentation')
                    .getPublicUrl(filePath);

                finalUrl = publicUrl;
            }

            // 2. Update or Insert into DB
            const targetTable = role === 'Superadmin' ? 'documentation' : 'documentation_submissions';
            const payload: any = {
                title,
                category,
                [role === 'Superadmin' ? 'uploaded_by' : 'submitted_by']: userId,
            };

            if (file) {
                payload.file_url = finalUrl;
                payload.file_type = fileExt;
                payload.size = file.size;
            }

            let docData: any[] | null = null;
            let dbError: any = null;

            if (editDoc && role === 'Superadmin') {
                const { data, error } = await supabase
                    .from('documentation')
                    .update(payload)
                    .eq('id', editDoc.id)
                    .select();
                docData = data;
                dbError = error;
            } else {
                const { data, error } = await supabase
                    .from(targetTable)
                    .insert([payload])
                    .select();
                docData = data;
                dbError = error;
            }

            if (dbError) throw dbError;

            // 3. Create Broadcast if Superadmin
            if (role === 'Superadmin' && docData?.[0]) {
                await supabase.from('doc_broadcasts').insert([{
                    doc_id: docData[0].id,
                    title: editDoc ? `UPDATED: ${title}` : title,
                    category: category,
                    target_roles: [] // Global by default or based on category
                }]);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to upload dossier.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-0 md:p-6 overflow-hidden">
            <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl shadow-2xl relative flex flex-col overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 md:top-6 md:right-6 text-neutral-400 hover:text-black transition-colors z-[110] bg-white/50 backdrop-blur-sm p-2 rounded-full md:bg-transparent"
                >
                    <X size={24} />
                </button>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12">
                    <div className="mb-10 pr-12">
                        <h2 className="text-3xl font-light italic mb-2">Dossier <span className="font-bold not-italic">Deployment</span></h2>
                        <p className="text-[10px] uppercase tracking-[0.4em] font-bold text-neutral-400">
                            {role === 'Superadmin' ? 'Direct Infrastructure Injection' : 'Superadmin Verification Required'}
                        </p>
                    </div>

                    <form onSubmit={handleUpload} className="space-y-8">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">Document Title</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Q1 Fiscal Analysis - CortDevs"
                                className="w-full bg-neutral-50 border border-neutral-200 p-4 text-xs font-medium focus:outline-none focus:border-black transition-colors"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">Target Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-neutral-50 border border-neutral-200 p-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-black appearance-none"
                            >
                                {CATEGORIES.filter(cat => {
                                    if (cat === 'Public Docs' || cat === 'Brand Docs') return true;
                                    if (['Superadmin', 'Admin', 'CTO', 'Devs'].includes(role)) return true;
                                    if (cat === 'Employment Docs' && ['Operations Officer', 'Sales Officer'].includes(role)) return true;
                                    return false;
                                }).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">Asset Selection</label>
                            <div className="relative group">
                                <input
                                    type="file"
                                    required={!editDoc}
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="border-2 border-dashed border-neutral-200 p-8 md:p-12 text-center group-hover:border-black transition-all">
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="text-black mb-2" size={32} />
                                            <p className="text-xs font-bold uppercase">{file.name}</p>
                                            <p className="text-[10px] text-neutral-400 uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="text-neutral-300 group-hover:text-black transition-colors mb-2" size={32} strokeWidth={1.5} />
                                            <p className="text-[10px] font-bold uppercase tracking-widest">{editDoc ? "Update / Replace Dossier" : "Click or Drag to Upload Dossier"}</p>
                                            <p className="text-[9px] text-neutral-400 uppercase tracking-widest mt-1">{editDoc ? "Leave empty to keep current asset" : "PDF, Markdown, or Office formats"}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 p-4 border border-red-100 flex items-center gap-3 text-red-600">
                                <AlertCircle size={18} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">{error}</span>
                            </div>
                        )}

                        <div className="pt-6 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-6 text-neutral-400">
                            <p className="text-[9px] max-w-full md:max-w-[200px] uppercase leading-relaxed font-medium text-center md:text-left">
                                {role === 'Superadmin'
                                    ? "Document will be immediately available in the portal after upload."
                                    : "Documents will be sent to the Superadmin download box for verification."}
                            </p>
                            <button
                                disabled={isUploading || (!editDoc && !file) || !title}
                                className="w-full md:w-auto px-10 py-5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.4em] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-800 transition-all flex items-center justify-center gap-3"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Synchronizing...
                                    </>
                                ) : (
                                    editDoc ? "Apply Updates" : "Initiate Transfer"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
