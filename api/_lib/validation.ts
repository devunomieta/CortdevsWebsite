// Shared field validation for every write endpoint under api/events/* and
// api/admin/events/*. Client-side checks (see src/events-portal/lib/validation.ts)
// give immediate feedback, but these are the ones that actually matter —
// anyone can call these endpoints directly with a bearer token, bypassing
// whatever the browser form does.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;

export function isValidEmail(value: string): boolean {
    return EMAIL_RE.test(String(value).trim());
}

export function isValidUrl(value: string): boolean {
    return URL_RE.test(String(value).trim());
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

export function isNonEmpty(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

export function withinLength(value: string, max: number): boolean {
    return String(value).trim().length <= max;
}

// Walk-in field / custom field names — letters, numbers, spaces, and a few
// common punctuation marks. Blocks anything that would look broken as a CSV
// header or a UI label.
const FIELD_NAME_RE = /^[a-zA-Z0-9 &/'.-]{1,40}$/;
export function isValidFieldName(value: string): boolean {
    return FIELD_NAME_RE.test(String(value).trim());
}

// YYYY-MM-DD, matching an HTML <input type="date"> value.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidDateString(value: string): boolean {
    return DATE_RE.test(value) && !Number.isNaN(new Date(value).getTime());
}
