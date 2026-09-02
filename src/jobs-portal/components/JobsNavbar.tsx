import React from 'react';
import { Link, useNavigate } from 'react-router';
import { Briefcase, ShieldCheck, User } from 'lucide-react';

export function JobsNavbar() {
    const navigate = useNavigate();

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs tracking-widest uppercase">
                        CD
                    </div>
                    <div>
                        <span className="font-semibold text-lg tracking-tight block">CortDevs Careers</span>
                        <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold block">
                            jobs.cortdevs.com
                        </span>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <Link to="/" className="hover:text-foreground transition-colors">Open Roles</Link>
                    <a href="#culture" className="hover:text-foreground transition-colors">Culture & Benefits</a>
                    <a href="#hiring-process" className="hover:text-foreground transition-colors">Process</a>
                </nav>

                <div className="flex items-center gap-4">
                    <Link
                        to="/admin/login"
                        className="px-4 py-2 border border-border text-[10px] uppercase font-bold tracking-widest hover:border-foreground transition-all flex items-center gap-2"
                    >
                        <ShieldCheck size={14} className="text-primary" />
                        Recruiter Access
                    </Link>
                </div>
            </div>
        </header>
    );
}
