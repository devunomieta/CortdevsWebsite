import { useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router";
import { ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ssPublicFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";
import { SplitSubsMark } from "../components/SplitSubsLogo";

// Landed on right after signup (see DashboardLogin.tsx), or reached directly
// by clicking the confirmation link in the email — that link confirms and
// logs the user in on its own (Supabase's redirect carries a session), so
// this page's actual job is only for someone typing the 6-digit code
// instead. `password` (needed only to resend, since Supabase's admin
// generateLink API requires it either way) rides in router state from the
// signup form — never the URL, and gone if this page is reached by refresh
// or the email link, which is why resend is hidden without it.
export function VerifyOtp() {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") || "";
    const redirect = searchParams.get("redirect") || "/dashboard";
    const password = (location.state as { password?: string } | null)?.password;

    const [otp, setOtp] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
            if (error) throw error;
            if (data.session) navigate(redirect);
        } catch (err: any) {
            showToast(err.message || "That code didn't work — check it and try again.", "error");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!password) return;
        setIsResending(true);
        try {
            await ssPublicFetch("/api/splitsubs/signup", { method: "POST", body: JSON.stringify({ action: "resend", email, password }) });
            showToast("New code sent — check your email.", "success");
        } catch (err: any) {
            showToast(err.message || "Could not resend the code.", "error");
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="bg-background min-h-screen flex flex-col justify-center items-center p-6">
            <SEO title="Confirm Your Email" description="Enter the code we sent you to activate your SplitSubs account." path="/dashboard/verify" noindex />
            <div className="w-full max-w-md border border-border p-8 lg:p-10 bg-card space-y-8">
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                        <SplitSubsMark className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-light tracking-tight">Check your email</h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Enter the code we sent to {email || "your email"}</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">6-digit code</label>
                        <input
                            required
                            inputMode="numeric"
                            pattern="\d{6}"
                            maxLength={6}
                            autoFocus
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                            placeholder="000000"
                            className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-center text-2xl tracking-[0.5em] font-mono"
                        />
                    </div>
                    <button type="submit" disabled={isVerifying || otp.length !== 6} className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isVerifying ? <RefreshCw size={16} className="animate-spin" /> : <>Confirm Account <ShieldCheck size={14} /></>}
                    </button>
                </form>

                <div className="pt-4 border-t border-border text-center space-y-3">
                    {password ? (
                        <button onClick={handleResend} disabled={isResending} className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50">
                            {isResending ? <RefreshCw size={12} className="animate-spin" /> : <ArrowRight size={12} />} Resend code
                        </button>
                    ) : (
                        <p className="text-xs text-muted-foreground">Lost the code? <Link to="/dashboard/login" className="text-foreground font-medium">Sign up again</Link> to get a fresh one.</p>
                    )}
                    <div>
                        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">← Back to SplitSubs</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
