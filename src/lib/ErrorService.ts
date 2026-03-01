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

        return "An internal synchronization error occurred. The technical team has been notified.";
    }

    private deriveFixSuggestion(error: any, location: string): string {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("network") || msg.includes("fetch")) return "Check internet connectivity and Supabase status.";
        if (msg.includes("permission") || msg.includes("policy")) return "Verify RLS policies in supabase_schema.sql for this table.";
        if (msg.includes("unique constraint")) return "Check for duplicate keys in the source data.";
        if (location.includes("Auth")) return "Review Supabase Auth configurations and email templates.";
        return "Analyze the stack trace and verify database schema alignment.";
    }
}

export const errorService = ErrorService.getInstance();
