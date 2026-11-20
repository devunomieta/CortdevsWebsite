import React, { useEffect, useId, useState } from 'react';
import { useConfig } from '../../app/context/ConfigContext';

export function CortDevsLearnLogo({
    size = 'md',
    showBadge = true,
}: {
    size?: 'sm' | 'md' | 'lg';
    showBadge?: boolean;
}) {
    const { config, isLoading } = useConfig();
    const [imgFailed, setImgFailed] = useState(false);

    // Reset failure state whenever ConfigContext finishes loading the real Supabase logo URL
    useEffect(() => {
        setImgFailed(false);
    }, [config.headerLogo]);

    const imgHeights = {
        sm: 'h-6',
        md: 'h-7',
        lg: 'h-9',
    };

    const textSizes = {
        sm: 'text-xl',
        md: 'text-2xl',
        lg: 'text-3xl',
    };

    // Avoid attempting to load the nonexistent fallback '/logo-dark.svg' while Supabase config is still fetching
    const hasRealLogoUrl = Boolean(config.headerLogo && config.headerLogo !== '/logo-dark.svg');

    return (
        <div className="inline-flex items-center gap-3 shrink-0">
            {hasRealLogoUrl && !imgFailed ? (
                <img
                    src={config.headerLogo}
                    alt="CortDevs"
                    onError={() => setImgFailed(true)}
                    className={`${imgHeights[size]} w-auto object-contain`}
                />
            ) : isLoading ? (
                <div className={`${imgHeights[size]} w-24 bg-neutral-200/70 animate-pulse`} />
            ) : (
                <span className={`${textSizes[size]} font-light tracking-tighter text-neutral-950 leading-none`}>
                    Cort<span className="font-semibold italic">Devs</span>
                </span>
            )}
            {showBadge && (
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 border-l border-neutral-300 pl-3 leading-none py-0.5">
                    Learn
                </span>
            )}
        </div>
    );
}

export function MicrosoftLogo({ className = 'h-4', dark = false }: { className?: string; dark?: boolean }) {
    return (
        <span className="inline-flex items-center gap-1.5 select-none shrink-0" aria-label="Microsoft">
            <svg viewBox="0 0 21 21" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="9.8" height="9.8" fill="#F25022" />
                <rect x="11.2" y="0" width="9.8" height="9.8" fill="#7FBA00" />
                <rect x="0" y="11.2" width="9.8" height="9.8" fill="#00A4EF" />
                <rect x="11.2" y="11.2" width="9.8" height="9.8" fill="#FFB900" />
            </svg>
            <span
                className={`font-semibold tracking-tight leading-none ${
                    dark ? 'text-white' : 'text-neutral-800'
                } text-[13px]`}
            >
                Microsoft
            </span>
        </span>
    );
}

export function CourseraLogo({ dark = false }: { dark?: boolean }) {
    return (
        <span className="inline-flex items-center select-none shrink-0" aria-label="Coursera">
            <svg
                viewBox="0 0 82 20"
                className="h-4 w-auto"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <text
                    x="0"
                    y="15.5"
                    fill={dark ? '#60A5FA' : '#0056D2'}
                    fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    fontWeight="700"
                    fontSize="17"
                    letterSpacing="-0.5"
                >
                    coursera
                </text>
            </svg>
        </span>
    );
}

export function CoursePartnerStrip({
    compact = false,
    dark = false,
}: {
    compact?: boolean;
    dark?: boolean;
}) {
    return (
        <div
            className={`inline-flex items-center gap-2.5 flex-nowrap whitespace-nowrap ${
                compact ? 'px-3 py-1.5' : 'px-3.5 py-2'
            } border ${
                dark
                    ? 'border-white/15 bg-white/5 text-neutral-300'
                    : 'border-neutral-200 bg-white text-neutral-600'
            }`}
        >
            <MicrosoftLogo dark={dark} className="h-3.5" />
            <span className="opacity-40 text-xs leading-none">×</span>
            <CourseraLogo dark={dark} />
        </div>
    );
}

export function CortDevsSealStamp({ size = 96 }: { size?: number }) {
    const uid = useId().replace(/:/g, '');
    const topArcId = `cdSealTopArc-${uid}`;
    const bottomArcId = `cdSealBottomArc-${uid}`;

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="CortDevs Official CD Seal"
            className="select-none shrink-0"
        >
            <defs>
                {/* Top arc: left-to-right over the top so text reads upright */}
                <path id={topArcId} d="M 19,60 A 41,41 0 1,1 101,60" />
                {/* Bottom arc: left-to-right under the bottom so text reads upright */}
                <path id={bottomArcId} d="M 13.5,60 A 46.5,46.5 0 0,0 106.5,60" />
            </defs>
            {/* Outer scalloped stamp border */}
            <circle cx="60" cy="60" r="56" stroke="#030213" strokeWidth="2.2" strokeDasharray="3 2.2" fill="#fafafa" />
            <circle cx="60" cy="60" r="51" stroke="#030213" strokeWidth="1.5" fill="none" />
            <circle cx="60" cy="60" r="32" stroke="#030213" strokeWidth="1.2" fill="#030213" />
            <circle cx="60" cy="60" r="28" stroke="#ffffff" strokeWidth="0.7" strokeOpacity="0.4" fill="none" />

            {/* Curved perimeter text */}
            <text fill="#030213" fontSize="7.4" fontWeight="700" letterSpacing="2.2" fontFamily="'Inter', sans-serif">
                <textPath href={`#${topArcId}`} startOffset="50%" textAnchor="middle">
                    CORTDEVS · VERIFIED
                </textPath>
            </text>
            <text fill="#030213" fontSize="7.2" fontWeight="700" letterSpacing="2.2" fontFamily="'Inter', sans-serif">
                <textPath href={`#${bottomArcId}`} startOffset="50%" textAnchor="middle">
                    OFFICIAL SEAL
                </textPath>
            </text>

            {/* Center CD Monogram */}
            <text
                x="60"
                y="67"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="24"
                fontWeight="700"
                letterSpacing="1.5"
                fontFamily="Georgia, 'Times New Roman', serif"
            >
                CD
            </text>
        </svg>
    );
}
