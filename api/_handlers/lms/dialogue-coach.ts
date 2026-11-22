import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import { isValidUuid, logLmsEvent, requireLmsMember, sanitizePlainText } from '../../_lib/lmsGate.js';
import { getModuleDialogueScenario } from '../../_lib/moduleDialogues.js';

const MAX_TURNS = 4; // 4 user turns -> final turn produces a crisp 3-bullet PM Coach Debrief
const GEMINI_MODEL = 'gemini-2.5-flash';

interface DialogueTurn {
    role: 'assistant' | 'user';
    text: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const member = await requireLmsMember(req, res);
    if (!member) return;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        return res.status(200).json({
            aiConfigured: false,
            error: 'AI Stakeholder Coach is not configured yet (add GEMINI_API_KEY to activate). Use Cohort Scenario Dialogue in the meantime.',
        });
    }

    const { moduleId, history, userMessage } = req.body || {};
    if (!isValidUuid(moduleId)) {
        return res.status(400).json({ error: 'Valid moduleId is required.' });
    }

    const cleanMsg = sanitizePlainText(userMessage, 1500);
    if (cleanMsg.length < 5) {
        return res.status(400).json({ error: 'Write at least a short sentence (5+ characters) to continue the dialogue.' });
    }

    const { data: mod } = await supabase
        .from('lms_modules')
        .select('id, title, target_week, lms_courses(title)')
        .eq('id', moduleId)
        .maybeSingle();

    if (!mod) {
        return res.status(404).json({ error: 'Module not found.' });
    }

    const courseTitle = (mod as any).lms_courses?.title || 'AI Product Management';
    const scenario = getModuleDialogueScenario(mod.title, courseTitle);

    const safeHistory: DialogueTurn[] = Array.isArray(history)
        ? history
              .slice(-8)
              .map((h: any) => ({
                  role: (h?.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                  text: sanitizePlainText(h?.text, 1200),
              }))
              .filter((h) => h.text.length > 0)
        : [];

    const userTurnsSoFar = safeHistory.filter((h) => h.role === 'user').length;
    const currentTurn = userTurnsSoFar + 1;
    const isFinalDebrief = currentTurn >= MAX_TURNS;

    const systemInstruction = isFinalDebrief
        ? `You are a sharp, supportive Enterprise AI Product Management Coach wrapping up a roleplay scenario for the module "${mod.title}" (${courseTitle}).
Scenario context: ${scenario.scenarioPrompt}
The learner (${member.enrollment.full_name}) just finished their final response in a ${MAX_TURNS}-turn stakeholder dialogue with ${scenario.roleplayPersona} (${scenario.personaRole}).
Now step OUT of character and give a concise, practical PM Coach Debrief in plain text with exactly 3 short bullet sections:
• What you nailed: (1–2 specific strengths from their answers)
• Blind spot to consider: (1 realistic enterprise nuance or trade-off they could sharpen)
• Bring to Sunday Standup: (1 sharp question or takeaway they can share with their cohort)
Keep the entire debrief under 140 words. Be specific, direct, and encouraging—never generic fluff.`
        : `You are roleplaying as ${scenario.roleplayPersona}, ${scenario.personaRole}, in a realistic Enterprise AI Product Management dialogue for the module "${mod.title}" (${courseTitle}).
Scenario context: ${scenario.scenarioPrompt}
Rules:
1. Stay completely in character as ${scenario.roleplayPersona}. Speak naturally like a real senior stakeholder in a 1:1 meeting.
2. Acknowledge one concrete point the learner just made, then push back gently or ask ONE focused follow-up question that tests real-world PM judgment (trade-offs, metrics, user trust, or alignment).
3. Keep your reply concise: 2 to 4 sentences max (under 85 words). Never lecture or give a bullet list of textbook answers.
4. This is turn ${currentTurn} of ${MAX_TURNS}.`;

    const contents = [
        ...safeHistory.map((h) => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
        })),
        {
            role: 'user',
            parts: [{ text: cleanMsg }],
        },
    ];

    try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents,
                generationConfig: {
                    temperature: 0.65,
                    maxOutputTokens: isFinalDebrief ? 320 : 200,
                },
            }),
            signal: AbortSignal.timeout(15000),
        });

        const payload: any = await response.json().catch(() => ({}));
        if (!response.ok) {
            const errText = payload?.error?.message || `Gemini API returned ${response.status}`;
            console.error('[lms/dialogue-coach] Gemini error:', errText);
            return res.status(502).json({
                aiConfigured: true,
                error: 'AI Coach is temporarily busy. You can retry or post directly to Cohort Scenario Dialogue.',
            });
        }

        const replyText =
            payload?.candidates?.[0]?.content?.parts
                ?.map((p: any) => p?.text || '')
                .join('')
                .trim() || '';

        if (!replyText) {
            return res.status(502).json({
                aiConfigured: true,
                error: 'AI Coach returned an empty response. Please try sending your reply again.',
            });
        }

        if (isFinalDebrief) {
            await logLmsEvent({
                cohortId: member.cohort.id,
                userId: member.enrollment.user_id,
                eventType: 'ai_dialogue_completed',
                metadata: { moduleId: mod.id, moduleTitle: mod.title, turns: currentTurn },
            }).catch(() => {});
        }

        return res.status(200).json({
            aiConfigured: true,
            reply: replyText,
            turn: currentTurn,
            maxTurns: MAX_TURNS,
            isFinalDebrief,
        });
    } catch (err: any) {
        console.error('[lms/dialogue-coach] Fetch failed:', err?.message || err);
        return res.status(503).json({
            aiConfigured: true,
            error: 'Could not reach AI Coach right now. Please retry in a moment.',
        });
    }
}
