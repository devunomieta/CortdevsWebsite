import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isValidUuid, requireLmsAdmin, requireLmsMember, sanitizePlainText } from '../../_lib/lmsGate.js';

const AUTHOR_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15-minute grace window for learners to fix typos/delete

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const member = await requireLmsMember(req, res);
    if (!member) return;

    // GET: Fetch module questions + replies (or ALL cohort questions WITH nested replies when scope=all for Admins)
    if (req.method === 'GET') {
        const moduleId = String(req.query?.moduleId || '').trim();
        const scope = String(req.query?.scope || '').trim();

        let query = supabase
            .from('lms_module_discussions')
            .select('*, lms_modules(title, target_week)')
            .eq('cohort_id', member.cohort.id)
            .order('created_at', { ascending: true });

        if (scope === 'all') {
            if (member.enrollment.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required.' });
            }
            // Fetch both questions and threaded replies in 1 single cohort-scoped query (0 N+1)
        } else {
            if (!isValidUuid(moduleId)) return res.status(400).json({ error: 'Valid moduleId required' });
            query = query.eq('module_id', moduleId);
        }

        const { data: rows, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        const userIds = [
            ...new Set([
                ...(rows || []).map((r: any) => r.user_id),
                ...(rows || []).map((r: any) => r.answered_by).filter(Boolean),
            ]),
        ];

        const authorMap = new Map<string, { full_name: string; role: string }>();
        if (userIds.length > 0) {
            const { data: people } = await supabase
                .from('lms_enrollments')
                .select('user_id, full_name, role')
                .eq('cohort_id', member.cohort.id)
                .in('user_id', userIds);
            for (const p of people || []) {
                authorMap.set(p.user_id, { full_name: p.full_name, role: p.role });
            }
        }

        const enriched = (rows || []).map((r: any) => ({
            ...r,
            module_title: r.lms_modules?.title || '',
            target_week: r.lms_modules?.target_week || 1,
            author_name: authorMap.get(r.user_id)?.full_name || 'Teammate',
            author_role: authorMap.get(r.user_id)?.role || 'learner',
            answered_by_name: r.answered_by ? authorMap.get(r.answered_by)?.full_name || 'Admin' : null,
        }));

        if (scope === 'all') {
            const repliesByParent = new Map<string, any[]>();
            for (const row of enriched) {
                if (row.parent_id) {
                    const list = repliesByParent.get(row.parent_id) || [];
                    list.push(row);
                    repliesByParent.set(row.parent_id, list);
                }
            }
            const topLevel = enriched
                .filter((r: any) => !r.parent_id)
                .map((q: any) => ({
                    ...q,
                    replies: repliesByParent.get(q.id) || [],
                }))
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return res.status(200).json({ comments: topLevel });
        }

        return res.status(200).json({ comments: enriched });
    }

    // POST: Ask a new question (parentId = null) OR post a reply under a question (parentId set)
    if (req.method === 'POST') {
        const { moduleId, body, parentId } = req.body || {};
        const cleanBody = sanitizePlainText(body, 2000);
        if (!isValidUuid(moduleId) || cleanBody.length < 3) {
            return res.status(400).json({ error: 'Enter a valid question or reply (3–2000 characters).' });
        }
        if (parentId && !isValidUuid(parentId)) {
            return res.status(400).json({ error: 'Invalid parentId.' });
        }

        const { data, error } = await supabase
            .from('lms_module_discussions')
            .insert({
                cohort_id: member.cohort.id,
                module_id: moduleId,
                user_id: member.enrollment.user_id,
                parent_id: parentId || null,
                body: cleanBody,
                status: 'open',
            })
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({
            comment: {
                ...data,
                author_name: member.enrollment.full_name,
                author_role: member.enrollment.role,
                answered_by_name: null,
            },
        });
    }

    // PATCH: Either (A) Author edits own post within 15 min / Admin edits anytime, OR (B) Admin marks question answered
    if (req.method === 'PATCH') {
        const { action, commentId, body, questionId, officialAnswer, status = 'answered' } = req.body || {};

        if (action === 'edit_body') {
            const targetId = commentId || questionId;
            const cleanBody = sanitizePlainText(body, 2000);
            if (!isValidUuid(targetId) || cleanBody.length < 3) {
                return res.status(400).json({ error: 'Valid commentId and text (3–2000 characters) required.' });
            }

            const { data: existing } = await supabase
                .from('lms_module_discussions')
                .select('id, user_id, created_at')
                .eq('id', targetId)
                .eq('cohort_id', member.cohort.id)
                .maybeSingle();

            if (!existing) return res.status(404).json({ error: 'Post not found.' });

            const isAdmin = member.enrollment.role === 'admin';
            const isOwner = existing.user_id === member.enrollment.user_id;
            const ageMs = Date.now() - new Date(existing.created_at).getTime();

            if (!isAdmin && (!isOwner || ageMs > AUTHOR_EDIT_WINDOW_MS)) {
                return res.status(403).json({
                    error: isOwner
                        ? 'You can only edit your own post within 15 minutes of posting.'
                        : 'You do not have permission to edit this post.',
                });
            }

            const { data, error } = await supabase
                .from('lms_module_discussions')
                .update({ body: cleanBody })
                .eq('id', targetId)
                .eq('cohort_id', member.cohort.id)
                .select('*')
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ comment: data });
        }

        const admin = await requireLmsAdmin(req, res);
        if (!admin) return;

        if (!isValidUuid(questionId) || !['open', 'answered'].includes(status)) {
            return res.status(400).json({ error: 'Valid questionId and status (open | answered) required.' });
        }

        const cleanAnswer = sanitizePlainText(officialAnswer, 3000);
        if (status === 'answered' && cleanAnswer.length < 5) {
            return res.status(400).json({ error: 'Enter the agreed session answer (at least 5 characters) before marking answered.' });
        }

        const { data, error } = await supabase
            .from('lms_module_discussions')
            .update({
                status,
                official_answer: status === 'answered' ? cleanAnswer : null,
                answered_by: status === 'answered' ? admin.user.id : null,
                answered_at: status === 'answered' ? new Date().toISOString() : null,
            })
            .eq('id', questionId)
            .eq('cohort_id', admin.cohort.id)
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({
            comment: {
                ...data,
                answered_by_name: status === 'answered' ? admin.enrollment.full_name : null,
            },
        });
    }

    // DELETE: Author deletes own post within 15 min, or Admin deletes any off-topic post anytime
    if (req.method === 'DELETE') {
        const targetId = String(req.query?.id || req.body?.commentId || '').trim();
        if (!isValidUuid(targetId)) {
            return res.status(400).json({ error: 'Valid comment id required.' });
        }

        const { data: existing } = await supabase
            .from('lms_module_discussions')
            .select('id, user_id, created_at')
            .eq('id', targetId)
            .eq('cohort_id', member.cohort.id)
            .maybeSingle();

        if (!existing) return res.status(404).json({ error: 'Post not found.' });

        const isAdmin = member.enrollment.role === 'admin';
        const isOwner = existing.user_id === member.enrollment.user_id;
        const ageMs = Date.now() - new Date(existing.created_at).getTime();

        if (!isAdmin && (!isOwner || ageMs > AUTHOR_EDIT_WINDOW_MS)) {
            return res.status(403).json({
                error: isOwner
                    ? 'You can only delete your own post within 15 minutes of posting.'
                    : 'Only admins can remove other teammates’ posts.',
            });
        }

        const { error } = await supabase
            .from('lms_module_discussions')
            .delete()
            .eq('id', targetId)
            .eq('cohort_id', member.cohort.id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true, deletedId: targetId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
