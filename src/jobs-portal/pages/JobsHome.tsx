import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Briefcase, MapPin, ArrowRight, RefreshCw, Clock, DollarSign, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { JobsNavbar } from '../components/JobsNavbar';
import { JobsFooter } from '../components/JobsFooter';
import { SEO } from '../../app/components/SEO';

interface Job {
    id: string;
    slug: string;
    title: string;
    role: string;
    location: string;
    compensation: string;
    about: string;
    status: 'open' | 'closed';
    created_at: string;
    deadline?: string;
}

export function JobsHome() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('All');

    useEffect(() => {
        const fetchJobs = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('careers')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setJobs(data as Job[]);
                }
            } catch (err) {
                console.error('Error fetching jobs:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchJobs();
    }, []);

    const filteredJobs = jobs.filter(j => {
        const matchesSearch = j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.location.toLowerCase().includes(searchTerm.toLowerCase());

        if (selectedDepartment === 'All') return matchesSearch;
        return matchesSearch && j.role.toLowerCase().includes(selectedDepartment.toLowerCase());
    });

    const departments = ['All', 'Sales', 'Engineering', 'Product', 'Operations'];

    return (
        <div className="bg-background min-h-screen flex flex-col">
            <SEO
                title="Careers at CortDevs | Join Our Elite Team"
                description="Explore remote and hybrid career opportunities at CortDevs. Build high-impact web applications with us."
            />
            <JobsNavbar />

            <main className="flex-1 pt-20">
                {/* Hero Section */}
                <section className="py-20 lg:py-28 bg-gradient-to-b from-secondary/50 via-background to-background border-b border-border">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="max-w-3xl"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-[0.25em] mb-6 rounded-full">
                                <Sparkles size={12} /> Remote-First Global Careers
                            </div>
                            <h1 className="text-4xl lg:text-6xl font-light tracking-tight mb-6 leading-tight">
                                Build extraordinary products with <span className="italic font-normal">CortDevs</span>.
                            </h1>
                            <p className="text-lg text-muted-foreground leading-relaxed font-light mb-8">
                                We are looking for ambitious engineers, growth specialists, and builders dedicated to quality and speed.
                            </p>

                            {/* Search & Filter Bar */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 bg-card border border-border p-2 rounded-xl shadow-xl shadow-black/5">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search title, skills, or location..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto p-1">
                                    {departments.map(dept => (
                                        <button
                                            key={dept}
                                            onClick={() => setSelectedDepartment(dept)}
                                            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                                                selectedDepartment === dept
                                                    ? 'bg-primary text-primary-foreground shadow-md'
                                                    : 'text-muted-foreground hover:bg-secondary'
                                            }`}
                                        >
                                            {dept}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Job Vacancy Listings */}
                <section className="py-16 lg:py-24">
                    <div className="max-w-7xl mx-auto px-6 lg:px-8">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-2xl font-light tracking-tight">Open Opportunities</h2>
                                <p className="text-xs text-muted-foreground mt-1">Showing {filteredJobs.length} active position(s)</p>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center border border-border rounded-xl bg-card">
                                <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Vacancies...</p>
                            </div>
                        ) : filteredJobs.length === 0 ? (
                            <div className="py-24 text-center border border-dashed border-border rounded-xl bg-card p-8">
                                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                                <p className="text-lg font-light text-muted-foreground">No openings match your search filter.</p>
                                <button
                                    onClick={() => { setSearchTerm(''); setSelectedDepartment('All'); }}
                                    className="mt-4 text-xs font-bold uppercase tracking-widest text-primary underline"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6">
                                {filteredJobs.map(job => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="group border border-border rounded-xl p-6 lg:p-8 bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="space-y-3 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${
                                                        job.status === 'open'
                                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                        {job.status === 'open' ? 'Active Opening' : 'Closed'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                                                        <MapPin size={12} /> {job.location}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                                                        <DollarSign size={12} /> {job.compensation}
                                                    </span>
                                                </div>

                                                <h3 className="text-xl lg:text-2xl font-normal tracking-tight group-hover:text-primary transition-colors">
                                                    {job.title}
                                                </h3>

                                                <p className="text-sm text-muted-foreground font-light line-clamp-2 leading-relaxed">
                                                    {job.about}
                                                </p>
                                            </div>

                                            <div className="shrink-0">
                                                <Link
                                                    to={`/job/${job.slug || job.id}`}
                                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-md group-hover:translate-x-0.5"
                                                >
                                                    Apply Position <ArrowRight size={14} />
                                                </Link>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            <JobsFooter />
        </div>
    );
}
