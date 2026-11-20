import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { requireLmsMember } from '../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const member = await requireLmsMember(req, res);
    if (!member) return;

    if (req.method === 'GET') {
        const moduleId = String(req.query?.moduleId || '').trim();
        if (!moduleId) return res.status(400).json({ error: 'moduleId required' });

        const { data: rows, error } = await supabase
            .from('lms_module_discussions')
            .select('*')
            .eq('cohort_id', member.cohort.id)
            .eq('module_id', moduleId)
            .order('created_at', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });

        const userIds = [...new Set((rows || []).map((r: any) => r.user_id))];
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

        return res.status(200).json({
            comments: (rows || []).map((r: any) => ({
                ...r,
                author_name: authorMap.get(r.user_id)?.full_name || 'Teammate',
                author_role: authorMap.get(r.user_id)?.role || 'learner',
            })),
        });
    }

    if (req.method === 'POST') {
        const { moduleId, body, parentId } = req.body || {};
        const cleanBody = String(body || '').trim();
        if (!moduleId || cleanBody.length < 3) {
            return res.status(400).json({ error: 'moduleId and a comment body are required.' });
        }

        const { data, error } = await supabase
            .from('lms_module_discussions')
            .insert({
                cohort_id: member.cohort.id,
                module_id: moduleId,
                user_id: member.enrollment.user_id,
                parent_id: parentId || null,
                body: cleanBody,
            })
            .select('*')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({
            comment: {
                ...data,
                author_name: member.enrollment.full_name,
                author_role: member.enrollment.role,
            },
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
