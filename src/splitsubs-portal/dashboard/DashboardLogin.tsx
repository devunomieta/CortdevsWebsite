import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Mail, Lock, Phone, ArrowRight, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ssPublicFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";
import { SplitSubsMark } from "../components/SplitSubsLogo";

const CONSENT_VERSION = "v1-2026-09-22";

const HEARD_ABOUT_OPTIONS = [
    { value: "", label: "How did you hear about us? (optional)" },
    { value: "friend_family", label: "Friend or family" },
    { value: "social_media", label: "Social media" },
    { value: "search_engine", label: "Search engine" },
    { value: "whatsapp_group", label: "A WhatsApp group" },
    { value: "influencer", label: "Influencer / blog" },
    { value: "other", label: "Other" },
];

// Hosts and joiners are real Supabase Auth users (unlike the Events portal's
// per-credential token scheme) — anyone can self-register to either join a
// seat or list one.
export function DashboardLogin() {
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [heardAboutUs, setHeardAboutUs] = useState("");
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get("redirect") || "/dashboard";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === "signup" && !consentAccepted) {
            showToast("Please accept the Terms and Privacy Policy to continue.", "error");
            return;
        }
        setIsLoading(true);
        try {
            if (mode === "signup") {
                await ssPublicFetch("/api/splitsubs/signup", {
                    method: "POST",
                    body: JSON.stringify({ email, password, whatsappNumber: whatsappNumber.trim() || undefined, heardAboutUs: heardAboutUs || undefined, consentAccepted, consentVersion: CONSENT_VERSION }),
                });
                // Password travels in router state, not the URL — verify page
                // needs it only to resend the code, and only for this session.
                navigate(`/dashboard/verify?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`, { state: { password } });
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
            <SEO title={mode === "signin" ? "Sign In" : "Sign Up"} description="Sign in or create a free SplitSubs account to join a seat or start earning from your own." path="/dashboard/login" noindex />
            <div className="w-full max-w-md border border-border p-8 lg:p-10 bg-card space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <SplitSubsMark className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">{mode === "signin" ? "Welcome back" : "Let's get you saving"}</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">{mode === "signin" ? "SplitSubs Dashboard" : "Takes less than a minute"}</p>
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

                    {mode === "signup" && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">WhatsApp number (optional)</label>
                                <div className="relative">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                    <input type="tel" placeholder="080..." value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                                </div>
                                <p className="text-xs text-muted-foreground">So we can reach you faster about access, payouts, or disputes.</p>
                            </div>
                            <div className="space-y-1.5">
                                <select value={heardAboutUs} onChange={(e) => setHeardAboutUs(e.target.value)} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm text-muted-foreground">
                                    {HEARD_ABOUT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </div>
                            <label className="flex items-start gap-2.5 text-xs text-muted-foreground cursor-pointer">
                                <input type="checkbox" required checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} className="mt-0.5 accent-primary" />
                                <span>I agree to SplitSubs' <Link to="/terms" target="_blank" className="text-foreground underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-foreground underline">Privacy Policy</Link>, including how escrow and payouts work.</span>
                            </label>
                        </>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <>{mode === "signin" ? "Sign In" : "Create Free Account"} <ArrowRight size={14} /></>}
                    </button>
                </form>

                <div className="pt-4 border-t border-border text-center space-y-3">
                    <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
                        {mode === "signin" ? "New here? Join free and start splitting" : "Already have an account? Sign in"}
                    </button>
                    <div>
                        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">← Back to SplitSubs</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
