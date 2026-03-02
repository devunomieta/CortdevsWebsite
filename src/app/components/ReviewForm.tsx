import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, Shield, User, AlertCircle, CheckCircle2, Globe, Zap, Info, Quote } from "lucide-react";
import { BrandLoader } from "./BrandLoader";
import { useToast } from "./Toast";

interface ReviewFormProps {
    onComplete: () => void;
}

export function ReviewForm({ onComplete }: ReviewFormProps) {
    const { showToast } = useToast();
    const successRef = useRef<HTMLDivElement>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        industry: "",
        highlight: "",
        type: "review" as "review" | "complaint",
        rating: 5,
        message: "",
        impact: "",
        isAnonymous: false,
        website: "" // Honeypot
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Honeypot check
        if (formData.website) {
            setIsSubmitted(true); // Silent discard
            return;
        }

        // 2. Strict Email Validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.email)) {
            showToast("Please provide a valid corporate email address (e.g. name@company.com).", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch('/api/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                let errorMsg = 'Failed to transmit feedback';
                try {
                    const result = await response.json();
                    errorMsg = result.error || errorMsg;
                } catch (jsonErr) {
                    // If response is not JSON, it's likely a Vercel/Server error page
                    const textResponse = await response.text();
                    console.error("Non-JSON error response from server:", textResponse);
                    errorMsg = `Server Error (${response.status}): ${textResponse.slice(0, 100)}...`;
                }
                throw new Error(errorMsg);
            }

            setIsSubmitting(false);
            setIsSubmitted(true);

            // Auto-close after 2.5 seconds
            setTimeout(() => {
                onComplete();
            }, 2500);
        } catch (err: any) {
            console.error("Transmission error:", err);
            showToast(err.message || "Failed to transmit feedback. Please try again.", "error");
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (isSubmitted && successRef.current) {
            successRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [isSubmitted]);

    if (isSubmitted) {
        return (
            <div ref={successRef} id="review-success-box" className="flex flex-col items-center justify-center py-12 px-6 bg-neutral-900 text-white rounded-3xl animate-in zoom-in duration-500 scroll-mt-24">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                >
                    <CheckCircle2 className="w-16 h-16 text-white mb-6" />
                </motion.div>
                <h3 className="text-2xl font-light mb-2 tracking-tight text-center">Submission Received 🚀</h3>
                <p className="text-neutral-400 text-center max-w-sm mb-6 text-sm">
                    Thank you for your valuable feedback. It helps us maintain our standard of excellence.
                </p>
                <div className="w-48 h-[2px] bg-white/10 overflow-hidden">
                    <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "0%" }}
                        transition={{ duration: 2.5, ease: "linear" }}
                        className="h-full bg-white"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-neutral-50 border border-neutral-200 rounded-[2rem] p-8 lg:p-12 shadow-sm overflow-hidden relative">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h2 className="text-3xl font-light text-black tracking-tight mb-2">
                            Voice Your <span className="font-normal italic">Experience</span>
                        </h2>
                        <p className="text-neutral-500 text-[10px] tracking-[0.2em] uppercase">
                            Help us maintain the CortDevs standard.
                        </p>
                    </div>
                    <div className="flex bg-neutral-200/50 p-1 rounded-full w-fit">
                        <button
                            onClick={() => setFormData({ ...formData, type: "review" })}
                            className={`px-8 py-2.5 rounded-full text-[10px] tracking-widest uppercase transition-all duration-300 ${formData.type === "review" ? "bg-black text-white shadow-lg" : "text-neutral-500 hover:text-black"
                                }`}
                        >
                            Review
                        </button>
                        <button
                            onClick={() => setFormData({ ...formData, type: "complaint" })}
                            className={`px-8 py-2.5 rounded-full text-[10px] tracking-widest uppercase transition-all duration-300 ${formData.type === "complaint" ? "bg-black text-white shadow-lg" : "text-neutral-500 hover:text-black"
                                }`}
                        >
                            Complaint
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Identity Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-white border border-neutral-100 rounded-2xl relative">
                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 flex items-center gap-2">
                                <User className="w-3 h-3" /> Full Name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="How should we address you?"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-transparent border-b border-neutral-200 py-2 text-sm focus:border-black outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 flex items-center gap-2">
                                <Globe className="w-3 h-3" /> Email Address
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="For internal follow-up only"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-transparent border-b border-neutral-200 py-2 text-sm focus:border-black outline-none transition-all"
                            />
                        </div>

                        {/* Honeypot - Hidden from humans */}
                        <div className="hidden" aria-hidden="true">
                            <input
                                type="text"
                                name="website"
                                tabIndex={-1}
                                value={formData.website}
                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                autoComplete="off"
                            />
                        </div>
                        <div className="md:col-span-2 flex items-start gap-3 bg-neutral-50 p-4 rounded-xl border border-neutral-100 mt-2">
                            <Shield className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-neutral-500 leading-relaxed">
                                <span className="text-black font-semibold">Privacy Guarantee:</span> Your contact details are collected strictly for internal verification and follow-up.
                                {formData.isAnonymous
                                    ? " As you have selected anonymity, these details will NEVER be displayed or used publicly for any reason."
                                    : " Even in public reviews, we prioritize your data security and confidentiality."}
                            </p>
                        </div>
                    </div>

                    {/* Context Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400">Industry / Sector</label>
                            <input
                                type="text"
                                placeholder="e.g. Fintech, Healthcare, SaaS"
                                value={formData.industry}
                                onChange={e => setFormData({ ...formData, industry: e.target.value })}
                                className="w-full bg-white border border-neutral-200 px-6 py-4 text-sm focus:border-black outline-none transition-all rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400">Primary Highlight</label>
                            <input
                                type="text"
                                placeholder="e.g. Rapid Execution, Scalable Architecture"
                                value={formData.highlight}
                                onChange={e => setFormData({ ...formData, highlight: e.target.value })}
                                className="w-full bg-white border border-neutral-200 px-6 py-4 text-sm focus:border-black outline-none transition-all rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Rating & Preference Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-6 border-y border-neutral-100">
                        {formData.type === "review" ? (
                            <div className="flex items-center gap-6">
                                <span className="text-[10px] tracking-widest uppercase text-neutral-400">Rating</span>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, rating: star })}
                                            className="transition-all hover:scale-110 active:scale-95"
                                        >
                                            <Star
                                                className={`w-7 h-7 ${star <= formData.rating ? "text-black fill-current" : "text-neutral-200"
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-neutral-500 bg-neutral-100 px-4 py-2 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-black" />
                                <span className="text-[11px] font-medium uppercase tracking-wider">High Priority Resolution Support</span>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, isAnonymous: !formData.isAnonymous })}
                            className="flex items-center gap-3 cursor-pointer group"
                        >
                            <div className={`w-10 h-6 rounded-full p-1 transition-all flex items-center ${formData.isAnonymous ? "bg-black" : "bg-neutral-200"
                                }`}>
                                <motion.div
                                    animate={{ x: formData.isAnonymous ? 16 : 0 }}
                                    className="w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                            </div>
                            <span className="text-[10px] tracking-widest uppercase text-neutral-800 font-semibold">Post Anonymously</span>
                        </button>
                    </div>

                    {/* Detailed Content */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 flex items-center gap-2">
                                <Quote className="w-3 h-3" /> Detailed {formData.type === "review" ? "Feedback" : "Concern"}
                            </label>
                            <textarea
                                required
                                rows={3}
                                placeholder={formData.type === "review" ? "Your journey with CortDevs..." : "Please describe your concern precisely..."}
                                value={formData.message}
                                onChange={e => setFormData({ ...formData, message: e.target.value })}
                                className="w-full bg-white border border-neutral-200 p-6 text-sm focus:border-black outline-none transition-all rounded-2xl resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] tracking-widest uppercase text-neutral-400 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> Primary Impact / Result
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Capture the core outcome of this project..."
                                value={formData.impact}
                                onChange={e => setFormData({ ...formData, impact: e.target.value })}
                                className="w-full bg-white border border-neutral-200 p-6 text-sm focus:border-black outline-none transition-all rounded-2xl resize-none"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-black text-white py-7 rounded-2xl flex items-center justify-center gap-4 tracking-[0.3em] uppercase text-xs hover:bg-neutral-800 transition-all disabled:opacity-50 group shadow-2xl shadow-black/20"
                    >
                        {isSubmitting ? (
                            <BrandLoader size="sm" />
                        ) : (
                            <>
                                Confirm Transmission
                                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </>
                        )}
                    </button>
                    {/* Security Tip: Use Port 587 if 465 times out */}
                </form>
            </div>
        </div>
    );
}
