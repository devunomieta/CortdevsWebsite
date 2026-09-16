import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { ShieldCheck, Lock, Mail, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../app/components/Toast";

// Admins/staff are Supabase Auth users, same as the main site and jobs-portal
// admin surfaces — see api/_lib/auth.ts's verifyAdmin() for the server-side
// counterpart this login feeds into once the events admin API exists.
export function EventsAdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.session) {
                localStorage.setItem("events_admin_auth", "true");
                showToast("Welcome to the Events admin.", "success");
                navigate("/admin");
            }
        } catch (err: any) {
            showToast(err.message || "Wrong email or password.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6">
            <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
            <div className="w-full max-w-md border border-border p-8 lg:p-10 bg-card space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={26} />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">Events Admin</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                        Cortdevs Staff Access
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Admin Email
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="email"
                                required
                                placeholder="admin@cortdevs.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="password"
                                required
                                placeholder="••••••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" /> Verifying...
                            </>
                        ) : (
                            <>
                                Sign In <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </form>

                <div className="pt-4 border-t border-border text-center">
                    <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                        ← Back to Events Portal
                    </Link>
                </div>
            </div>
        </div>
    );
}
