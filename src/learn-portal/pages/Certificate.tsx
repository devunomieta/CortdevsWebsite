import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import QRCode from 'qrcode';
import {
    Award,
    Check,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    Loader2,
    Lock,
    QrCode,
    ShieldCheck,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import { CortDevsLearnLogo, CortDevsSealStamp } from '../components/BrandLogos';

async function loadImageAsDataUrl(src: string): Promise<string | null> {
    try {
        const res = await fetch(src);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export function LearnCertificate() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [recipientName, setRecipientName] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
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

    const verifyUrl = data?.certificate?.verify_url as string | undefined;

    useEffect(() => {
        if (!verifyUrl) {
            setQrDataUrl('');
            return;
        }
        QRCode.toDataURL(verifyUrl, {
            width: 240,
            margin: 1,
            color: { dark: '#030213', light: '#ffffff' },
            errorCorrectionLevel: 'M',
        })
            .then((url) => setQrDataUrl(url))
            .catch(() => setQrDataUrl(''));
    }, [verifyUrl]);

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
            const [{ default: jsPDF }, sigDataUrl, pdfQrDataUrl] = await Promise.all([
                import('jspdf'),
                loadImageAsDataUrl('/learn-ju-sign.png'),
                qrDataUrl
                    ? Promise.resolve(qrDataUrl)
                    : QRCode.toDataURL(cert.verify_url, {
                          width: 240,
                          margin: 1,
                          color: { dark: '#030213', light: '#ffffff' },
                      }),
            ]);

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth(); // 297mm
            const h = doc.internal.pageSize.getHeight(); // 210mm

            // Background + CortDevs double obsidian border
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
            doc.rect(14, 14, w - 28, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('CORTDEVS  ·  LEARN', 24, 26.2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.text(`ID: ${cert.certificate_code}`, w - 24, 26.2, { align: 'right' });

            // Certificate Headline
            doc.setTextColor(113, 113, 122);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text('CERTIFICATE OF COMPLETION', w / 2, 50, { align: 'center' });

            const cleanTitle = String(cert.program_title || 'AI Product Management')
                .replace(/\s*Training\s*Cohort\s*$/i, '')
                .trim();

            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(23);
            doc.text(cleanTitle, w / 2, 62, { align: 'center' });

            // Recipient block
            doc.setTextColor(113, 113, 122);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.text('This certifies that', w / 2, 76, { align: 'center' });

            doc.setTextColor(3, 2, 19);
            doc.setFont('times', 'bolditalic');
            doc.setFontSize(34);
            doc.text(cert.recipient_name, w / 2, 92, { align: 'center' });

            doc.setDrawColor(212, 212, 216);
            doc.setLineWidth(0.5);
            doc.line(w / 2 - 55, 98, w / 2 + 55, 98);

            // Attribution body
            doc.setTextColor(63, 63, 70);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.8);
            const bodyLines = doc.splitTextToSize(
                `has successfully completed the 12-week CortDevs AI Product Management program (${cert.total_lessons} lessons · ${cert.total_projects} applied product projects${cert.avg_quiz_score ? ` · ${cert.avg_quiz_score}% avg assessment score` : ''}), guided by Microsoft AI Product Manager study materials and independently managed, tracked, and verified by CortDevs.`,
                216,
            );
            doc.text(bodyLines, w / 2, 108, { align: 'center', lineHeightFactor: 1.5 });

            // === 3-COLUMN EXECUTIVE FOOTER ===
            const lineY = 160;

            // Column 1 (Left): Program Manager Handwritten Signature
            const leftCenterX = 64;
            if (sigDataUrl) {
                // JU-Sign.png aspect ratio is 471x529 (~0.89 w/h) -> 20mm x 22.5mm centered nicely over line
                doc.addImage(sigDataUrl, 'PNG', leftCenterX - 10, lineY - 22, 20, 22.5);
            } else {
                doc.setTextColor(3, 2, 19);
                doc.setFont('times', 'italic');
                doc.setFontSize(15);
                doc.text(cert.issued_by_name || 'Joseph Unomieta', leftCenterX, lineY - 4, { align: 'center' });
            }
            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(0.4);
            doc.line(28, lineY, 100, lineY);
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text(cert.issued_by_name || 'Joseph Unomieta', leftCenterX, lineY + 6, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(113, 113, 122);
            doc.text(cert.issued_by_title || 'Program Manager, CortDevs', leftCenterX, lineY + 11, { align: 'center' });

            // Column 2 (Center): Official CD Seal Stamp
            const sealX = w / 2;
            const sealY = 154;
            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(0.7);
            doc.circle(sealX, sealY, 16.5, 'S');
            doc.setLineWidth(0.35);
            doc.circle(sealX, sealY, 14.5, 'S');
            doc.setFillColor(3, 2, 19);
            doc.circle(sealX, sealY, 9.8, 'F');
            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.25);
            doc.circle(sealX, sealY, 8.6, 'S');
            doc.setTextColor(255, 255, 255);
            doc.setFont('times', 'bold');
            doc.setFontSize(14);
            doc.text('CD', sealX, sealY + 1.8, { align: 'center' });
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.2);
            doc.text('CORTDEVS VERIFIED SEAL', sealX, sealY + 21, { align: 'center' });

            // Column 3 (Right): Date Issued + Scannable QR Code
            const rightBlockLeft = w - 102;
            const issuedStr = new Date(cert.issued_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            if (pdfQrDataUrl) {
                doc.addImage(pdfQrDataUrl, 'PNG', w - 50, lineY - 22, 24, 24);
            }
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.text(issuedStr, rightBlockLeft, lineY - 8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(113, 113, 122);
            doc.text('Date Issued', rightBlockLeft, lineY - 3);

            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(0.4);
            doc.line(rightBlockLeft, lineY, w - 54, lineY);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(3, 2, 19);
            doc.text('SCAN QR TO VERIFY', w - 38, lineY + 6.5, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(113, 113, 122);
            doc.text(cert.certificate_code, rightBlockLeft, lineY + 6.5);
            doc.text('learn.cortdevs.com/verify', rightBlockLeft, lineY + 11);

            // Legal disclaimer footer
            doc.setFontSize(7);
            doc.setTextColor(140, 140, 150);
            doc.text(
                cert.disclaimer ||
                    'Issued independently by CortDevs for verified internal cohort completion. Not affiliated with, sponsored by, or officially certified by Microsoft or Coursera.',
                w / 2,
                h - 18,
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
    const displayProgramTitle = String(cert?.program_title || 'AI Product Management')
        .replace(/\s*Training\s*Cohort\s*$/i, '')
        .trim();

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-light tracking-tight text-neutral-950 flex items-center gap-2.5">
                        <Award className="w-6 h-6 text-neutral-900" />
                        Course <span className="font-semibold">Certificate</span>
                    </h1>
                    <p className="text-sm text-neutral-500 text-left">
                        Complete all lessons and get your projects approved to generate your official, publicly verifiable CortDevs certificate.
                    </p>
                </div>

                <Link
                    to="/verify"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-900 transition"
                >
                    <QrCode className="w-3.5 h-3.5" />
                    QR Scanner
                </Link>
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
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-left">
                            <strong>Admin Preview Mode:</strong> As an administrator, you can preview and test certificate generation anytime. Regular learners unlock this only at 100% completion + all projects approved.
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
                        <div className="border border-neutral-300 p-5 sm:p-10 space-y-6 text-center">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-200">
                                <CortDevsLearnLogo size="sm" />
                                <span className="font-mono text-[11px] text-neutral-500">
                                    ID: {cert.certificate_code}
                                </span>
                            </div>

                            <div className="space-y-2 pt-1">
                                <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-neutral-500">
                                    Certificate of Completion
                                </div>
                                <h2 className="text-xl sm:text-2xl font-semibold text-neutral-950">
                                    {displayProgramTitle}
                                </h2>
                            </div>

                            <div className="space-y-2 py-1">
                                <p className="text-xs text-neutral-500">This certifies that</p>
                                <div className="text-3xl sm:text-4xl font-serif italic font-bold text-[#030213] break-words">
                                    {cert.recipient_name}
                                </div>
                                <div className="w-40 h-px bg-neutral-300 mx-auto mt-3" />
                            </div>

                            <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl mx-auto leading-relaxed">
                                {cert.attribution_note}
                            </p>

                            {/* Balanced 3-Column Footer: Signature | CD Official Seal | Date & Scannable QR */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 items-end gap-8 pt-6 max-w-3xl mx-auto">
                                {/* Left: Program Manager Signature */}
                                <div className="flex flex-col items-center">
                                    <div className="h-16 flex items-end justify-center pb-1">
                                        <img
                                            src="/learn-ju-sign.png"
                                            alt="Joseph Unomieta Signature"
                                            className="h-14 w-auto object-contain"
                                        />
                                    </div>
                                    <div className="w-full max-w-[200px] border-t border-neutral-400 pt-2">
                                        <div className="text-xs font-semibold text-neutral-950">{cert.issued_by_name}</div>
                                        <div className="text-[11px] text-neutral-500">{cert.issued_by_title}</div>
                                    </div>
                                </div>

                                {/* Center: CortDevs CD Official Seal Stamp */}
                                <div className="flex flex-col items-center justify-center">
                                    <CortDevsSealStamp size={96} />
                                </div>

                                {/* Right: Date Issued + Scannable QR Code */}
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center justify-center gap-3 pb-2">
                                        {qrDataUrl && (
                                            <img
                                                src={qrDataUrl}
                                                alt={`QR Code to verify ${cert.certificate_code}`}
                                                className="w-16 h-16 border border-neutral-200 p-0.5 bg-white shrink-0"
                                            />
                                        )}
                                        <div className="text-left space-y-0.5">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                                Date Issued
                                            </div>
                                            <div className="text-xs font-semibold text-neutral-950 whitespace-nowrap">
                                                {new Date(cert.issued_at).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                            <div className="text-[10px] text-neutral-500">Scan QR to verify</div>
                                        </div>
                                    </div>
                                    <div className="w-full max-w-[200px] border-t border-neutral-400 pt-2">
                                        <div className="font-mono text-[11px] font-semibold text-neutral-900">
                                            {cert.certificate_code}
                                        </div>
                                        <div className="text-[10px] text-neutral-500">learn.cortdevs.com/verify</div>
                                    </div>
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
