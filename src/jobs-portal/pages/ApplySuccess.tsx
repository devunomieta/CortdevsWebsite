import React from 'react';
import { Link } from 'react-router';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { JobsNavbar } from '../components/JobsNavbar';
import { JobsFooter } from '../components/JobsFooter';

export function ApplySuccess() {
    return (
        <div className="bg-background min-h-screen flex flex-col">
            <JobsNavbar />
            <main className="flex-1 flex items-center justify-center py-32 px-6">
                <div className="max-w-md w-full text-center space-y-6 bg-card border border-border p-10 rounded-2xl shadow-xl">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={36} />
                    </div>
                    <h1 className="text-3xl font-light tracking-tight">Application Transmitted!</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light">
                        Thank you for applying to CortDevs. Our recruitment team is reviewing your profile and credentials. If selected, we will get in touch directly.
                    </p>
                    <div className="pt-4">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-md"
                        >
                            Return to Opportunities <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </main>
            <JobsFooter />
        </div>
    );
}
