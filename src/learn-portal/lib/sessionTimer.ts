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

export interface ReadingHeading {
    id: string;
    text: string;
    level: number;
}

export interface ReadingTtsBlock {
    idx: number;
    text: string;
    tag: string;
}

export interface PreparedReadingContent {
    html: string;
    headings: ReadingHeading[];
    ttsBlocks: ReadingTtsBlock[];
}

const FAUX_BULLET_REGEX = /^\s*(?:[•▪◦●■◆➤▸]|[-–—]\s+)\s*(.+)$/;
const CALLOUT_PREFIX_REGEX =
    /^\s*(note|tip|pro tip|important|key takeaway|key takeaways|remember|example|summary|definition)\s*:/i;

function stripLeadingBulletMarker(el: Element): void {
    const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
        const val = node.nodeValue || '';
        if (val.trim().length > 0) {
            node.nodeValue = val.replace(/^\s*(?:[•▪◦●■◆➤▸]|[-–—]\s+)\s*/, '');
            break;
        }
        node = walker.nextNode();
    }
}

/**
 * Defense-in-depth DOM sanitizer & editorial readability enhancer for mammoth-converted .docx reading HTML:
 * 1. Strips dangerous elements (<script>, <iframe>, <object>, <embed>, <style>, <form>) and inline event handlers.
 * 2. Removes empty spacer paragraphs, upgrades faux-bullet paragraphs into real <ul><li> lists,
 *    styles instructional callout prefixes (Note:, Tip:, Key Takeaway:, Example:), and wraps tables for horizontal scroll.
 * 3. Tags headings with anchor IDs (for Jump-to-Section) and readable blocks with data-tts-idx (for Text-to-Speech).
 */
export function prepareReadingContent(html: string): PreparedReadingContent {
    if (!html || typeof window === 'undefined') {
        return { html: html || '', headings: [], ttsBlocks: [] };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Strip dangerous tags
    const forbiddenTags = doc.querySelectorAll('script, iframe, object, embed, style, link, meta, form, input, button');
    forbiddenTags.forEach((el) => el.remove());

    // 2. Strip unsafe attributes & normalize links/images
    const all = doc.body.querySelectorAll('*');
    all.forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const val = attr.value.trim().toLowerCase();
            if (name.startsWith('on') || name === 'style') {
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

    // 3. Remove empty spacer paragraphs (<p>&nbsp;</p>) that don't contain media
    Array.from(doc.body.querySelectorAll('p')).forEach((p) => {
        const hasMedia = Boolean(p.querySelector('img, svg, table, hr'));
        const text = (p.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (!hasMedia && text.length === 0) {
            p.remove();
        }
    });

    // 4. Upgrade consecutive faux-bullet <p> elements (e.g., "• Item") into semantic <ul><li>
    const children = Array.from(doc.body.children);
    let idx = 0;
    while (idx < children.length) {
        const el = children[idx];
        const rawText = (el.textContent || '').replace(/\u00a0/g, ' ');
        if (el.tagName === 'P' && FAUX_BULLET_REGEX.test(rawText)) {
            const ul = doc.createElement('ul');
            el.parentNode?.insertBefore(ul, el);
            while (idx < children.length) {
                const cur = children[idx];
                const curText = (cur.textContent || '').replace(/\u00a0/g, ' ');
                if (cur.tagName !== 'P' || !FAUX_BULLET_REGEX.test(curText)) break;
                stripLeadingBulletMarker(cur);
                const li = doc.createElement('li');
                li.innerHTML = cur.innerHTML;
                ul.appendChild(li);
                cur.remove();
                idx += 1;
            }
        } else {
            idx += 1;
        }
    }

    // 5. Wrap tables for clean mobile horizontal scrolling
    Array.from(doc.body.querySelectorAll('table')).forEach((table) => {
        if (table.parentElement?.classList.contains('reading-table-wrap')) return;
        const wrap = doc.createElement('div');
        wrap.className = 'reading-table-wrap';
        table.parentNode?.insertBefore(wrap, table);
        wrap.appendChild(table);
    });

    // 6. Apply subtle callout box styling to Note:/Tip:/Key Takeaway:/Example: lead-in paragraphs
    Array.from(doc.body.querySelectorAll('p')).forEach((p) => {
        if (p.closest('li, blockquote, td, th')) return;
        const text = (p.textContent || '').replace(/\u00a0/g, ' ').trim();
        if (text.length >= 24 && text.length <= 750 && CALLOUT_PREFIX_REGEX.test(text)) {
            p.classList.add('reading-callout');
        }
    });

    // 7. Extract Jump-to-Section headings (h1-h3)
    const headings: ReadingHeading[] = [];
    Array.from(doc.body.querySelectorAll('h1, h2, h3')).forEach((h, i) => {
        const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 2) return;
        const id = `reading-sec-${i + 1}`;
        h.setAttribute('id', id);
        headings.push({
            id,
            text: text.slice(0, 110),
            level: Number(h.tagName.slice(1)) || 2,
        });
    });

    // 8. Tag top-level readable blocks for Text-to-Speech highlighting & navigation
    const ttsBlocks: ReadingTtsBlock[] = [];
    const blockCandidates = doc.body.querySelectorAll('h1, h2, h3, h4, p, li, blockquote');
    blockCandidates.forEach((el) => {
        // Avoid double-tagging nested <p> inside <li> or <blockquote>
        if (el.tagName === 'P' && el.closest('li, blockquote')) return;
        if (el.tagName === 'LI' && el.parentElement?.closest('li')) return;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length < 2) return;
        const blockIdx = ttsBlocks.length;
        el.setAttribute('data-tts-idx', String(blockIdx));
        ttsBlocks.push({
            idx: blockIdx,
            text,
            tag: el.tagName.toLowerCase(),
        });
    });

    return {
        html: doc.body.innerHTML,
        headings,
        ttsBlocks,
    };
}

/**
 * Convenience wrapper returning sanitized & enhanced HTML string directly.
 */
export function sanitizeReadingHtml(html: string): string {
    return prepareReadingContent(html).html;
}
