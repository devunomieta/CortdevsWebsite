import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isValidUuid, requireLmsAdmin, requireLmsMember, sanitizePlainText } from '../../_lib/lmsGate.js';
import { getModuleDialogueScenario } from '../../_lib/moduleDialogues.js';

const AUTHOR_EDIT_WINDOW_MS = 15 * 60 * 1000; // 15-minute grace window for learners to fix typos/delete
const ALLOWED_POST_TYPES = new Set(['question', 'dialogue', 'reflection_reply']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const member = await requireLmsMember(req, res);
    if (!member) return;

    // GET: Fetch module Q&A + Dialogue posts + Post-to-Reveal Peer Reflections (or ALL cohort Q&A for Admins)
    if (req.method === 'GET') {
        const moduleId = String(req.query?.moduleId || '').trim();
        const lessonId = String(req.query?.lessonId || '').trim();
        const scope = String(req.query?.scope || '').trim();

        let query = supabase
            .from('lms_module_discussions')
            .select('*, lms_modules(title, target_week, lms_courses(title))')
            .eq('cohort_id', member.cohort.id)
            .order('created_at', { ascending: true });

        if (scope === 'all') {
            if (member.enrollment.role !== 'admin') {
                return res.status(403).json({ error: 'Admin access required.' });
            }
        } else {
            if (!isValidUuid(moduleId)) return res.status(400).json({ error: 'Valid moduleId required' });
            query = query.eq('module_id', moduleId);
        }

        const [
            { data: rows, error },
            modMetaRes,
            peerTakeawaysRes,
        ] = await Promise.all([
            query,
            scope !== 'all' && isValidUuid(moduleId)
                ? supabase
                      .from('lms_modules')
                      .select('id, title, target_week, lms_courses(title)')
                      .eq('id', moduleId)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
            scope !== 'all' && isValidUuid(lessonId)
                ? supabase
                      .from('lms_lesson_progress')
                      .select('user_id, key_takeaway, completed_at')
                      .eq('cohort_id', member.cohort.id)
                      .eq('lesson_id', lessonId)
                      .not('key_takeaway', 'is', null)
                      .order('completed_at', { ascending: false })
                      .limit(40)
                : Promise.resolve({ data: [] }),
        ]);

        if (error) return res.status(500).json({ error: error.message });

        const peerRows = (peerTakeawaysRes?.data || []).filter(
            (r: any) => typeof r.key_takeaway === 'string' && r.key_takeaway.trim().length > 0,
        );

        const userIds = [
            ...new Set([
                ...(rows || []).map((r: any) => r.user_id),
                ...(rows || []).map((r: any) => r.answered_by).filter(Boolean),
                ...peerRows.map((p: any) => p.user_id),
            ]),
        ];

        const authorMap = new Map<string, { full_name: string; role: string; study_group_name: string | null }>();
        if (userIds.length > 0) {
            const { data: people } = await supabase
                .from('lms_enrollments')
                .select('user_id, full_name, role, study_group_name')
                .eq('cohort_id', member.cohort.id)
                .in('user_id', userIds);
            for (const p of people || []) {
                authorMap.set(p.user_id, {
                    full_name: p.full_name,
                    role: p.role,
                    study_group_name: p.study_group_name || null,
                });
            }
        }

        const enriched = (rows || []).map((r: any) => {
            const helpfulIds: string[] = Array.isArray(r.helpful_user_ids) ? r.helpful_user_ids : [];
            return {
                ...r,
                post_type: r.post_type || 'question',
                helpful_user_ids: helpfulIds,
                helpful_count: helpfulIds.length,
                viewer_marked_helpful: helpfulIds.includes(member.enrollment.user_id),
                module_title: r.lms_modules?.title || '',
                target_week: r.lms_modules?.target_week || 1,
                author_name: authorMap.get(r.user_id)?.full_name || 'Teammate',
                author_role: authorMap.get(r.user_id)?.role || 'learner',
                author_group: authorMap.get(r.user_id)?.study_group_name || null,
                answered_by_name: r.answered_by ? authorMap.get(r.answered_by)?.full_name || 'Admin' : null,
            };
        });

        if (scope === 'all') {
            // Admin Session Q&A tab focuses cleanly on Session Q&A questions & replies (not Dialogue posts)
            const qaRows = enriched.filter((r: any) => r.post_type === 'question');
            const repliesByParent = new Map<string, any[]>();
            for (const row of qaRows) {
                if (row.parent_id) {
                    const list = repliesByParent.get(row.parent_id) || [];
                    list.push(row);
                    repliesByParent.set(row.parent_id, list);
                }
            }
            const topLevel = qaRows
                .filter((r: any) => !r.parent_id)
                .map((q: any) => ({
                    ...q,
                    replies: repliesByParent.get(q.id) || [],
                }))
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            return res.status(200).json({ comments: topLevel });
        }

        const isAdmin = member.enrollment.role === 'admin';
        const viewerHasOwnTakeaway = peerRows.some((p: any) => p.user_id === member.enrollment.user_id);
        const reflectionsUnlocked = isAdmin || viewerHasOwnTakeaway;

        const peerReflections = reflectionsUnlocked
            ? peerRows.map((p: any) => ({
                  userId: p.user_id,
                  isCurrentUser: p.user_id === member.enrollment.user_id,
                  authorName: authorMap.get(p.user_id)?.full_name || 'Teammate',
                  authorRole: authorMap.get(p.user_id)?.role || 'learner',
                  studyGroup: authorMap.get(p.user_id)?.study_group_name || null,
                  takeaway: p.key_takeaway,
                  completedAt: p.completed_at,
              }))
            : [];

        const modMeta = modMetaRes?.data as any;
        const dialogueScenario = modMeta
            ? getModuleDialogueScenario(modMeta.title, modMeta.lms_courses?.title || '')
            : getModuleDialogueScenario('', '');

        const questions = enriched.filter((r: any) => r.post_type === 'question');
        const dialoguePosts = enriched.filter((r: any) => r.post_type === 'dialogue');
        const reflectionReplies = enriched.filter(
            (r: any) => r.post_type === 'reflection_reply' && (!lessonId || r.lesson_id === lessonId),
        );

        return res.status(200).json({
            comments: questions, // backward compatible with existing Q&A UI
            dialoguePosts,
            dialogueScenario,
            aiCoachConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
            reflections: {
                unlocked: reflectionsUnlocked,
                totalCount: peerRows.length,
                items: peerReflections,
                replies: reflectionReplies,
            },
        });
    }

    // POST: Create a Q&A question/reply, Module Dialogue response/reply, or Reflection peer note
    if (req.method === 'POST') {
        const { moduleId, lessonId, body, parentId, postType = 'question' } = req.body || {};
        const cleanBody = sanitizePlainText(body, 2000);
        const safePostType = ALLOWED_POST_TYPES.has(String(postType)) ? String(postType) : 'question';

        if (!isValidUuid(moduleId) || cleanBody.length < 3) {
            return res.status(400).json({ error: 'Enter a valid post (3–2000 characters).' });
        }
        if (parentId && !isValidUuid(parentId)) {
            return res.status(400).json({ error: 'Invalid parentId.' });
        }
        if (lessonId && !isValidUuid(lessonId)) {
            return res.status(400).json({ error: 'Invalid lessonId.' });
        }

        const insertPayload: Record<string, any> = {
            cohort_id: member.cohort.id,
            module_id: moduleId,
            user_id: member.enrollment.user_id,
            parent_id: parentId || null,
            body: cleanBody,
            status: 'open',
        };

        // Include extended columns when posting non-default types or lesson-linked notes
        if (safePostType !== 'question' || lessonId) {
            insertPayload.post_type = safePostType;
            if (lessonId) insertPayload.lesson_id = lessonId;
        }

        const { data, error } = await supabase
            .from('lms_module_discussions')
            .insert(insertPayload)
            .select('*')
            .single();

        if (error) {
            if (error.code === '42703') {
                return res.status(400).json({
                    error: 'Database columns post_type / lesson_id not added yet — run the 3-line ALTER TABLE SQL on lms_module_discussions in Supabase first.',
                });
            }
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json({
            comment: {
                ...data,
                post_type: data.post_type || safePostType,
                helpful_user_ids: Array.isArray(data.helpful_user_ids) ? data.helpful_user_ids : [],
                helpful_count: Array.isArray(data.helpful_user_ids) ? data.helpful_user_ids.length : 0,
                viewer_marked_helpful: false,
                author_name: member.enrollment.full_name,
                author_role: member.enrollment.role,
                author_group: member.enrollment.study_group_name || null,
                answered_by_name: null,
            },
        });
    }

    // PATCH: (A) Toggle 'Insightful' reaction, (B) Edit own post within 15 min / Admin anytime, or (C) Admin marks Q&A answered
    if (req.method === 'PATCH') {
        const { action, commentId, body, questionId, officialAnswer, status = 'answered' } = req.body || {};

        if (action === 'toggle_helpful') {
            const targetId = commentId || questionId;
            if (!isValidUuid(targetId)) {
                return res.status(400).json({ error: 'Valid commentId required.' });
            }

            const { data: existing, error: fetchErr } = await supabase
                .from('lms_module_discussions')
                .select('id, helpful_user_ids')
                .eq('id', targetId)
                .eq('cohort_id', member.cohort.id)
                .maybeSingle();

            if (fetchErr) {
                if (fetchErr.code === '42703') {
                    return res.status(400).json({
                        error: 'Database column helpful_user_ids not added yet — run the 3-line ALTER TABLE SQL in Supabase first.',
                    });
                }
                return res.status(500).json({ error: fetchErr.message });
            }
            if (!existing) return res.status(404).json({ error: 'Post not found.' });

            const currentIds: string[] = Array.isArray(existing.helpful_user_ids) ? existing.helpful_user_ids : [];
            const uid = member.enrollment.user_id;
            const hasReacted = currentIds.includes(uid);
            const nextIds = hasReacted ? currentIds.filter((id) => id !== uid) : [...currentIds, uid];

            const { error: updErr } = await supabase
                .from('lms_module_discussions')
                .update({ helpful_user_ids: nextIds })
                .eq('id', targetId)
                .eq('cohort_id', member.cohort.id);

            if (updErr) return res.status(500).json({ error: updErr.message });
            return res.status(200).json({
                commentId: targetId,
                helpful_count: nextIds.length,
                viewer_marked_helpful: !hasReacted,
            });
        }

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
