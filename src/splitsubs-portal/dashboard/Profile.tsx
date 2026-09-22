import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, ShieldAlert, Clock, Save, IdCard, Mail, Pencil, X, Upload, FileCheck } from "lucide-react";
import { ssFetch } from "../lib/api";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../app/components/Toast";
import { SEO } from "../components/SEO";

const STATUS_META: Record<string, { label: string; icon: any; className: string }> = {
    unsubmitted: { label: "Not submitted", icon: ShieldAlert, className: "text-muted-foreground" },
    pending: { label: "Under review", icon: Clock, className: "text-amber-600" },
    approved: { label: "Verified", icon: ShieldCheck, className: "text-primary" },
    rejected: { label: "Rejected — resubmit below", icon: ShieldAlert, className: "text-destructive" },
};

const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export function Profile() {
    const { showToast } = useToast();
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [legalName, setLegalName] = useState("");
    const [phone, setPhone] = useState("");
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [idNumber, setIdNumber] = useState("");
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [pendingEmail, setPendingEmail] = useState("");
    const [isChangingEmail, setIsChangingEmail] = useState(false);

    const load = () => ssFetch("/api/splitsubs/profile").then((d) => {
        setProfile(d.profile);
        setLegalName(d.profile.legal_name || "");
        setPhone(d.profile.phone || "");
    }).catch(() => { }).finally(() => setIsLoading(false));
    useEffect(() => {
        load();
        supabase.auth.getUser().then(({ data }) => {
            setPendingEmail((data.user as any)?.new_email || "");
        });
    }, []);

    const changeEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsChangingEmail(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
            if (error) throw error;
            showToast("Confirmation links sent to your old and new email — click both to finish the change.", "success");
            setPendingEmail(newEmail.trim());
            setNewEmail("");
            setIsEditingEmail(false);
        } catch (err: any) {
            showToast(err.message || "Could not update email.", "error");
        } finally {
            setIsChangingEmail(false);
        }
    };

    const saveContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingContact(true);
        try {
            await ssFetch("/api/splitsubs/profile", { method: "PATCH", body: JSON.stringify({ legalName, phone }) });
            showToast("Profile updated.", "success");
            load();
        } catch (err: any) {
            showToast(err.message || "Could not update profile.", "error");
        } finally {
            setIsSavingContact(false);
        }
    };

    const handleDocumentChange = (file: File | null) => {
        if (!file) { setDocumentFile(null); return; }
        if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
            showToast("Upload a JPG, PNG, WEBP, or PDF of your NIN slip.", "error");
            return;
        }
        if (file.size > MAX_DOCUMENT_BYTES) {
            showToast("That file is too large — keep it under 3MB.", "error");
            return;
        }
        setDocumentFile(file);
    };

    const submitKyc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!documentFile) { showToast("Upload a photo or scan of your NIN slip.", "error"); return; }
        setIsSubmittingKyc(true);
        try {
            const documentBase64 = await readFileAsDataUrl(documentFile);
            await ssFetch("/api/splitsubs/profile", { method: "POST", body: JSON.stringify({ action: "submit_kyc", legalName, phone, idType: "nin", idNumber, documentBase64 }) });
            showToast("KYC submitted — we'll review it shortly.", "success");
            setIdNumber("");
            setDocumentFile(null);
            load();
        } catch (err: any) {
            showToast(err.message || "Could not submit KYC.", "error");
        } finally {
            setIsSubmittingKyc(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-muted-foreground" size={24} /></div>;

    const status = STATUS_META[profile?.kyc_status || "unsubmitted"];
    const StatusIcon = status.icon;
    const canEditLocked = profile?.kyc_status !== "approved";
    const canSubmitKyc = ["unsubmitted", "rejected"].includes(profile?.kyc_status || "unsubmitted");

    return (
        <div className="max-w-xl mx-auto space-y-8">
            <SEO title="Profile" description="Your SplitSubs profile and identity verification." path="/dashboard/profile" noindex />
            <div>
                <h1 className="text-2xl font-light tracking-tight mb-1">Profile</h1>
                <p className="text-sm text-muted-foreground">Your personal details and ID verification — required before you can add a payout account.</p>
            </div>

            <div className="border border-border p-5 bg-card flex items-center gap-3">
                <StatusIcon size={20} className={status.className} />
                <div>
                    <p className={`text-sm font-medium ${status.className}`}>{status.label}</p>
                    {profile?.kyc_status === "rejected" && profile?.kyc_rejection_reason && (
                        <p className="text-xs text-muted-foreground mt-0.5">Reason: {profile.kyc_rejection_reason}</p>
                    )}
                </div>
            </div>

            <form onSubmit={saveContact} className="space-y-5 border border-border p-6 bg-card">
                <h3 className="font-medium text-sm">Personal details</h3>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Mail size={11} /> Email</label>
                    {isEditingEmail ? (
                        <form onSubmit={changeEmail} className="space-y-2">
                            <div className="flex gap-2">
                                <input required type="email" autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.com" className="flex-1 px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                                <button type="submit" disabled={isChangingEmail} className="px-4 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">
                                    {isChangingEmail ? <RefreshCw size={14} className="animate-spin" /> : "Send"}
                                </button>
                                <button type="button" onClick={() => { setIsEditingEmail(false); setNewEmail(""); }} className="p-3 border border-border hover:bg-secondary" title="Cancel"><X size={14} /></button>
                            </div>
                            <p className="text-xs text-muted-foreground">We'll send confirmation links to both your current and new email — the change applies once you click both.</p>
                        </form>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <input disabled value={profile?.email || ""} className="flex-1 px-4 py-3 bg-secondary border border-border outline-none text-sm opacity-70" />
                                <button type="button" onClick={() => setIsEditingEmail(true)} className="p-3 border border-border hover:bg-secondary" title="Change email"><Pencil size={14} /></button>
                            </div>
                            <p className="text-xs text-muted-foreground">This is what you use to log in.</p>
                            {pendingEmail && <p className="text-xs text-amber-600">Confirmation pending for {pendingEmail} — check both inboxes to finish the change.</p>}
                        </>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full legal name</label>
                    <input required disabled={!canEditLocked} maxLength={200} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As it appears on your NIN" className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm disabled:opacity-60" />
                    {!canEditLocked && <p className="text-xs text-muted-foreground">Locked after KYC approval — contact support if it needs to change.</p>}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone number</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080..." className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm" />
                </div>
                <button type="submit" disabled={isSavingContact} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                    {isSavingContact ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
            </form>

            {canSubmitKyc && (
                <form onSubmit={submitKyc} className="space-y-5 border border-border p-6 bg-card">
                    <div>
                        <h3 className="font-medium text-sm flex items-center gap-2"><IdCard size={16} /> Verify your identity</h3>
                        <p className="text-xs text-muted-foreground mt-1">One-time, reviewed by our team — unlocks adding a payout account and faster settlement. Fill in your legal name above first.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">NIN (11 digits)</label>
                        <input required pattern="\d{11}" maxLength={11} value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))} className="w-full px-4 py-3 bg-background border border-border outline-none focus:border-primary text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Photo or scan of your NIN slip</label>
                        <label className="flex items-center gap-3 border border-dashed border-border p-4 cursor-pointer hover:border-primary transition-colors">
                            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => handleDocumentChange(e.target.files?.[0] || null)} />
                            {documentFile ? (
                                <><FileCheck size={16} className="text-primary shrink-0" /> <span className="text-sm truncate">{documentFile.name}</span> <span className="text-xs text-muted-foreground shrink-0 ml-auto">{(documentFile.size / 1024).toFixed(0)} KB</span></>
                            ) : (
                                <><Upload size={16} className="text-muted-foreground shrink-0" /> <span className="text-sm text-muted-foreground">JPG, PNG, WEBP, or PDF — up to 3MB</span></>
                            )}
                        </label>
                    </div>
                    <button type="submit" disabled={isSubmittingKyc || !legalName.trim() || !documentFile} className="px-6 py-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 flex items-center gap-2">
                        {isSubmittingKyc ? <RefreshCw size={14} className="animate-spin" /> : <IdCard size={14} />} Submit for Review
                    </button>
                </form>
            )}
        </div>
    );
}
