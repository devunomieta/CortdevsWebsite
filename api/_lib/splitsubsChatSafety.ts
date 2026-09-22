// Chat safety (Feature Audit doc, "Chat safety rules") — a lightweight,
// warn-don't-block scan for the biggest real risk in a joiner<->host chat:
// someone asking to move payment off-platform to dodge escrow and the
// service charge. False positives are cheap (message still sends); an
// unflagged scam attempt is not.
const PAYMENT_REDIRECT_PATTERN = /\b(transfer|bank\s*(account|details)?|acc(oun)?t\s*(no|number)|opay|palmpay|moniepoint|kuda|paypal|venmo|cashapp|zelle|western\s*union)\b|\b\d{10}\b/i;

export function looksLikePaymentRedirect(message: string): boolean {
    return PAYMENT_REDIRECT_PATTERN.test(message);
}

export const PAYMENT_REDIRECT_WARNING =
    "Heads up: this message looks like it might be asking to pay outside SplitSubs. All payments must go through the platform — off-platform payments aren't escrow-protected.";

export const CHAT_RATE_LIMIT = { maxMessages: 20, windowMinutes: 10 };
