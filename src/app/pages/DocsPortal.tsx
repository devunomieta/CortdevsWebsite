import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    FileText,
    MessageSquare,
    ThumbsUp,
    AlertCircle,
    Upload,
    Download,
    X,
    FolderOpen,
    Shield,
    Monitor,
    Users,
    BarChart3,
    Trash2,
    Edit3,
    AlertTriangle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { DocUploadModal } from "../components/DocUploadModal";
import { DocInteractionPanel } from "../components/DocInteractionPanel";
import { DocUpdateBanner } from "../components/DocUpdateBanner";
import { AuthModal } from "../components/AuthModal";
import { Key } from "lucide-react";

type DocCategory = 'Public Docs' | 'Tech Docs' | 'Analysis' | 'Employment Docs' | 'Brand Docs';

interface Document {
    id: string;
    title: string;
    category: DocCategory;
    file_url: string;
    file_type: string;
    size: number;
    created_at: string;
    likes_count: number;
    user_has_liked: boolean;
    replies_count: number;
}

export function DocsPortal() {
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string>('guest');
    const [docs, setDocs] = useState<Document[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<DocCategory | "All">("All");
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any | null>(null);
    const [docToDelete, setDocToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showInteraction, setShowInteraction] = useState<{ mode: 'comments' | 'issue', isOpen: boolean }>({ mode: 'comments', isOpen: false });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        let currentUserId = null;
        if (session) {
            setUser(session.user);
            currentUserId = session.user.id;
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
            if (profile) setRole(profile.role);
        }

        try {
            const { data, error } = await supabase
                .from('documentation')
                .select(`
                    *,
                    doc_likes(user_id),
                    doc_comments(count)
                `)
                .order('created_at', { ascending: false });

            if (data) {
                setDocs(data.map(d => ({
                    ...d,
                    likes_count: d.doc_likes?.length || 0,
                    replies_count: d.doc_comments?.[0]?.count || 0,
                    user_has_liked: d.doc_likes?.some((l: any) => l.user_id === currentUserId) || false
                })));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLike = async (docId: string, hasLiked: boolean) => {
        if (!user || role === 'Client' || role === 'guest') return;

        if (hasLiked) {
            await supabase.from('doc_likes').delete().eq('doc_id', docId).eq('user_id', user.id);
        } else {
            await supabase.from('doc_likes').insert([{ doc_id: docId, user_id: user.id }]);
        }
        fetchData();
    };

    const handleDelete = async () => {
        if (!docToDelete) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('documentation')
                .delete()
                .eq('id', docToDelete.id);
            if (error) throw error;
            fetchData();
            setDocToDelete(null);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSuccess = () => {
        fetchData();
        setEditingDoc(null);
    };

    const handleAuthSuccess = () => {
        fetchData();
        setShowAuthModal(false);
    };

    const categories = [
        { name: "All", icon: <FolderOpen size={16} />, visibleTo: ['*'] },
        { name: "Public Docs", icon: <FileText size={16} />, visibleTo: ['*'] },
        { name: "Brand Docs", icon: <Shield size={16} />, visibleTo: ['*'] },
        { name: "Tech Docs", icon: <Monitor size={16} />, visibleTo: ['Superadmin', 'Admin', 'CTO', 'Devs'] },
        { name: "Analysis", icon: <BarChart3 size={16} />, visibleTo: ['Superadmin', 'Admin', 'CTO', 'Devs'] },
        { name: "Employment Docs", icon: <Users size={16} />, visibleTo: ['Superadmin', 'Admin', 'CTO', 'Devs', 'Operations Officer', 'Sales Officer'] },
    ].filter(cat => cat.visibleTo.includes('*') || cat.visibleTo.includes(role) || role === 'Superadmin');

    const filteredDocs = docs.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === "All" || doc.category === activeCategory;
        const catConfig = categories.find(c => c.name === doc.category);
        return matchesSearch && matchesCategory && catConfig;
    });

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 pb-20">
            <DocUpdateBanner role={role} />
            <div className="bg-primary text-primary-foreground pt-24 pb-16 px-6 relative overflow-hidden border-b border-border">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-foreground/5 to-transparent skew-x-12"></div>
                <div className="max-w-7xl mx-auto relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-primary-foreground/40 mb-4 block">Knowledge Repository</span>
                            <h1 className="text-4xl md:text-6xl font-light tracking-tight italic mb-2">CortDevs<span className="font-bold not-italic">.Docs</span></h1>
                            <p className="text-primary-foreground/60 font-light max-w-xl">Premium technical dossiers, brand guidelines, and operational intelligence.</p>
                        </div>
                        <div className="flex gap-4">
                            {user && role !== 'Client' && (
                                <button onClick={() => setShowUploadModal(true)} className={`px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 transition-all ${role === 'Superadmin' ? 'bg-primary-foreground text-primary hover:opacity-90' : 'bg-primary-foreground/10 text-primary-foreground border border-primary-foreground/20 hover:bg-primary-foreground hover:text-primary'}`}>
                                    {role === 'Superadmin' ? <Upload size={16} /> : <FileText size={16} />}
                                    {role === 'Superadmin' ? 'Deploy Document' : 'Submit Intel'}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 items-center justify-between">
                    <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar w-full lg:w-auto">
                        {categories.map((cat) => (
                            <button key={cat.name} onClick={() => setActiveCategory(cat.name as any)} className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${activeCategory === cat.name ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/30 text-muted-foreground border-border hover:border-foreground hover:text-foreground"}`}>
                                {cat.icon} {cat.name}
                            </button>
                        ))}
                        {!user && (
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border bg-secondary/30 text-muted-foreground border-border hover:bg-primary hover:text-primary-foreground hover:border-primary group"
                                title="Unlock Administrative Access"
                            >
                                <Key size={16} className="group-hover:rotate-12 transition-transform" />
                            </button>
                        )}
                    </div>
                    <div className="relative w-full lg:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input type="text" placeholder="SEARCH DOSSIERS..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-secondary/30 border border-border text-[11px] font-medium tracking-widest uppercase focus:outline-none focus:ring-0 focus:border-foreground transition-colors" />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-4">
                        <div className="w-12 h-12 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Synchronizing Data</p>
                    </div>
                ) : filteredDocs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredDocs.map((doc, i) => (
                            <motion.div key={doc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="group relative bg-card border border-border p-8 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-secondary/50 flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-500">
                                            <FileText size={24} strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[9px] font-bold bg-secondary/50 px-2 py-1 uppercase tracking-widest text-muted-foreground">{doc.category}</span>
                                    </div>
                                    <h3 className="text-xl font-light leading-tight mb-2 group-hover:italic transition-all">{doc.title}</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-8">{doc.file_type} • {(doc.size / 1024).toFixed(1)} KB • {format(new Date(doc.created_at), 'MMM dd, yyyy')}</p>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-6 text-muted-foreground border-t border-border pt-6">
                                        <button onClick={() => handleLike(doc.id, doc.user_has_liked)} className={`flex items-center gap-2 transition-colors ${doc.user_has_liked ? 'text-primary' : 'hover:text-primary'}`}>
                                            <ThumbsUp size={16} fill={doc.user_has_liked ? 'currentColor' : 'none'} />
                                            <span className="text-[10px] font-bold">{doc.likes_count}</span>
                                        </button>
                                        <button onClick={() => { setSelectedDoc(doc); setShowInteraction({ mode: 'comments', isOpen: true }); }} className="flex items-center gap-2 hover:text-foreground transition-colors">
                                            <MessageSquare size={16} />
                                            <span className="text-[10px] font-bold">{doc.replies_count}</span>
                                        </button>
                                        <button onClick={() => { setSelectedDoc(doc); setShowInteraction({ mode: 'issue', isOpen: true }); }} className="flex items-center gap-2 hover:text-rose-500 transition-colors text-muted-foreground/30">
                                            <AlertCircle size={16} />
                                        </button>
                                        {role === 'Superadmin' && (
                                            <div className="flex gap-2 ml-2">
                                                <button
                                                    onClick={() => setEditingDoc(doc)}
                                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDocToDelete(doc)}
                                                    className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <a href={doc.file_url} target="_blank" className="w-full flex items-center justify-between p-4 bg-secondary/50 hover:bg-primary hover:text-primary-foreground transition-all text-[10px] font-bold uppercase tracking-[0.2em] group/btn">
                                        Access File <Download size={14} className="group-hover/btn:translate-y-1 transition-transform" />
                                    </a>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-40 border-2 border-dashed border-border">
                        <FolderOpen size={48} className="mx-auto text-muted-foreground/20 mb-6" />
                        <h3 className="text-2xl font-light text-muted-foreground/40 italic">No dossiers found matching your criteria</h3>
                    </div>
                )}
            </div>

            {user && (
                <DocUploadModal
                    isOpen={showUploadModal || !!editingDoc}
                    onClose={() => {
                        setShowUploadModal(false);
                        setEditingDoc(null);
                    }}
                    onSuccess={handleSuccess}
                    role={role}
                    userId={user.id}
                    editDoc={editingDoc}
                />
            )}

            {/* Deletion Confirmation */}
            <AnimatePresence>
                {docToDelete && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card w-full max-w-md p-10 shadow-2xl border border-border"
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-16 h-16 bg-rose-500/10 flex items-center justify-center text-rose-500 rounded-full">
                                    <AlertTriangle size={32} />
                                </div>
                            </div>
                            <h2 className="text-2xl font-light italic text-center mb-2">Delete <span className="font-bold not-italic text-rose-500">Dossier</span>?</h2>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-center mb-10">
                                This action is permanent and will purge intelligence from the portal.
                            </p>

                            <div className="space-y-4">
                                <button
                                    disabled={isDeleting}
                                    onClick={handleDelete}
                                    className="w-full py-5 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-[0.4em] hover:opacity-90 transition-all flex items-center justify-center gap-3"
                                >
                                    {isDeleting ? "PURGING..." : "CONFIRM PURGE"}
                                </button>
                                <button
                                    onClick={() => setDocToDelete(null)}
                                    className="w-full py-5 bg-secondary/50 text-muted-foreground text-[10px] font-bold uppercase tracking-[0.4em] hover:bg-secondary transition-all"
                                >
                                    CANCEL MISSION
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {selectedDoc && (
                <DocInteractionPanel
                    doc={selectedDoc}
                    isOpen={showInteraction.isOpen}
                    onClose={() => setShowInteraction({ ...showInteraction, isOpen: false })}
                    user={user}
                    role={role}
                    mode={showInteraction.mode}
                />
            )}

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSuccess={handleAuthSuccess}
            />
        </div>
    );
}
