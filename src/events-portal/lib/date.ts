// Mirrors api/_lib/eventContext.ts's todayInTimezone — used client-side so
// the "not event day" banner and button-disabling agree with what the server
// will actually enforce, instead of comparing against the browser's own
// local date (which may be in a different timezone than the event).
export function todayInTimezone(timezone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(new Date());
}
