import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Award, CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { learnApi } from '../lib/api';
import { CortDevsLearnLogo } from '../components/BrandLogos';

export function VerifyCertificate() {
    const { code } = useParams();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) return;
        learnApi(`lms/certificate?code=${encodeURIComponent(code)}`, { auth: false })
            .then((res) => setResult(res))
            .catch((err) => setError(err?.message || 'Certificate not found.'))
            .finally(() => setLoading(false));
    }, [code]);

    const cert = result?.valid ? result.certificate : null;

    return (
        <div className="min-h-screen bg-neutral-50 text-neutral-950 flex flex-col justify-between p-6">
            <div className="max-w-4xl w-full mx-auto pt-2 flex items-center justify-between">
                <CortDevsLearnLogo size="md" />
                <Link
                    to="/login"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-600 hover:text-neutral-950"
                >
                    Portal Login
                </Link>
            </div>

            <div className="max-w-2xl w-full mx-auto my-10">
                {loading ? (
                    <div className="bg-white border border-neutral-200 p-10 text-center flex items-center justify-center gap-3 text-neutral-500 text-xs uppercase tracking-[0.2em]">
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                        Verifying Certificate...
                    </div>
                ) : cert ? (
                    <div className="bg-white border border-neutral-200 shadow-sm overflow-hidden">
                        <div className="bg-[#030213] text-white p-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-[0.18em]">
                                <ShieldCheck className="w-5 h-5" />
                                <span>Verified CortDevs Credential</span>
                            </div>
                            <span className="font-mono text-xs text-neutral-300">{cert.certificate_code}</span>
                        </div>

                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="space-y-1">
                                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
                                    Awarded To
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-950">
                                    {cert.recipient_name}
                                </h1>
                                <p className="text-sm text-neutral-600 flex items-center gap-1.5 pt-1">
                                    <Award className="w-4 h-4 text-neutral-900 shrink-0" />
                                    <span>{cert.program_title}</span>
                                </p>
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

                            <div className="space-y-2 text-xs text-neutral-600 leading-relaxed">
                                <p>{cert.attribution_note}</p>
                            </div>

                            <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div>
                                    <div className="font-semibold text-neutral-950">{cert.issued_by_name}</div>
                                    <div className="text-neutral-500">{cert.issued_by_title}</div>
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
                ) : (
                    <div className="bg-white border border-red-200 p-8 text-center space-y-3">
                        <ShieldAlert className="w-9 h-9 text-red-600 mx-auto" />
                        <h1 className="text-lg font-semibold text-neutral-950">Certificate Not Verified</h1>
                        <p className="text-sm text-neutral-600">
                            {result?.error || error || 'No valid CortDevs certificate matches this verification code.'}
                        </p>
                    </div>
                )}
            </div>

            <div className="text-center text-[11px] text-neutral-400 pb-2">
                CortDevs · Credential Verification Registry
            </div>
        </div>
    );
}
