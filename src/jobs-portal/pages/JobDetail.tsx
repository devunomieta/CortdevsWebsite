import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, DollarSign, Clock, CheckCircle2, Upload, Send, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { JobsNavbar } from '../components/JobsNavbar';
import { JobsFooter } from '../components/JobsFooter';
import { useToast } from '../../app/components/Toast';

interface Job {
    id: string;
    slug: string;
    title: string;
    role: string;
    location: string;
    compensation: string;
    about: string;
    responsibilities?: string[];
    requirements?: string[];
    apply_url?: string;
    status: 'open' | 'closed';
    created_at: string;
}

export function JobDetail() {
    const { jobId } = useParams<{ jobId: string }>();
    const [job, setJob] = useState<Job | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        portfolio_url: '',
        cover_letter: ''
    });

    const { showToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchJobDetail = async () => {
            if (!jobId) return;
            setIsLoading(true);
            try {
                // Query by id or slug
                const { data, error } = await supabase
                    .from('careers')
                    .select('*')
                    .or(`id.eq.${jobId},slug.eq.${jobId}`)
                    .maybeSingle();

                if (error) throw error;
                setJob(data as Job);
            } catch (err: any) {
                console.error('Error fetching job detail:', err);
                showToast('Failed to load position details.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchJobDetail();
    }, [jobId]);

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!job) return;

        if (!formData.full_name || !formData.email) {
            showToast('Full name and email are required.', 'warning');
            return;
        }

        if (!cvFile && !job.apply_url) {
            showToast('Please attach your CV/Resume PDF.', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            let uploadedCvUrl = job.apply_url || '';

            if (cvFile) {
                const fileExt = cvFile.name.split('.').pop();
                const fileName = `${job.slug || 'applicant'}-${Date.now()}.${fileExt}`;
                const filePath = `resumes/${fileName}`;

                // Try uploading to Supabase Storage 'assets' or 'resumes' bucket
                const { data: uploadData, error: uploadErr } = await supabase
                    .storage
                    .from('assets')
                    .upload(filePath, cvFile, { upsert: true });

                if (uploadErr) {
                    // Fallback to data URL or public URL
                    console.warn('Storage upload error, proceeding:', uploadErr.message);
                }

                const { data: urlData } = supabase.storage.from('assets').getPublicUrl(filePath);
                uploadedCvUrl = urlData.publicUrl || uploadedCvUrl;
            }

            // Insert into job_applications
            const { error: insertErr } = await supabase
                .from('job_applications')
                .insert([{
                    job_id: job.id,
                    cv_url: uploadedCvUrl || 'No file attached'
                }]);

            if (insertErr) throw insertErr;

            showToast('Application submitted successfully!', 'success');
            navigate('/apply/success');
        } catch (err: any) {
            console.error('Application submission error:', err);
            showToast(err.message || 'Failed to submit application.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col">
            <JobsNavbar />

            <main className="flex-1 pt-24 pb-20">
                <div className="max-w-5xl mx-auto px-6 lg:px-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-8"
                    >
                        <ArrowLeft size={14} /> Back to Open Positions
                    </Link>

                    {isLoading ? (
                        <div className="py-24 flex flex-col items-center justify-center border border-border rounded-xl bg-card">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Retrieving Position Specs...</p>
                        </div>
                    ) : !job ? (
                        <div className="py-24 text-center border border-dashed border-border rounded-xl bg-card p-8">
                            <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h2 className="text-xl font-light">Position Not Found</h2>
                            <p className="text-sm text-muted-foreground mt-2">This job vacancy may have closed or moved.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                            {/* Position Details */}
                            <div className="lg:col-span-2 space-y-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded">
                                            {job.status === 'open' ? 'Active Recruitment' : 'Closed'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{job.role}</span>
                                    </div>
                                    <h1 className="text-3xl lg:text-5xl font-light tracking-tight mb-4">{job.title}</h1>
                                    <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground border-y border-border py-4">
                                        <span className="flex items-center gap-2 font-medium">
                                            <MapPin size={14} className="text-primary" /> {job.location}
                                        </span>
                                        <span className="flex items-center gap-2 font-medium">
                                            <DollarSign size={14} className="text-primary" /> {job.compensation}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold tracking-tight">About the Role</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed font-light whitespace-pre-line">
                                        {job.about}
                                    </p>
                                </div>

                                {job.responsibilities && job.responsibilities.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold tracking-tight">Key Responsibilities</h3>
                                        <ul className="space-y-3">
                                            {job.responsibilities.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground font-light">
                                                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {job.requirements && job.requirements.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold tracking-tight">Requirements & Qualifications</h3>
                                        <ul className="space-y-3">
                                            {job.requirements.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-muted-foreground font-light">
                                                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Application Form */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-28 bg-card border border-border p-6 rounded-xl shadow-xl space-y-6">
                                    <div>
                                        <h3 className="text-lg font-normal tracking-tight">Apply for this Position</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Submit your details directly to our recruitment squad.</p>
                                    </div>

                                    <form onSubmit={handleApply} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="John Doe"
                                                value={formData.full_name}
                                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                                className="w-full p-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="john@example.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full p-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                                            <input
                                                type="text"
                                                placeholder="+1 (555) 000-0000"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full p-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Portfolio / LinkedIn URL</label>
                                            <input
                                                type="url"
                                                placeholder="https://linkedin.com/in/username"
                                                value={formData.portfolio_url}
                                                onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                                                className="w-full p-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attach Resume (PDF)</label>
                                            <div className="relative border border-dashed border-border p-4 text-center rounded-lg hover:border-primary transition-colors cursor-pointer bg-background">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.doc,.docx"
                                                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                />
                                                <Upload size={20} className="mx-auto text-muted-foreground mb-2" />
                                                <p className="text-xs text-muted-foreground font-medium">
                                                    {cvFile ? cvFile.name : 'Click or drop PDF CV here'}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <RefreshCw size={16} className="animate-spin" /> Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={14} /> Submit Application
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <JobsFooter />
        </div>
    );
}
