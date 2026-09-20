import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { Mail, Lock, ArrowRight, RefreshCw, Eye, EyeOff, Layers } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../app/components/Toast";

// Hosts and joiners are real Supabase Auth users (unlike the Events portal's
// per-credential token scheme) — anyone can self-register to either join a
// seat or list one.
export function DashboardLogin() {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get("redirect") || "/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            if (mode === "signup") {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                if (data.session) {
                    navigate(redirect);
                } else {
                    showToast("Check your email to confirm your account, then sign in.", "success");
                    setMode("signin");
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (data.session) navigate(redirect);
            }
        } catch (err: any) {
            showToast(err.message || "Something went wrong.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6">
            <Helmet><title>{mode === "signin" ? "Sign In" : "Sign Up"} | SplitSubs</title></Helmet>
            <div className="w-full max-w-md border border-border p-8 lg:p-10 bg-card space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <Layers size={24} />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">SplitSubs Dashboard</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                            <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <>{mode === "signin" ? "Sign In" : "Create Account"} <ArrowRight size={14} /></>}
                    </button>
                </form>

                <div className="pt-4 border-t border-border text-center space-y-3">
                    <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
                    </button>
                    <div>
                        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">← Back to SplitSubs</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
