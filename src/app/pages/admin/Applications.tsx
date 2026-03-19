import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import {
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  FileText,
  ExternalLink,
  Briefcase,
  User,
  Calendar,
  Download,
  Trash2,
  Eye,
  X,
  AlertTriangle
} from "lucide-react";
import { useToast } from "../../components/Toast";
import { cn } from "../../components/ui/utils";

interface Application {
  id: string;
  job_id: string;
  cv_url: string;
  created_at: string;
  career?: {
    title: string;
  };
}

export function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"single" | "batch" | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const itemsPerPage = 20;
  const { showToast } = useToast();

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*, career:job_id(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      if (err.code === '42P01') {
        console.warn("job_applications table not found.");
      } else {
        showToast(err.message || "Failed to fetch applications.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const filteredApplications = applications.filter(app =>
  (app.career?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.cv_url.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDeleteClick = (id: string) => {
    setTargetId(id);
    setDeleteMode("single");
    setIsDeleteModalOpen(true);
  };

  const handleBatchDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setDeleteMode("batch");
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteMode === "single" && targetId) {
      try {
        const { error } = await supabase
          .from('job_applications')
          .delete()
          .eq('id', targetId);

        if (error) throw error;
        
        showToast("Application record purged successfully.", "success");
        setApplications(prev => prev.filter(app => app.id !== targetId));
        setSelectedIds(prev => prev.filter(id => id !== targetId));
      } catch (err: any) {
        showToast(err.message || "Failed to purge record.", "error");
      }
    } else if (deleteMode === "batch") {
      try {
        const { error } = await supabase
          .from('job_applications')
          .delete()
          .in('id', selectedIds);

        if (error) throw error;

        showToast(`${selectedIds.length} application records purged.`, "success");
        setApplications(prev => prev.filter(app => !selectedIds.includes(app.id)));
        setSelectedIds([]);
      } catch (err: any) {
        showToast(err.message || "Batch purge failed.", "error");
      }
    }
    
    setIsDeleteModalOpen(false);
    setDeleteMode(null);
    setTargetId(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedApplications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedApplications.map(app => app.id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Link
        to="/admin"
        className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
      >
        <ArrowLeft size={12} /> Back to Dashboard
      </Link>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-2xl font-light tracking-tight italic">Job Applications</h2>
          <p className="text-sm text-neutral-500 mt-1">Review CV submissions from potential candidates.</p>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBatchDeleteClick}
              className="px-4 py-3 bg-rose-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2"
            >
              <Trash2 size={14} /> Delete All ({selectedIds.length})
            </button>
          )}
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input
              type="text"
              placeholder="Search by position..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to page 1 on search
              }}
              className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 outline-none focus:border-black transition-all text-sm"
            />
          </div>
          <button
            onClick={fetchApplications}
            className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw size={18} className={cn("text-neutral-500", isLoading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse focus-within:ring-0">
            <thead>
              <tr className="border-b border-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-bold whitespace-nowrap">
                <th className="p-6 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === paginatedApplications.length && paginatedApplications.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 border-neutral-300 text-black focus:ring-black cursor-pointer"
                  />
                </th>
                <th className="p-6">Position</th>
                <th className="p-6">Submission Date</th>
                <th className="p-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading && applications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-neutral-400 italic">
                    Retrieving digital records...
                  </td>
                </tr>
              ) : (
                paginatedApplications.map((app) => (
                  <tr key={app.id} className={cn(
                    "border-b border-neutral-50 hover:bg-neutral-50 transition-all group",
                    selectedIds.includes(app.id) && "bg-neutral-50"
                  )}>
                    <td className="p-6 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        className="w-4 h-4 border-neutral-300 text-black focus:ring-black cursor-pointer"
                      />
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-neutral-100 flex items-center justify-center rounded-full text-neutral-400 group-hover:text-black group-hover:bg-neutral-200 transition-all">
                          <Briefcase size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{app.career?.title || "Unknown Position"}</p>
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Candidate Submission</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 text-neutral-600">
                        <Calendar size={14} className="text-neutral-400" />
                        <span>{new Date(app.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] text-neutral-400 font-mono ml-2">
                          {new Date(app.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewUrl(app.cv_url)}
                          className="p-2 text-neutral-400 hover:text-black transition-colors"
                          title="Preview CV"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(app.id)}
                          className="p-2 text-neutral-400 hover:text-rose-600 transition-colors"
                          title="Purge Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-neutral-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Page {currentPage} of {totalPages} <span className="mx-2">|</span> {filteredApplications.length} Records Found
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-neutral-200 hover:bg-neutral-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    "w-8 h-8 text-[10px] font-bold transition-all border",
                    currentPage === page
                      ? "bg-black text-white border-black"
                      : "bg-white text-neutral-400 border-neutral-200 hover:border-black"
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-neutral-200 hover:bg-neutral-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* CV Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewUrl(null)} />
          <div className="relative w-full max-w-5xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-3">
                <FileText className="text-neutral-400" size={20} />
                <h3 className="text-sm font-bold uppercase tracking-widest text-black">CV Preview</h3>
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-2 hover:bg-neutral-200 transition-colors rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-neutral-100 relative">
              <iframe
                src={previewUrl}
                className="w-full h-full border-none"
                title="CV Document"
              />
            </div>
            <div className="p-4 bg-white border-t border-neutral-100 flex justify-end gap-3">
              <a
                href={previewUrl}
                download
                className="px-6 py-2 border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center gap-2"
              >
                <Download size={14} /> Download
              </a>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center gap-2"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-neutral-200 shadow-3xl w-full max-w-md overflow-hidden p-8 space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-600">
                <div className="p-3 bg-rose-50 rounded-full">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-xl font-light italic">Terminate Data Point?</h3>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {deleteMode === "single" ? (
                    <>You are about to delete this application record. This action is <span className="font-bold text-black uppercase tracking-tighter">irreversible</span> and will purge all associated inquiry data.</>
                  ) : (
                    <>You are about to delete <span className="font-bold text-black">{selectedIds.length} application records</span>. This action is irreversible and will fully purge these records from the central repository.</>
                  )}
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t border-neutral-100">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteMode(null);
                    setTargetId(null);
                  }}
                  className="flex-1 py-4 text-[10px] uppercase font-bold tracking-[0.2em] border border-neutral-200 hover:bg-neutral-50 transition-all"
                >
                  Abort
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 text-[10px] uppercase font-bold tracking-[0.2em] bg-rose-600 text-white hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all"
                >
                  Confirm Purge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
