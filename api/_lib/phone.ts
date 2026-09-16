// Nigerian phone numbers are commonly written three ways for the exact same
// line — +2348156841952, 2348156841952, 08156841952 — differing only in the
// country-code/trunk prefix. Extracting the core local digits lets a search
// for any one form match attendee records stored in any of the others,
// without needing to normalize (or migrate) how numbers are stored.
export function phoneSearchCore(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('234') && digits.length > 10) return digits.slice(3);
    if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
    return digits;
}

// Allows digits plus the punctuation people actually type in a phone field:
// leading +, spaces, hyphens, parentheses. Rejects letters and everything else.
export function isValidPhone(value: string): boolean {
    if (!value) return true; // phone is optional almost everywhere it appears
    return /^\+?[\d\s\-()]{6,20}$/.test(value.trim());
}

// Strips characters a phone field should never contain, for use in an
// onChange handler so letters can't be typed in at all (not just rejected on
// submit).
export function sanitizePhoneInput(value: string): string {
    return value.replace(/[^\d+\s\-()]/g, '');
}
