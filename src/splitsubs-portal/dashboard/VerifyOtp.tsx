import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation, Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { ssPublicFetch } from "../lib/api";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";
import { SplitSubsMark } from "../components/SplitSubsLogo";

const SUCCESS_REDIRECT_DELAY_MS = 1600;

// Full-screen "you're in" moment between a successful verify and actually
// landing in the dashboard — an animated tick (SVG stroke drawn in, not just
// faded in) rather than an instant redirect, so confirming an account
// registers as an actual event instead of the page just silently changing.
function SuccessOverlay() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-6"
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="w-full max-w-sm border border-border bg-card p-10 text-center space-y-4"
            >
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
                    className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto"
                >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                        <motion.path
                            d="M4 12.5l5 5L20 6.5"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
                        />
                    </svg>
                </motion.div>
                <div>
                    <h2 className="text-xl font-medium">Account created!</h2>
                    <p className="text-sm text-muted-foreground mt-1">You're in — taking you to your dashboard...</p>
                </div>
            </motion.div>
        </motion.div>
    );
}

const MIN_LENGTH = 6;
const MAX_LENGTH = 8;

// The conventional per-digit box UI, but the box count isn't fixed — codes
// observed from this flow have come out as either 6 or 8 digits (a Supabase
// project setting, not something generateLink lets us pin per call — see
// signup.ts), so this starts at 6 boxes and grows to 8 as soon as the 6th is
// filled, whether typed or pasted. Growing on length >= MIN rather than
// length > MIN matters: typing the 6th digit is what needs a 7th box to
// advance into next — waiting for length to already exceed 6 is a deadlock,
// since there's nowhere to type a 7th digit until that box exists.
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const boxCount = value.length >= MIN_LENGTH ? MAX_LENGTH : MIN_LENGTH;
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const setDigit = (index: number, char: string) => {
        const digit = char.replace(/\D/g, "").slice(-1);
        const next = value.split("");
        while (next.length < index) next.push("");
        if (digit) {
            next[index] = digit;
            const joined = next.join("").slice(0, MAX_LENGTH);
            onChange(joined);
            // Deferred a frame: focusing box 6 the moment box 5 fills the
            // 6th digit needs that box to actually exist first, and it
            // doesn't yet — boxCount only grows to 8 on React's next render,
            // which hasn't happened yet at this point in the same handler.
            if (index < MAX_LENGTH - 1) requestAnimationFrame(() => inputRefs.current[index + 1]?.focus());
        } else {
            next[index] = "";
            onChange(next.join("").replace(/\s+$/, ""));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, MAX_LENGTH);
        if (!pasted) return;
        onChange(pasted);
        requestAnimationFrame(() => inputRefs.current[Math.min(pasted.length, MAX_LENGTH - 1)]?.focus());
    };

    return (
        <div className="flex justify-center gap-1.5 sm:gap-2">
            {Array.from({ length: boxCount }).map((_, i) => (
                <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    autoFocus={i === 0}
                    value={value[i] || ""}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    // flex-1 + min-w-0 lets every box shrink to actually fit
                    // the row (no wrapping onto a second, off-center line) no
                    // matter the viewport or whether there are 6 or 8 of
                    // them; max-w caps how big they get on a roomy screen.
                    className="flex-1 min-w-0 max-w-12 h-12 sm:h-14 text-center text-xl font-mono bg-background border border-border outline-none focus:border-primary"
                />
            ))}
        </div>
    );
}

// Landed on right after signup (see DashboardLogin.tsx), or reached directly
// by clicking the confirmation link in the email — that link confirms and
// logs the user in on its own (Supabase's redirect carries a session), so
// this page's actual job is only for someone typing the code instead.
// `password` (needed only to resend, since Supabase's admin generateLink API
// requires it either way) rides in router state from the signup form — never
// the URL, and gone if this page is reached by refresh or the email link,
// which is why resend is hidden without it.
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
    const [isSuccess, setIsSuccess] = useState(false);

    // The overlay holds the screen briefly before handing off to the
    // dashboard, rather than navigating the instant the session exists.
    useEffect(() => {
        if (!isSuccess) return;
        const t = setTimeout(() => navigate(redirect), SUCCESS_REDIRECT_DELAY_MS);
        return () => clearTimeout(t);
    }, [isSuccess, navigate, redirect]);

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            // The backend sends a 'signup'-type OTP for a brand-new account,
            // but 'magiclink'-type for a retry/resend against an email that
            // already had an unconfirmed account (see signup.ts) — this page
            // has no way to know which one actually landed in the inbox the
            // user is reading from, so it just tries both rather than
            // needing that tracked correctly through every resend.
            let { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "signup" });
            if (error) {
                ({ data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "magiclink" }));
            }
            if (error) throw error;
            if (data.session) setIsSuccess(true);
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
            setOtp("");
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
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block text-center">Confirmation code</label>
                        <OtpBoxes value={otp} onChange={setOtp} />
                    </div>
                    <button type="submit" disabled={isVerifying || otp.length < MIN_LENGTH} className="w-full py-4 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
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

            <AnimatePresence>{isSuccess && <SuccessOverlay />}</AnimatePresence>
        </div>
    );
}
