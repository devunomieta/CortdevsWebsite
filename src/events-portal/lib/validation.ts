// Client-side field validation — mirrors api/_lib/validation.ts. These exist
// for instant feedback as someone types; the server re-checks everything
// itself, since a browser form is never the only way to hit these endpoints.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
const FIELD_NAME_RE = /^[a-zA-Z0-9 &/'.-]{1,40}$/;

export function isValidEmail(value: string): boolean {
    return EMAIL_RE.test(value.trim());
}

export function isValidUrl(value: string): boolean {
    return URL_RE.test(value.trim());
}

export function isValidFieldName(value: string): boolean {
    return FIELD_NAME_RE.test(value.trim());
}

export const LIMITS = {
    title: 200,
    name: 200,
    label: 60,
    fieldName: 40,
    description: 2000,
    message: 5000,
    url: 500,
};

// Nigerian numbers are commonly written +234…, 234…, or 0… for the same
// line — strips everything but digits/+/-/()/spaces so letters can never be
// typed into a phone field in the first place.
export function sanitizePhoneInput(value: string): string {
    return value.replace(/[^\d+\s\-()]/g, "");
}

export function isValidPhone(value: string): boolean {
    if (!value) return true;
    return /^\+?[\d\s\-()]{6,20}$/.test(value.trim());
}
