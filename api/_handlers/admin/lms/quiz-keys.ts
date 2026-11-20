import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { requireLmsAdmin } from '../../../_lib/lmsGate.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const admin = await requireLmsAdmin(req, res);
    if (!admin) return;

    if (req.method === 'GET') {
        const lessonId = String(req.query?.lessonId || '').trim();
        if (lessonId) {
            const { data, error } = await supabase
                .from('lms_lessons')
                .select('id, title, quiz_questions_json, quiz_keys_verified, pass_threshold_pct, lms_modules(title)')
                .eq('id', lessonId)
                .eq('lesson_type', 'quiz')
                .single();
            if (error) return res.status(404).json({ error: error.message });
            return res.status(200).json({ quiz: data });
        }

        const { data, error } = await supabase
            .from('lms_lessons')
            .select('id, title, global_order, quiz_keys_verified, pass_threshold_pct, lms_modules(title, global_order, target_week)')
            .eq('lesson_type', 'quiz')
            .order('global_order', { ascending: true });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ quizzes: data || [] });
    }

    if (req.method === 'PATCH') {
        const { lessonId, questions, verified = true, passThresholdPct = 80 } = req.body || {};
        if (!lessonId || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'lessonId and questions array required.' });
        }

        const { data, error } = await supabase
            .from('lms_lessons')
            .update({
                quiz_questions_json: questions,
                quiz_keys_verified: Boolean(verified),
                pass_threshold_pct: Math.max(50, Math.min(100, Number(passThresholdPct) || 80)),
            })
            .eq('id', lessonId)
            .eq('lesson_type', 'quiz')
            .select('id, title, quiz_keys_verified')
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ quiz: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
