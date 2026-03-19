import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { 
  Plus, 
  Search, 
  RefreshCw, 
  ChevronRight, 
  ArrowLeft, 
  Trash2, 
  Edit3, 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock,
  Globe,
  CheckCircle2,
  X
} from "lucide-react";
import { useToast } from "../../components/Toast";
import { cn } from "../../components/ui/utils";

interface Job {
  id: string;
  slug: string;
  title: string;
  role: string;
  location: string;
  compensation: string;
  about: string;
  responsibilities: string[];
  requirements: string[];
  apply_url: string;
  status: 'open' | 'closed';
  deadline?: string;
  created_at: string;
}

export function AdminCareers() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    role: "",
    location: "Remote / Lagos, Nigeria",
    compensation: "",
    about: "",
    responsibilities: "",
    requirements: "",
    apply_url: "",
    status: "open" as 'open' | 'closed',
    deadline: ""
  });

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('careers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
           // Table doesn't exist yet, show instructions or fallback
           console.warn("Careers table not found.");
        } else {
           throw error;
        }
      }
      setJobs(data || []);
    } catch (err: any) {
      showToast(err.message || "Failed to fetch jobs.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleCreateOrUpdate = async () => {
    if (!formData.title || !formData.role) {
      showToast("Title and Role are required.", "warning");
      return;
    }

    const payload = {
      ...formData,
      deadline: formData.deadline || null,
      responsibilities: formData.responsibilities.split('\n').filter(r => r.trim() !== ""),
      requirements: formData.requirements.split('\n').filter(r => r.trim() !== "")
    };

    try {
      let error;
      if (selectedJob) {
        const { error: updateError } = await supabase
          .from('careers')
          .update(payload)
          .eq('id', selectedJob.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('careers')
          .insert([payload]);
        error = insertError;
      }

      if (error) throw error;

      showToast(`Job ${selectedJob ? 'updated' : 'created'} successfully.`, "success");
      setIsAddModalOpen(false);
      setSelectedJob(null);
      resetForm();
      fetchJobs();
    } catch (err: any) {
      showToast(err.message || "Operation failed.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job posting?")) return;

    try {
      const { error } = await supabase
        .from('careers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast("Job deleted successfully.", "success");
      fetchJobs();
    } catch (err: any) {
      showToast(err.message || "Failed to delete job.", "error");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      role: "",
      location: "Remote / Lagos, Nigeria",
      compensation: "",
      about: "",
      responsibilities: "",
      requirements: "",
      apply_url: "",
      status: "open",
      deadline: ""
    });
  };

  const openEditModal = (job: Job) => {
    setSelectedJob(job);
    setFormData({
      title: job.title,
      slug: job.slug,
      role: job.role,
      location: job.location,
      compensation: job.compensation,
      about: job.about,
      responsibilities: job.responsibilities.join('\n'),
      requirements: job.requirements.join('\n'),
      apply_url: job.apply_url,
      status: job.status,
      deadline: job.deadline || ""
    });
    setIsAddModalOpen(true);
  };

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.role.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 className="text-2xl font-light tracking-tight italic">Careers Management</h2>
          <p className="text-sm text-neutral-500 mt-1">Create and manage job postings for CortDevs.</p>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text" 
              placeholder="Search positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 outline-none focus:border-black transition-all text-sm"
            />
          </div>
          <button 
            onClick={fetchJobs}
            className="p-3 border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw size={18} className={cn("text-neutral-500", isLoading && "animate-spin")} />
          </button>
          <button 
            onClick={() => { resetForm(); setSelectedJob(null); setIsAddModalOpen(true); }}
            className="bg-black text-white px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
          >
            Add Position <Plus size={14} />
          </button>
        </div>
      </div>

      {isLoading && jobs.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white border border-neutral-200">
          <RefreshCw className="w-8 h-8 text-neutral-200 animate-spin mb-4" />
          <p className="text-sm text-neutral-400 italic">Accessing career records...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-20 text-center bg-white border border-neutral-200 border-dashed">
          <Briefcase className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
          <p className="text-neutral-500 italic">No job postings found. Create your first opening.</p>
          <button 
             onClick={() => setIsAddModalOpen(true)}
             className="mt-6 text-[10px] font-bold uppercase tracking-widest text-black border-b border-black pb-1 hover:text-neutral-500 hover:border-neutral-500 transition-all"
          >
            Get Started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map(job => (
            <motion.div 
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-neutral-200 p-6 flex flex-col group hover:shadow-xl hover:shadow-black/5 transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <span className={cn(
                  "px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight",
                  job.status === 'open' ? "bg-green-500 text-white" : "bg-neutral-800 text-white"
                )}>
                  {job.status}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(job)} className="p-2 text-neutral-400 hover:text-black hover:bg-neutral-50 transition-all">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => handleDelete(job.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-light mb-2">{job.title}</h3>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mb-6">{job.role}</p>

              <div className="space-y-3 mt-auto pt-6 border-t border-neutral-50">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <MapPin size={14} /> {job.location}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <DollarSign size={14} /> {job.compensation}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400 italic">
                  <Clock size={14} /> Posted {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl p-8 lg:p-12 relative my-8"
            >
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-8 right-8 text-neutral-400 hover:text-black transition-colors"
              >
                <X size={24} />
              </button>

              <h2 className="text-3xl font-light italic mb-8">{selectedJob ? 'Update' : 'Create'} Job Posting</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Position Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Sales & Growth Specialist"
                      value={formData.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setFormData({...formData, title: val, slug});
                      }}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">URL Slug (Auto-generated)</label>
                    <input 
                      type="text"
                      placeholder="e.g. sales-growth-specialist"
                      value={formData.slug}
                      onChange={(e) => setFormData({...formData, slug: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm bg-neutral-50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Role Type</label>
                    <input 
                      type="text"
                      placeholder="e.g. Contract-to-Hire"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Location</label>
                      <input 
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'open' | 'closed'})}
                        className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Application URL</label>
                    <input 
                      type="text"
                      placeholder="Calendly or Form Link"
                      value={formData.apply_url}
                      onChange={(e) => setFormData({...formData, apply_url: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Application Deadline</label>
                    <input 
                      type="datetime-local"
                      value={formData.deadline}
                      onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Compensation Package</label>
                    <textarea 
                      placeholder="Details about salary, benefits..."
                      value={formData.compensation}
                      onChange={(e) => setFormData({...formData, compensation: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm h-24 resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">About the Role</label>
                    <textarea 
                      placeholder="Market the mission..."
                      value={formData.about}
                      onChange={(e) => setFormData({...formData, about: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm h-32 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Responsibilities (One per line)</label>
                    <textarea 
                      placeholder="Lead generation..."
                      value={formData.responsibilities}
                      onChange={(e) => setFormData({...formData, responsibilities: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm h-32 resize-none font-mono text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Requirements (One per line)</label>
                    <textarea 
                      placeholder="Proven track record..."
                      value={formData.requirements}
                      onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                      className="w-full p-4 border border-neutral-200 outline-none focus:border-black text-sm h-32 resize-none font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-12 flex justify-end gap-4">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateOrUpdate}
                  className="bg-black text-white px-12 py-4 text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-neutral-800 transition-all shadow-xl"
                >
                  {selectedJob ? 'Save Changes' : 'Publish Position'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
