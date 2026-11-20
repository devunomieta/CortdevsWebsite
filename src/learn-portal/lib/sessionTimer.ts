const SESSION_EXPIRY_KEY = 'cortdevs_learn_session_expires_at';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function resetLearnSessionTimer(): number {
    const expiresAt = Date.now() + THREE_DAYS_MS;
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
    }
    return expiresAt;
}

export function clearLearnSessionTimer(): void {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_EXPIRY_KEY);
    }
}

export function isLearnSessionExpired(): boolean {
    if (typeof window === 'undefined') return false;
    const raw = window.localStorage.getItem(SESSION_EXPIRY_KEY);
    if (!raw) {
        resetLearnSessionTimer();
        return false;
    }
    const expiresAt = Number(raw);
    return Number.isFinite(expiresAt) && Date.now() > expiresAt;
}

/**
 * Defense-in-depth DOM sanitizer for mammoth-converted .docx reading HTML.
 * Strips dangerous elements (<script>, <iframe>, <object>, <embed>, <style>, <form>)
 * and inline event handlers (on*) or javascript:/data: URLs before rendering.
 */
export function sanitizeReadingHtml(html: string): string {
    if (!html || typeof window === 'undefined') return html || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const forbiddenTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, form, input, button');
    forbiddenTags.forEach((el) => el.remove());

    const all = doc.body.querySelectorAll('*');
    all.forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const val = attr.value.trim().toLowerCase();
            if (name.startsWith('on')) {
                el.removeAttribute(attr.name);
            } else if ((name === 'href' || name === 'src') && (val.startsWith('javascript:') || val.startsWith('data:'))) {
                el.removeAttribute(attr.name);
            }
        }
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
        if (el.tagName === 'IMG') {
            el.setAttribute('loading', 'lazy');
            el.setAttribute('decoding', 'async');
            el.removeAttribute('width');
            el.removeAttribute('height');
        }
    });

    return doc.body.innerHTML;
}
