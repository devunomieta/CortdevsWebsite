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
import { useConfig } from '../../app/context/ConfigContext';

const CORTDEVS_SEAL_SVG_MARKUP = `<svg width="480" height="480" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="cdSealTopArcPdf" d="M 19,60 A 41,41 0 1,1 101,60" />
    <path id="cdSealBottomArcPdf" d="M 13.5,60 A 46.5,46.5 0 0,0 106.5,60" />
  </defs>
  <circle cx="60" cy="60" r="56" stroke="#030213" stroke-width="2.2" stroke-dasharray="3 2.2" fill="#fafafa" />
  <circle cx="60" cy="60" r="51" stroke="#030213" stroke-width="1.5" fill="none" />
  <circle cx="60" cy="60" r="32" stroke="#030213" stroke-width="1.2" fill="#030213" />
  <circle cx="60" cy="60" r="28" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.4" fill="none" />
  <text fill="#030213" font-size="7.4" font-weight="700" letter-spacing="2.2" font-family="Inter, Arial, Helvetica, sans-serif">
    <textPath href="#cdSealTopArcPdf" startOffset="50%" text-anchor="middle">CORTDEVS · VERIFIED</textPath>
  </text>
  <text fill="#030213" font-size="7.2" font-weight="700" letter-spacing="2.2" font-family="Inter, Arial, Helvetica, sans-serif">
    <textPath href="#cdSealBottomArcPdf" startOffset="50%" text-anchor="middle">OFFICIAL SEAL</textPath>
  </text>
  <text x="60" y="67" text-anchor="middle" fill="#ffffff" font-size="24" font-weight="700" letter-spacing="1.5" font-family="Georgia, 'Times New Roman', serif">CD</text>
</svg>`;

interface LoadedRasterImage {
    dataUrl: string;
    width: number;
    height: number;
}

async function rasterizeImageUrlToPng(src: string, scale = 2): Promise<LoadedRasterImage | null> {
    if (!src) return null;
    let objectUrl: string | null = null;
    try {
        // Fetch as blob first so CORS/SVG/WebP assets convert cleanly to PNG on canvas
        const res = await fetch(src, { mode: 'cors' });
        if (!res.ok) return null;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = objectUrl!;
        });

        const natW = img.naturalWidth || img.width || 240;
        const natH = img.naturalHeight || img.height || 80;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(natW * scale));
        canvas.height = Math.max(1, Math.round(natH * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return { dataUrl: canvas.toDataURL('image/png'), width: natW, height: natH };
    } catch {
        return null;
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}

async function rasterizeSvgMarkupToPng(svgMarkup: string, pxSize = 480): Promise<string | null> {
    try {
        const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = reject;
            el.src = encoded;
        });
        const canvas = document.createElement('canvas');
        canvas.width = pxSize;
        canvas.height = pxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, pxSize, pxSize);
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

export function LearnCertificate() {
    const { config } = useConfig();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any | null>(null);
    const [recipientName, setRecipientName] = useState('');
    const [confirmingName, setConfirmingName] = useState(false);
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

    const handleRequestConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (recipientName.trim().length < 2) {
            setError('Please enter your full name (at least 2 characters).');
            return;
        }
        setConfirmingName(true);
    };

    const handleConfirmIssue = async () => {
        setIssuing(true);
        setError(null);
        try {
            const res = await learnApi('lms/certificate', {
                method: 'POST',
                body: { recipientName: recipientName.trim(), confirmed: true },
            });
            setData((prev: any) => ({
                ...prev,
                nameLocked: res.nameLocked ?? prev?.nameLocked,
                certificate: res.certificate,
            }));
            setConfirmingName(false);
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
            const logoUrl =
                config.headerLogo && config.headerLogo !== '/logo-dark.svg' ? config.headerLogo : '';

            const [{ default: jsPDF }, logoImg, sigImg, sealPng, pdfQrDataUrl] = await Promise.all([
                import('jspdf'),
                logoUrl ? rasterizeImageUrlToPng(logoUrl, 3) : Promise.resolve(null),
                rasterizeImageUrlToPng('/learn-ju-sign.png', 2),
                rasterizeSvgMarkupToPng(CORTDEVS_SEAL_SVG_MARKUP, 480),
                qrDataUrl
                    ? Promise.resolve(qrDataUrl)
                    : QRCode.toDataURL(cert.verify_url, {
                          width: 240,
                          margin: 1,
                          color: { dark: '#030213', light: '#ffffff' },
                          errorCorrectionLevel: 'M',
                      }),
            ]);

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth(); // 297mm
            const h = doc.internal.pageSize.getHeight(); // 210mm

            // 1. White canvas + Preview-matched crisp double frame (dark outer, subtle gray inner)
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, w, h, 'F');
            doc.setDrawColor(3, 2, 19);
            doc.setLineWidth(1.5);
            doc.rect(9, 9, w - 18, h - 18);
            doc.setDrawColor(212, 212, 216);
            doc.setLineWidth(0.35);
            doc.rect(12, 12, w - 24, h - 24);

            // 2. Clean White Header (CortDevs logo | LEARN on left, monospace ID on right + bottom divider)
            const contentLeft = 24;
            const contentRight = w - 24;
            const headerBaselineY = 26.5;

            let learnDividerX = contentLeft + 27;
            if (logoImg) {
                const targetLogoH = 7.4;
                const targetLogoW = Math.min(44, (logoImg.width / Math.max(1, logoImg.height)) * targetLogoH);
                doc.addImage(logoImg.dataUrl, 'PNG', contentLeft, headerBaselineY - targetLogoH + 1.4, targetLogoW, targetLogoH);
                learnDividerX = contentLeft + targetLogoW + 3.5;
            } else {
                doc.setTextColor(3, 2, 19);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(16);
                doc.text('Cort', contentLeft, headerBaselineY);
                const cortW = doc.getTextWidth('Cort');
                doc.setFont('helvetica', 'bolditalic');
                doc.text('Devs', contentLeft + cortW, headerBaselineY);
                learnDividerX = contentLeft + cortW + doc.getTextWidth('Devs') + 3.5;
            }

            doc.setDrawColor(212, 212, 216);
            doc.setLineWidth(0.3);
            doc.line(learnDividerX, headerBaselineY - 4.4, learnDividerX, headerBaselineY + 1.0);

            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.text('LEARN', learnDividerX + 3.5, headerBaselineY - 0.8, { charSpace: 1.8 });

            doc.setTextColor(115, 115, 115);
            doc.setFont('courier', 'normal');
            doc.setFontSize(8.5);
            doc.text(`ID: ${cert.certificate_code}`, contentRight, headerBaselineY - 0.6, { align: 'right' });

            // Subtle header divider line
            doc.setDrawColor(229, 229, 229);
            doc.setLineWidth(0.3);
            doc.line(contentLeft, 33.5, contentRight, 33.5);

            // 3. Certificate Title Block (mathematically centered tracked heading)
            const subtitle = 'CERTIFICATE OF COMPLETION';
            const subtitleTrack = 1.4;
            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            const subtitleTotalW = doc.getTextWidth(subtitle) + (subtitle.length - 1) * subtitleTrack;
            doc.text(subtitle, w / 2 - subtitleTotalW / 2, 48, { charSpace: subtitleTrack });

            const cleanTitle = String(cert.program_title || 'AI Product Management')
                .replace(/\s*Training\s*Cohort\s*$/i, '')
                .trim();

            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20.5);
            doc.text(cleanTitle, w / 2, 59.5, { align: 'center' });

            // 4. Recipient Block
            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.8);
            doc.text('This certifies that', w / 2, 73, { align: 'center' });

            const nameStr = String(cert.recipient_name || '').trim();
            doc.setTextColor(3, 2, 19);
            doc.setFont('times', 'bolditalic');
            const nameFontSize = nameStr.length > 34 ? 24 : nameStr.length > 26 ? 28 : 33;
            doc.setFontSize(nameFontSize);
            doc.text(nameStr, w / 2, 88.5, { align: 'center' });

            // Short centered subtle divider under name (matches preview w-40)
            doc.setDrawColor(212, 212, 216);
            doc.setLineWidth(0.35);
            doc.line(w / 2 - 22, 95, w / 2 + 22, 95);

            // 5. Attribution Body (exact same text as preview)
            const attributionCopy =
                cert.attribution_note ||
                `Completed the 12-week CortDevs AI Product Management program guided by Microsoft AI Product Manager study materials (covering Enterprise Product Management, Market Research, AI Product Strategy & Roadmapping, UX/UI Design, and Post-Launch AI Operations), independently managed, tracked, and verified by CortDevs.`;

            doc.setTextColor(82, 82, 82);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const bodyLines = doc.splitTextToSize(attributionCopy, 196);
            doc.text(bodyLines, w / 2, 106, { align: 'center', lineHeightFactor: 1.6 });

            // 6. Balanced 3-Column Executive Footer (matching preview exactly)
            const lineY = 160;
            const colRuleHalfW = 29; // 58mm wide horizontal rule per side column

            // Column 1 (Left): Program Manager Handwritten Signature
            const leftCenterX = 65;
            if (sigImg) {
                const sigH = 18;
                const sigW = (sigImg.width / Math.max(1, sigImg.height)) * sigH;
                doc.addImage(sigImg.dataUrl, 'PNG', leftCenterX - sigW / 2, lineY - sigH - 1.5, sigW, sigH);
            } else {
                doc.setTextColor(3, 2, 19);
                doc.setFont('times', 'italic');
                doc.setFontSize(15);
                doc.text(cert.issued_by_name || 'Joseph Unomieta', leftCenterX, lineY - 4, { align: 'center' });
            }
            doc.setDrawColor(163, 163, 163);
            doc.setLineWidth(0.35);
            doc.line(leftCenterX - colRuleHalfW, lineY, leftCenterX + colRuleHalfW, lineY);
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.2);
            doc.text(cert.issued_by_name || 'Joseph Unomieta', leftCenterX, lineY + 5.6, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.2);
            doc.setTextColor(115, 115, 115);
            doc.text(cert.issued_by_title || 'Program Manager, CortDevs', leftCenterX, lineY + 10.6, { align: 'center' });

            // Column 2 (Center): Exact CortDevs Curved-Text Official CD Seal
            const sealSizeMm = 30.5;
            const sealCenterX = w / 2;
            const sealCenterY = lineY - 4;
            if (sealPng) {
                doc.addImage(
                    sealPng,
                    'PNG',
                    sealCenterX - sealSizeMm / 2,
                    sealCenterY - sealSizeMm / 2,
                    sealSizeMm,
                    sealSizeMm,
                );
            } else {
                doc.setDrawColor(3, 2, 19);
                doc.setLineWidth(0.7);
                doc.circle(sealCenterX, sealCenterY, 14.5, 'S');
                doc.setFillColor(3, 2, 19);
                doc.circle(sealCenterX, sealCenterY, 8.8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('times', 'bold');
                doc.setFontSize(13);
                doc.text('CD', sealCenterX, sealCenterY + 1.6, { align: 'center' });
            }

            // Column 3 (Right): QR Code (left) + Date Issued (right) above rule, Code & URL below rule
            const rightCenterX = w - 65;
            const qrBoxSize = 18.5;
            const qrX = rightCenterX - 24;
            const qrY = lineY - qrBoxSize - 3;

            if (pdfQrDataUrl) {
                doc.setDrawColor(229, 229, 229);
                doc.setLineWidth(0.3);
                doc.setFillColor(255, 255, 255);
                doc.rect(qrX, qrY, qrBoxSize, qrBoxSize, 'FD');
                doc.addImage(pdfQrDataUrl, 'PNG', qrX + 0.7, qrY + 0.7, qrBoxSize - 1.4, qrBoxSize - 1.4);
            }

            const dateTextX = qrX + qrBoxSize + 3.8;
            const issuedStr = new Date(cert.issued_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.text('DATE ISSUED', dateTextX, qrY + 5.2, { charSpace: 0.4 });
            doc.setTextColor(3, 2, 19);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.2);
            doc.text(issuedStr, dateTextX, qrY + 10.4);
            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text('Scan QR to verify', dateTextX, qrY + 15.2);

            doc.setDrawColor(163, 163, 163);
            doc.setLineWidth(0.35);
            doc.line(rightCenterX - colRuleHalfW, lineY, rightCenterX + colRuleHalfW, lineY);

            doc.setTextColor(23, 23, 23);
            doc.setFont('courier', 'bold');
            doc.setFontSize(8.5);
            doc.text(cert.certificate_code, rightCenterX, lineY + 5.6, { align: 'center' });
            doc.setTextColor(115, 115, 115);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('learn.cortdevs.com/verify', rightCenterX, lineY + 10.6, { align: 'center' });

            // 7. Bottom Subtle Divider + Legal Disclaimer
            doc.setDrawColor(245, 245, 245);
            doc.setLineWidth(0.3);
            doc.line(contentLeft, 181, contentRight, 181);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.2);
            doc.setTextColor(163, 163, 163);
            doc.text(
                cert.disclaimer ||
                    'Issued independently by CortDevs for verified internal cohort completion. Not affiliated with, sponsored by, or officially certified by Microsoft or Coursera.',
                w / 2,
                188,
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

            {/* Name Confirmation / Issue Form (Permanently Locked Once Issued for Learners) */}
            {canIssue ? (
                cert && data?.nameLocked ? (
                    <div className="bg-white border border-neutral-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 text-left">
                        <div className="flex items-start gap-2.5">
                            <Lock className="w-4 h-4 text-neutral-700 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-900">
                                    Certificate Name Permanently Locked: <span className="normal-case font-semibold">{cert.recipient_name}</span>
                                </div>
                                <p className="text-xs text-neutral-500">
                                    To prevent duplicate certificates, names cannot be changed after issuance. Contact your CortDevs Program Manager if you need a legal name correction.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleRequestConfirm} className="bg-white border border-neutral-200 p-5 sm:p-6 space-y-4 text-left">
                        {data?.isAdminPreview && (
                            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-left">
                                <strong>Admin Preview Mode:</strong> As an administrator, you can preview and test certificate generation anytime. Regular learners unlock this only at 100% completion + all projects approved, and their name locks permanently once issued.
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-700">
                                Full Name on Certificate
                            </label>
                            <p className="text-xs text-neutral-500">
                                Double-check spelling carefully — once generated, your certificate name is permanently locked.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                <input
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={120}
                                    disabled={confirmingName || issuing}
                                    value={recipientName}
                                    onChange={(e) => setRecipientName(e.target.value)}
                                    placeholder="Enter your full legal name"
                                    className="flex-1 bg-white border border-neutral-300 disabled:bg-neutral-100 px-3.5 py-2.5 text-base sm:text-sm text-neutral-950 focus:outline-none focus:border-neutral-950"
                                />
                                {!confirmingName && (
                                    <button
                                        type="submit"
                                        disabled={issuing}
                                        className="px-6 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.16em] shrink-0"
                                    >
                                        {cert ? 'Update Name' : 'Generate Certificate'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {confirmingName && (
                            <div className="bg-amber-50 border border-amber-300 p-4 space-y-3">
                                <div className="text-xs font-bold uppercase tracking-[0.14em] text-amber-950">
                                    Confirm Certificate Name Spelling
                                </div>
                                <p className="text-xs text-amber-900 leading-relaxed">
                                    Your certificate will be permanently issued in the name:
                                </p>
                                <div className="bg-white border border-amber-200 px-4 py-3 text-center text-xl font-serif italic font-bold text-[#030213]">
                                    {recipientName.trim()}
                                </div>
                                <p className="text-[11px] text-amber-900 leading-relaxed">
                                    Once generated, this name is <strong>permanently locked</strong> and cannot be edited to generate another certificate. Is this spelling 100% final?
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        type="button"
                                        disabled={issuing}
                                        onClick={handleConfirmIssue}
                                        className="px-5 py-2.5 bg-[#030213] hover:bg-neutral-800 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-[0.15em]"
                                    >
                                        {issuing ? 'Generating...' : 'Yes, Lock Name & Generate'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={issuing}
                                        onClick={() => setConfirmingName(false)}
                                        className="px-4 py-2.5 bg-white border border-neutral-300 hover:border-neutral-950 text-xs font-bold uppercase tracking-[0.14em] text-neutral-800"
                                    >
                                        Edit Name
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                )
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
