import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Lock, Mail, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '../../app/components/Toast';

export function JobsAdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (data.session) {
                localStorage.setItem('jobs_admin_auth', 'true');
                showToast('Authentication granted to Jobs Admin.', 'success');
                navigate('/admin');
            }
        } catch (err: any) {
            console.error('Jobs Admin Login Error:', err);
            showToast(err.message || 'Invalid credentials.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6">
            <div className="w-full max-w-md bg-card border border-border p-8 lg:p-10 rounded-2xl shadow-2xl space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">Jobs Command Portal</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Recruiter & Executive Access</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Admin Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="email"
                                required
                                placeholder="admin@cortdevs.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Access Key / Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="password"
                                required
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" /> Verifying Credentials...
                            </>
                        ) : (
                            <>
                                Authenticate Recruiter <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </form>

                <div className="pt-4 border-t border-border text-center">
                    <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                        ← Back to Public Careers Board
                    </Link>
                </div>
            </div>
        </div>
    );
}
