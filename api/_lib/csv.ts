// Minimal, dependency-free CSV handling for the attendee import/export flow.
// No csv-parse/csv-stringify package in this repo, and the format is simple
// enough not to need one: a header row, comma-separated, RFC4180-style quoting
// for fields containing commas/quotes/newlines.

export function csvEscape(value: unknown): string {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function parseCsvText(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (inQuotes) {
            if (char === '"') {
                if (clean[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += char;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const REQUIRED_HEADERS = { fullName: ['full name', 'name'], email: ['email'], phone: ['phone', 'phone number'] };

function findColumn(headers: string[], aliases: string[]): number {
    const normalized = headers.map((h) => h.trim().toLowerCase());
    for (const alias of aliases) {
        const idx = normalized.indexOf(alias);
        if (idx !== -1) return idx;
    }
    return -1;
}

export interface ParsedAttendee {
    fullName: string;
    email: string;
    phone: string;
    customFields: Record<string, string>;
}

export interface CsvImportResult {
    attendees: ParsedAttendee[];
    skipped: number;
    total: number;
    error?: string;
}

// Expected columns: "Full Name" (required), "Email", "Phone" (both optional
// but at least one strongly recommended for search), plus one column per the
// event's configured walk-in fields (matched by exact name, case-insensitive).
export function attendeesFromCsv(text: string, customFieldNames: string[]): CsvImportResult {
    const rows = parseCsvText(text);
    if (rows.length < 2) {
        return { attendees: [], skipped: 0, total: 0, error: 'The file needs a header row plus at least one attendee row.' };
    }

    const headers = rows[0];
    const nameCol = findColumn(headers, REQUIRED_HEADERS.fullName);
    const emailCol = findColumn(headers, REQUIRED_HEADERS.email);
    const phoneCol = findColumn(headers, REQUIRED_HEADERS.phone);

    if (nameCol === -1) {
        return { attendees: [], skipped: 0, total: 0, error: 'Missing a "Full Name" column.' };
    }

    const customCols = customFieldNames.map((name) => ({
        name,
        col: headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase()),
    }));

    const dataRows = rows.slice(1);
    const attendees: ParsedAttendee[] = [];
    let skipped = 0;

    for (const row of dataRows) {
        const fullName = (row[nameCol] || '').trim();
        if (!fullName) { skipped++; continue; }

        const customFields: Record<string, string> = {};
        for (const { name, col } of customCols) {
            if (col !== -1) customFields[name] = (row[col] || '').trim();
        }

        attendees.push({
            fullName,
            email: emailCol !== -1 ? (row[emailCol] || '').trim() : '',
            phone: phoneCol !== -1 ? (row[phoneCol] || '').trim() : '',
            customFields,
        });
    }

    return { attendees, skipped, total: dataRows.length };
}

export function buildSampleCsv(customFieldNames: string[]): string {
    const headers = ['Full Name', 'Email', 'Phone', ...customFieldNames];
    const example = ['Chidinma Eze', 'chidinma@example.com', '+2348012345678', ...customFieldNames.map(() => 'Example')];
    return [headers, example].map((r) => r.map(csvEscape).join(',')).join('\n');
}
