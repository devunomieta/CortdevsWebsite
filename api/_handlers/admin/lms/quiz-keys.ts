import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';
import { isValidUuid, requireLmsAdmin, sanitizePlainText, sanitizeSingleLine } from '../../../_lib/lmsGate.js';

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
        if (!isValidUuid(lessonId) || !Array.isArray(questions) || questions.length === 0 || questions.length > 100) {
            return res.status(400).json({ error: 'Valid lessonId and questions array (1–100 items) required.' });
        }

        const sanitizedQuestions = questions.map((q: any, idx: number) => {
            const options = Array.isArray(q?.options)
                ? q.options.slice(0, 12).map((o: unknown) => sanitizePlainText(o, 600))
                : [];
            const maxOpt = Math.max(0, options.length - 1);
            const correctIndices: number[] = Array.isArray(q?.correct_indices)
                ? [...new Set<number>(q.correct_indices.map((v: unknown) => Number(v)))]
                      .filter((n) => Number.isInteger(n) && n >= 0 && n <= maxOpt)
                      .sort((a, b) => a - b)
                : [];
            return {
                id: sanitizeSingleLine(q?.id, 40) || `q${idx + 1}`,
                prompt: sanitizePlainText(q?.prompt, 1500),
                type: q?.type === 'multi' ? 'multi' : 'single',
                options,
                correct_indices: correctIndices,
                explanation: sanitizePlainText(q?.explanation, 1000),
            };
        });

        const { data, error } = await supabase
            .from('lms_lessons')
            .update({
                quiz_questions_json: sanitizedQuestions,
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
