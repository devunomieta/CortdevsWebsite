import { supabase } from "./supabase";

export interface ErrorLog {
    location: string;
    message: string;
    stack?: string;
    details?: any;
    fix_suggestion?: string;
}

class ErrorService {
    private static instance: ErrorService;

    private constructor() { }

    public static getInstance(): ErrorService {
        if (!ErrorService.instance) {
            ErrorService.instance = new ErrorService();
        }
        return ErrorService.instance;
    }

    /**
     * Logs an error to the server_errors table and optionally returns a generic message.
     */
    public async logError(error: any, location: string, details?: any) {
        const errorLog: ErrorLog = {
            location,
            message: error.message || String(error),
            stack: error.stack,
            details: details || {},
            fix_suggestion: this.deriveFixSuggestion(error, location)
        };

        // 1. Console logging for development (safeguarded)
        const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isDev) {
            console.error(`[ErrorService] @ ${location}:`, error);
        }

        // 2. Persist to Supabase
        try {
            await supabase.from('server_errors').insert([errorLog]);
        } catch (dbErr) {
            // Fallback if DB is down - last resort
            const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            if (isDev) {
                console.error("Critical: ErrorService failed to persist to DB", dbErr);
            }
        }

        return error.message || "An internal synchronization error occurred. The technical team has been notified.";
    }

    private deriveFixSuggestion(error: any, location: string): string {
        const msg = error.message?.toLowerCase() || "";
        const stack = error.stack?.toLowerCase() || "";

        // 1. Data & Parsing Errors
        if (msg.includes("is not valid json") || msg.includes("unexpected token")) {
            return "A server response returned non-JSON data (likely an HTML error page). Verify API endpoints and server-side logs.";
        }
        if (msg.includes("null") && (msg.includes("reading") || msg.includes("property"))) {
            return "Null pointer detected. Ensure optional chaining (?.) is used when accessing deeply nested data structures.";
        }

        // 2. Network & Infrastructure
        if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
            return "Connection interrupted. Check internet stability and Supabase project status (status.supabase.com).";
        }
        if (msg.includes("timeout") || msg.includes("deadline")) {
            return "Request timed out. Consider optimizing the query or increasing the server's response threshold.";
        }

        // 3. Security & Auth
        if (msg.includes("permission") || msg.includes("policy") || msg.includes("rls")) {
            return "Security violation: Verify Row Level Security (RLS) policies in Supabase for the active table.";
        }
        if (msg.includes("jwt") || msg.includes("expired") || msg.includes("token")) {
            return "Session integrity issue: The user's synchronization key has expired. Force a re-login for the admin.";
        }
        if (location.toLowerCase().includes("auth") || location.toLowerCase().includes("login")) {
            return "Strategic Review: Audit the authentication flow, SMTP settings, and redirect URLs in the Auth dashboard.";
        }

        // 4. Database Constraints
        if (msg.includes("unique constraint") || msg.includes("duplicate")) {
            return "Integrity conflict: Check for duplicate primary keys or unique field violations in the source data.";
        }
        if (msg.includes("foreign key") || msg.includes("relation")) {
            return "Relational mismatch: Verify that the referenced ID exists in the parent table before insertion.";
        }

        // Default fallback
        return "Comprehensive analysis required: Examine the stack trace manifest and verify database schema alignment.";
    }
}

export const errorService = ErrorService.getInstance();
