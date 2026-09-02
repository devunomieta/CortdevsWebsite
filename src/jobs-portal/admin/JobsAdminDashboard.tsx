import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Briefcase, Users, PlusCircle, ArrowRight, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function JobsAdminDashboard() {
    const [vacancyCount, setVacancyCount] = useState(0);
    const [applicantCount, setApplicantCount] = useState(0);
    const [recentJobs, setRecentJobs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            setIsLoading(true);
            try {
                // Count active vacancies
                const { count: vCount } = await supabase
                    .from('careers')
                    .select('*', { count: 'exact', head: true });

                // Count applicants
                const { count: aCount } = await supabase
                    .from('job_applications')
                    .select('*', { count: 'exact', head: true });

                // Recent jobs
                const { data: jobs } = await supabase
                    .from('careers')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);

                setVacancyCount(vCount || 0);
                setApplicantCount(aCount || 0);
                setRecentJobs(jobs || []);
            } catch (err) {
                console.error('Error fetching dashboard stats:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);

    return (
        <div className="space-y-8 max-w-6xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-light tracking-tight">Recruitment Dashboard</h1>
                    <p className="text-xs text-muted-foreground mt-1">Manage active vacancies and candidate applications for jobs.cortdevs.com</p>
                </div>
                <Link
                    to="/admin/vacancies"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-md"
                >
                    <PlusCircle size={14} /> Create Vacancy
                </Link>
            </div>

            {/* Overview Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Job Postings</p>
                        <h2 className="text-4xl font-semibold text-foreground">{vacancyCount}</h2>
                    </div>
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                        <Briefcase size={24} />
                    </div>
                </div>

                <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Candidate Applications</p>
                        <h2 className="text-4xl font-semibold text-foreground">{applicantCount}</h2>
                    </div>
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
                        <Users size={24} />
                    </div>
                </div>
            </div>

            {/* Recent Vacancies */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <h3 className="text-lg font-semibold tracking-tight">Recent Job Openings</h3>
                    <Link to="/admin/vacancies" className="text-xs font-bold uppercase tracking-wider text-primary hover:underline">
                        Manage All →
                    </Link>
                </div>

                {isLoading ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Syncing positions...
                    </div>
                ) : recentJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-6 text-center">No job openings created yet.</p>
                ) : (
                    <div className="divide-y divide-border">
                        {recentJobs.map(job => (
                            <div key={job.id} className="py-4 flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-base font-medium text-foreground">{job.title}</h4>
                                    <p className="text-xs text-muted-foreground font-light">{job.role} • {job.location}</p>
                                </div>
                                <span className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${
                                    job.status === 'open' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {job.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
