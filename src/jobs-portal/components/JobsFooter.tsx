import React from 'react';
import { Link } from 'react-router';

export function JobsFooter() {
    return (
        <footer className="bg-card border-t border-border py-12">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center">
                        CD
                    </div>
                    <span>© {new Date().getFullYear()} CortDevs Inc. All rights reserved.</span>
                </div>
                <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-widest">
                    <span>Precision Engineering</span>
                    <span>•</span>
                    <span>Quality Above All</span>
                    <span>•</span>
                    <Link to="/admin/login" className="hover:text-foreground transition-colors">Recruiter Portal</Link>
                </div>
            </div>
        </footer>
    );
}
