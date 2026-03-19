import React, { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { 
  Search, 
  RefreshCw, 
  ChevronRight, 
  ArrowLeft, 
  FileText, 
  ExternalLink,
  Briefcase,
  User,
  Calendar,
  Download
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
    app.career?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.cv_url.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                <th className="p-6">Position</th>
                <th className="p-6">Submission Date</th>
                <th className="p-6">Documents</th>
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
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-neutral-500 italic">
                    No applications recorded yet.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-all group">
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
                    <td className="p-6">
                      <div className="flex items-center gap-3 p-2 border border-neutral-100 bg-neutral-50 rounded group-hover:border-neutral-200 transition-all max-w-xs">
                        <FileText size={16} className="text-neutral-400" />
                        <span className="text-[11px] truncate font-mono text-neutral-500">
                          {app.cv_url.split('/').pop()?.split('?')[0] || "document.pdf"}
                        </span>
                      </div>
                    </td>
                    <td className="p-6 text-right">
                      <a 
                        href={app.cv_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-lg shadow-black/5"
                      >
                        Review CV <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
