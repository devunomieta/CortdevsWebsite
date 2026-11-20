import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
    Award,
    Check,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    Loader2,
    Lock,
    ShieldCheck,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import { CortDevsLearnLogo } from '../components/BrandLogos';

export function LearnCertificate() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [recipientName, setRecipientName] = useState('');
    const [issuing, setIssuing] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCert = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await learnApi('lms/certificate');
            setData(res);
            setRecipientName(res.certificate?.recipient_name || res.defaultName || '');
        } catch (err: any) {
            setError(err?.message || 'Unable to load certificate status.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCert();
    }, []);

    const handleIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        setIssuing(true);
        setError(null);
        try {
            const res = await learnApi('lms/certificate', {
                method: 'POST',
                body: { recipientName: recipientName.trim() },
            });
            setData((prev: any) => ({ ...prev, certificate: res.certificate }));
        } catch (err: any) {
            setError(err?.message || 'Could not generate certificate.');
        } finally {
            setIssuing(false);
        }
    };

    const handleCopyVerifyUrl = async () => {
        const url = data?.certificate?.verify_url;
        if (!url) return;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
    };

    const handleDownloadPdf = async () => {
        const cert = data?.certificate;
        if (!cert) return;
        setDownloading(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth(); // 297mm
            const h = doc.internal.pageSize.getHeight(); // 210mm

            // Background + editorial CortDevs double obsidian border
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, w, h, 'F');
            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(2.2);
            doc.rect(10, 10, w - 20, h - 20);
            doc.setLineWidth(0.4);
            doc.setDrawColor(161, 161, 170);
            doc.rect(14, 14, w - 28, h - 28);

            // Top dark obsidian header strip
            doc.setFillColor(3, 2, 19);
            doc.rect(14, 14, w - 28, 22, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('CORTDEVS  ·  LEARN', 24, 27);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(`VERIFICATION ID: ${cert.certificate_code}`, w - 24, 27, { align: 'right' });

            // Certificate Headline
            doc.setTextColor(113, 113, 122);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text('CERTIFICATE OF COMPLETION', w / 2, 54, { align: 'center' });

            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.text(cert.program_title || 'AI Product Management Training Cohort', w / 2, 66, { align: 'center' });

            // Presented to
            doc.setTextColor(113, 113, 122);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.text('This certifies that', w / 2, 82, { align: 'center' });

            doc.setTextColor(3, 2, 19);
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(34);
            doc.text(cert.recipient_name, w / 2, 98, { align: 'center' });

            // Divider under name
            doc.setDrawColor(212, 212, 216);
            doc.setLineWidth(0.5);
            doc.line(w / 2 - 55, 104, w / 2 + 55, 104);

            // Description + nominative attribution
            doc.setTextColor(63, 63, 70);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const bodyLines = doc.splitTextToSize(
                `has successfully completed the 12-Week CortDevs AI Product Management Training Cohort (${cert.total_lessons} lessons · ${cert.total_projects} applied product projects${cert.avg_quiz_score ? ` · ${cert.avg_quiz_score}% avg assessment score` : ''}), guided by Microsoft AI Product Manager study materials and independently managed, tracked, and verified by CortDevs.`,
                215,
            );
            doc.text(bodyLines, w / 2, 115, { align: 'center', lineHeightFactor: 1.5 });

            // Signature & Issue Date Row
            const sigY = 156;
            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(0.4);
            doc.line(28, sigY, 108, sigY);
            doc.line(w - 108, sigY, w - 28, sigY);

            doc.setTextColor(3, 2, 19);
            doc.setFont('times', 'italic');
            doc.setFontSize(16);
            doc.text(cert.issued_by_name || 'Joseph Unomieta', 68, sigY - 3, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text(cert.issued_by_name || 'Joseph Unomieta', 68, sigY + 6, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(113, 113, 122);
            doc.text(cert.issued_by_title || 'Program Manager, CortDevs', 68, sigY + 11, { align: 'center' });

            const issuedStr = new Date(cert.issued_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(issuedStr, w - 68, sigY - 3, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(113, 113, 122);
            doc.text('Date Issued', w - 68, sigY + 6, { align: 'center' });
            doc.text(`Verify at: ${cert.verify_url}`, w - 68, sigY + 11, { align: 'center' });

            // Non-affiliation legal disclaimer footer
            doc.setFontSize(7.2);
            doc.setTextColor(140, 140, 150);
            doc.text(
                cert.disclaimer ||
                    'Issued independently by CortDevs for verified internal cohort completion. Not affiliated with, sponsored by, or officially certified by Microsoft or Coursera.',
                w / 2,
                h - 19,
                { align: 'center' },
            );

            doc.save(`CortDevs-Certificate-${cert.certificate_code}.pdf`);
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="py-20 flex items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-950" />
                <span className="text-xs uppercase tracking-[0.2em]">Checking certificate status...</span>
            </div>
        );
    }

    const eligibility = data?.eligibility;
    const cert = data?.certificate;
    const canIssue = Boolean(data?.canIssue);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-light tracking-tight text-neutral-950 flex items-center gap-2.5">
                    <Award className="w-6 h-6 text-neutral-900" />
                    Course <span className="font-semibold">Certificate</span>
                </h1>
                <p className="text-sm text-neutral-500 text-left">
                    Complete all course lessons and get your projects approved to generate your official, publicly verifiable CortDevs certificate.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Eligibility Checklist */}
            {eligibility && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-neutral-200 p-4 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                                Course Lessons
                            </div>
                            <div className="text-lg font-semibold text-neutral-950 mt-0.5">
                                {eligibility.completedLessons} / {eligibility.totalLessons} completed
                            </div>
                        </div>
                        {eligibility.completedLessons >= eligibility.totalLessons && eligibility.totalLessons > 0 ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        ) : (
                            <Lock className="w-5 h-5 text-neutral-400 shrink-0" />
                        )}
                    </div>

                    <div className="bg-white border border-neutral-200 p-4 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                                Approved Projects
                            </div>
                            <div className="text-lg font-semibold text-neutral-950 mt-0.5">
                                {eligibility.approvedProjects} / {eligibility.totalProjects} approved
                            </div>
                        </div>
                        {eligibility.approvedProjects >= eligibility.totalProjects && eligibility.totalProjects > 0 ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        ) : (
                            <Lock className="w-5 h-5 text-neutral-400 shrink-0" />
                        )}
                    </div>
                </div>
            )}

            {/* Name Confirmation / Issue Form */}
            {canIssue ? (
                <form onSubmit={handleIssue} className="bg-white border border-neutral-200 p-5 sm:p-6 space-y-4">
                    {data?.isAdminPreview && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2.5">
                            <strong>Admin Preview Mode:</strong> As an administrator, you can preview and test certificate generation even before completing all lessons. Regular learners unlock this only at 100% completion + all projects approved.
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                            Full Name on Certificate
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                required
                                minLength={2}
                                maxLength={120}
                                value={recipientName}
                                onChange={(e) => setRecipientName(e.target.value)}
                                placeholder="Enter your full legal name"
                                className="flex-1 bg-white border border-neutral-300 px-3.5 py-2.5 text-base sm:text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                            />
                            <button
                                type="submit"
                                disabled={issuing}
                                className="px-6 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.16em] shrink-0"
                            >
                                {issuing ? 'Generating...' : cert ? 'Update Name' : 'Generate Certificate'}
                            </button>
                        </div>
                    </div>
                </form>
            ) : (
                <div className="bg-white border border-neutral-200 p-6 space-y-3 text-left">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-950">
                        <Lock className="w-4 h-4 text-neutral-500" />
                        <span>Certificate Locked Until Completion</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                        Finish every lesson in the course and have all {eligibility?.totalProjects || 12} hands-on projects approved by your team lead to unlock your verifiable CortDevs certificate.
                    </p>
                    <Link
                        to="/dashboard"
                        className="inline-block px-4 py-2.5 bg-[#030213] text-white text-xs font-bold uppercase tracking-[0.16em]"
                    >
                        Back to Course Lessons
                    </Link>
                </div>
            )}

            {/* Issued Certificate Visual Preview + Download & Verification Actions */}
            {cert && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Verified ID: {cert.certificate_code}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button
                                onClick={handleCopyVerifyUrl}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-900"
                            >
                                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Link Copied' : 'Copy Verify Link'}
                            </button>
                            <Link
                                to={`/verify/${cert.certificate_code}`}
                                target="_blank"
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-900"
                            >
                                Verify Page <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={downloading}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.16em]"
                            >
                                <Download className="w-4 h-4" />
                                {downloading ? 'Preparing PDF...' : 'Download PDF'}
                            </button>
                        </div>
                    </div>

                    {/* Visual CortDevs Editorial Certificate Card */}
                    <div className="bg-white border-4 border-[#030213] p-2 shadow-lg">
                        <div className="border border-neutral-300 p-6 sm:p-10 space-y-6 text-center">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200">
                                <CortDevsLearnLogo size="sm" />
                                <span className="font-mono text-[11px] text-neutral-500">
                                    ID: {cert.certificate_code}
                                </span>
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">
                                    Certificate of Completion
                                </div>
                                <h2 className="text-xl sm:text-2xl font-semibold text-neutral-950">
                                    {cert.program_title}
                                </h2>
                            </div>

                            <div className="space-y-2 py-2">
                                <p className="text-xs text-neutral-500">This certifies that</p>
                                <div className="text-3xl sm:text-4xl font-serif italic font-bold text-[#030213] break-words">
                                    {cert.recipient_name}
                                </div>
                                <div className="w-40 h-px bg-neutral-300 mx-auto mt-3" />
                            </div>

                            <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
                                {cert.attribution_note}
                            </p>

                            <div className="grid sm:grid-cols-2 gap-6 pt-6 max-w-xl mx-auto">
                                <div className="space-y-1">
                                    <div className="font-serif italic text-xl text-neutral-900">
                                        {cert.issued_by_name}
                                    </div>
                                    <div className="border-t border-neutral-400 pt-1.5 text-xs font-semibold text-neutral-950">
                                        {cert.issued_by_name}
                                    </div>
                                    <div className="text-[11px] text-neutral-500">{cert.issued_by_title}</div>
                                </div>

                                <div className="space-y-1 flex flex-col justify-end">
                                    <div className="text-sm font-semibold text-neutral-950">
                                        {new Date(cert.issued_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                        })}
                                    </div>
                                    <div className="border-t border-neutral-400 pt-1.5 text-xs font-semibold text-neutral-950">
                                        Date Issued
                                    </div>
                                    <div className="text-[11px] text-neutral-500 break-all">{cert.verify_url}</div>
                                </div>
                            </div>

                            <p className="text-[10px] text-neutral-400 pt-4 border-t border-neutral-100 leading-relaxed">
                                {cert.disclaimer}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
