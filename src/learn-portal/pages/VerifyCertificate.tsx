import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    Award,
    Camera,
    CheckCircle2,
    Loader2,
    QrCode,
    Search,
    ShieldAlert,
    ShieldCheck,
    Upload,
    X,
} from 'lucide-react';
import { learnApi } from '../lib/api';
import { CortDevsLearnLogo, CortDevsSealStamp } from '../components/BrandLogos';

function extractCertificateCode(raw: string): string | null {
    const trimmed = raw.trim();
    const urlMatch = trimmed.match(/\/verify\/(CD-[A-Z0-9-]+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();
    const codeMatch = trimmed.match(/\b(CD-[A-Z0-9-]{6,32})\b/i);
    if (codeMatch) return codeMatch[1].toUpperCase();
    return null;
}

export function VerifyCertificate() {
    const { code } = useParams();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(Boolean(code));
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState(code || '');

    // Live camera + image upload QR code scanner state
    const [scanning, setScanning] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const scanningActiveRef = useRef(false);

    const stopScanner = () => {
        scanningActiveRef.current = false;
        if (rafRef.current) {
            window.cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setScanning(false);
    };

    useEffect(() => {
        return () => stopScanner();
    }, []);

    useEffect(() => {
        setManualCode(code || '');
        if (!code) {
            setResult(null);
            setError(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        learnApi(`lms/certificate?code=${encodeURIComponent(code)}`, { auth: false })
            .then((res) => setResult(res))
            .catch((err) => {
                setResult(null);
                setError(err?.message || 'Certificate not found.');
            })
            .finally(() => setLoading(false));
    }, [code]);

    const startScanner = async () => {
        setScannerError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            setScannerError(
                'Camera access is unavailable on this browser or non-HTTPS page. You can upload a QR image or enter the Certificate ID below.',
            );
            return;
        }

        try {
            const BarcodeDetectorCtor = (window as any).BarcodeDetector;
            const [{ default: jsQR }, stream] = await Promise.all([
                BarcodeDetectorCtor ? Promise.resolve({ default: null }) : import('jsqr'),
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' },
                    audio: false,
                }),
            ]);

            streamRef.current = stream;
            scanningActiveRef.current = true;
            setScanning(true);

            window.setTimeout(() => {
                if (!videoRef.current || !scanningActiveRef.current) return;
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => {});

                const detector = BarcodeDetectorCtor ? new BarcodeDetectorCtor({ formats: ['qr_code'] }) : null;
                let lastScanAt = 0;

                const scanFrame = async (now: number) => {
                    if (!scanningActiveRef.current || !videoRef.current || !streamRef.current) return;
                    // Throttle decode to ~6 fps to save CPU/battery on mobile
                    if (now - lastScanAt >= 160 && videoRef.current.readyState >= 2) {
                        lastScanAt = now;
                        try {
                            let rawValue: string | null = null;
                            if (detector) {
                                const barcodes = await detector.detect(videoRef.current);
                                if (barcodes.length > 0) {
                                    rawValue = barcodes[0].rawValue || null;
                                }
                            } else if (jsQR) {
                                const video = videoRef.current;
                                const canvas = canvasRef.current || document.createElement('canvas');
                                canvasRef.current = canvas;
                                const vw = video.videoWidth;
                                const vh = video.videoHeight;
                                if (vw > 0 && vh > 0) {
                                    canvas.width = vw;
                                    canvas.height = vh;
                                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                    if (ctx) {
                                        ctx.drawImage(video, 0, 0, vw, vh);
                                        const imageData = ctx.getImageData(0, 0, vw, vh);
                                        const decoded = jsQR(imageData.data, vw, vh, {
                                            inversionAttempts: 'dontInvert',
                                        });
                                        if (decoded?.data) rawValue = decoded.data;
                                    }
                                }
                            }

                            if (rawValue) {
                                const found = extractCertificateCode(rawValue);
                                if (found) {
                                    stopScanner();
                                    navigate(`/verify/${found}`);
                                    return;
                                }
                            }
                        } catch {
                            // continue scanning next frame
                        }
                    }
                    rafRef.current = window.requestAnimationFrame(scanFrame);
                };
                rafRef.current = window.requestAnimationFrame(scanFrame);
            }, 120);
        } catch (err: any) {
            stopScanner();
            setScannerError(
                err?.message || 'Camera permission was denied. You can upload a QR image or type the Certificate ID below.',
            );
        }
    };

    const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setScannerError(null);

        try {
            const [{ default: jsQR }, bitmap] = await Promise.all([
                import('jsqr'),
                createImageBitmap(file),
            ]);
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Unable to read image.');
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close?.();

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(imgData.data, canvas.width, canvas.height, {
                inversionAttempts: 'attemptBoth',
            });
            const found = decoded?.data ? extractCertificateCode(decoded.data) : null;
            if (!found) {
                setScannerError(
                    'No valid CortDevs certificate QR code was detected in that image. Try cropping closer to the QR code or enter the Certificate ID below.',
                );
                return;
            }
            stopScanner();
            navigate(`/verify/${found}`);
        } catch {
            setScannerError('Could not decode that image. Please upload a PNG/JPG screenshot of the QR code.');
        }
    };

    const handleManualLookup = (e: React.FormEvent) => {
        e.preventDefault();
        const found = extractCertificateCode(manualCode) || manualCode.trim().toUpperCase();
        if (!found) return;
        navigate(`/verify/${encodeURIComponent(found)}`);
    };

    const cert = result?.valid ? result.certificate : null;
    const cleanTitle = String(cert?.program_title || 'AI Product Management')
        .replace(/\s*Training\s*Cohort\s*$/i, '')
        .trim();

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-950 flex flex-col justify-between p-4 sm:p-6">
            <div className="max-w-4xl w-full mx-auto pt-2 flex items-center justify-between">
                <CortDevsLearnLogo size="md" />
                <Link
                    to="/login"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600 hover:text-neutral-950"
                >
                    Portal Login
                </Link>
            </div>

            <div className="max-w-2xl w-full mx-auto my-8 space-y-6">
                {/* Lookup & QR Scanner Card */}
                <div className="bg-white border border-neutral-200 p-5 sm:p-6 space-y-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-lg font-semibold text-neutral-950 flex items-center gap-2">
                                <QrCode className="w-5 h-5 text-neutral-900" />
                                Verify a CortDevs Certificate
                            </h1>
                            <p className="text-xs text-neutral-500 mt-0.5">
                                Scan the QR code on any CortDevs certificate or enter the Certificate ID below.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {!scanning ? (
                                <button
                                    type="button"
                                    onClick={startScanner}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#030213] hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    <Camera className="w-3.5 h-3.5" /> Scan QR Code
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={stopScanner}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-[0.14em]"
                                >
                                    <X className="w-3.5 h-3.5" /> Stop Camera
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-neutral-300 hover:border-neutral-950 text-neutral-900 text-xs font-bold uppercase tracking-[0.14em]"
                            >
                                <Upload className="w-3.5 h-3.5" /> Upload QR
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleUploadQrImage}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {scannerError && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2.5">
                            {scannerError}
                        </div>
                    )}

                    {scanning && (
                        <div className="relative bg-black overflow-hidden border border-neutral-900">
                            <video ref={videoRef} playsInline muted className="w-full max-h-72 object-cover" />
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                <div className="w-44 h-44 border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                            </div>
                            <div className="absolute bottom-2 inset-x-0 text-center text-[11px] font-semibold text-white">
                                Point camera at the certificate QR code
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleManualLookup} className="flex flex-col sm:flex-row gap-2.5">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value)}
                            placeholder="e.g. CD-AIPM-2026-F14C80"
                            className="flex-1 bg-white border border-neutral-300 px-3.5 py-2.5 text-base sm:text-sm font-mono text-neutral-950 focus:outline-none focus:border-neutral-950"
                        />
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold uppercase tracking-[0.16em]"
                        >
                            <Search className="w-3.5 h-3.5" /> Verify ID
                        </button>
                    </form>
                </div>

                {/* Verification Result */}
                {loading ? (
                    <div className="bg-white border border-neutral-200 p-10 text-center flex items-center justify-center gap-3 text-neutral-500 text-xs uppercase tracking-[0.2em]">
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                        Verifying Certificate...
                    </div>
                ) : cert ? (
                    <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
                        <div className="bg-[#030213] text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-[0.18em]">
                                <ShieldCheck className="w-5 h-5" />
                                <span>Verified CortDevs Credential</span>
                            </div>
                            <span className="font-mono text-xs text-neutral-300">{cert.certificate_code}</span>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                                        Awarded To
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-950">
                                        {cert.recipient_name}
                                    </h2>
                                    <p className="text-sm text-neutral-600 flex items-center gap-1.5 pt-1">
                                        <Award className="w-4 h-4 text-neutral-900 shrink-0" />
                                        <span>{cleanTitle}</span>
                                    </p>
                                </div>
                                <CortDevsSealStamp size={76} />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-neutral-50 border border-neutral-200 p-4 text-xs">
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                        Date Issued
                                    </div>
                                    <div className="font-semibold text-neutral-950 mt-0.5">
                                        {new Date(cert.issued_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                        Lessons Completed
                                    </div>
                                    <div className="font-semibold text-neutral-950 mt-0.5">
                                        {cert.completed_lessons} / {cert.total_lessons}
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                        Projects Approved
                                    </div>
                                    <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {cert.approved_projects} / {cert.total_projects}
                                    </div>
                                </div>
                            </div>

                            <p className="text-xs text-neutral-600 leading-relaxed">{cert.attribution_note}</p>

                            <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/learn-ju-sign.png"
                                        alt="Joseph Unomieta Signature"
                                        className="h-10 w-auto object-contain"
                                    />
                                    <div>
                                        <div className="font-semibold text-neutral-950">{cert.issued_by_name}</div>
                                        <div className="text-neutral-500">{cert.issued_by_title}</div>
                                    </div>
                                </div>
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold uppercase text-[10px] tracking-wider">
                                    Active &amp; Valid
                                </span>
                            </div>

                            <p className="text-[11px] text-neutral-400 pt-3 border-t border-neutral-100 leading-relaxed">
                                {cert.disclaimer}
                            </p>
                        </div>
                    </div>
                ) : code ? (
                    <div className="bg-white border border-red-200 p-8 text-center space-y-3">
                        <ShieldAlert className="w-9 h-9 text-red-600 mx-auto" />
                        <h2 className="text-lg font-semibold text-neutral-950">Certificate Not Verified</h2>
                        <p className="text-sm text-neutral-600">
                            {result?.error || error || 'No valid CortDevs certificate matches this verification code.'}
                        </p>
                    </div>
                ) : null}
            </div>

            <div className="text-center text-[11px] text-neutral-400 pb-2">
                CortDevs · Credential Verification Registry
            </div>
        </div>
    );
}
