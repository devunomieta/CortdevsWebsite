import { supabase } from './supabase.js';

export function slugify(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Appends -2, -3, ... on collision so "Demo Day" and a second "Demo Day" both
// get usable, unique slugs (PRD: "Event slug should be the event title").
export async function uniqueEventSlug(title: string): Promise<string> {
    const base = slugify(title) || 'event';
    let candidate = base;
    let n = 2;
    while (true) {
        const { data } = await supabase.from('events').select('id').eq('slug', candidate).maybeSingle();
        if (!data) return candidate;
        candidate = `${base}-${n}`;
        n += 1;
    }
}
