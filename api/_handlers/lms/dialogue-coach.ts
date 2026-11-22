import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase.js';
import {
    checkModuleDialogueUnlocked,
    isValidUuid,
    logLmsEvent,
    requireLmsMember,
    sanitizePlainText,
} from '../../_lib/lmsGate.js';
import { BAFOS_CONTEXT, getModuleDialogueScenario } from '../../_lib/bafosPracticum.js';

const MAX_TURNS = 4; // Strict 4-turn conclusive arc: 1 Clarify -> 2 Trade-Off -> 3 Final Decision -> 4 Conclusive Debrief
const MAX_USER_CHARS = 600; // ~150 tokens max per user turn
const MAX_HISTORY_CHARS = 480;
const MAX_DAILY_SESSIONS_PER_LEARNER = 6;
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

interface DialogueTurn {
    role: 'assistant' | 'user';
    text: string;
}

/**
 * Ensures Gemini's strict turn-alternation contract:
 *  - First item MUST have role 'user' (never 'model')
 *  - Consecutive turns with the same role are merged cleanly
 */
function buildGeminiContents(
    history: DialogueTurn[],
    latestUserMsg: string,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const raw: Array<{ role: 'user' | 'model'; text: string }> = [
        ...history.map((h) => ({
            role: (h.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            text: h.text,
        })),
        { role: 'user', text: latestUserMsg },
    ];

    if (raw.length > 0 && raw[0].role === 'model') {
        raw.unshift({ role: 'user', text: 'Hi, I am ready to discuss this BAFOS scenario.' });
    }

    const normalized: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of raw) {
        const prev = normalized[normalized.length - 1];
        if (prev && prev.role === item.role) {
            prev.parts[0].text = `${prev.parts[0].text}\n\n${item.text}`;
        } else {
            normalized.push({ role: item.role, parts: [{ text: item.text }] });
        }
    }
    return normalized;
}

function buildTurnInstruction(params: {
    turn: number;
    modTitle: string;
    courseTitle: string;
    learnerName: string;
    persona: string;
    personaRole: string;
    scenarioPrompt: string;
}): string {
    const { turn, modTitle, courseTitle, learnerName, persona, personaRole, scenarioPrompt } = params;

    if (turn >= MAX_TURNS) {
        return `You are a sharp, supportive Enterprise AI PM Coach concluding a 4-turn BAFOS roleplay for "${modTitle}" (${courseTitle}).
Product context: ${BAFOS_CONTEXT}
Scenario: ${scenarioPrompt}
${learnerName} just gave their final Turn 4 response to ${persona} (${personaRole}).
Step OUT of character and close the session conclusively (do NOT ask another question). Output plain text with exactly 3 brief bullets:
• What you nailed for BAFOS: (1–2 concrete strengths from their answers)
• Blind spot to tighten: (1 realistic BAFOS product, metric, or builder-trust nuance)
• Bring to Sunday Standup: (1 crisp product call or point to debate with the cohort)
Keep the entire response complete and under 130 words.`;
    }

    const turnGoal =
        turn === 1
            ? 'Turn 1 of 4 (Clarify & Challenge): Briefly acknowledge one specific point they made, then challenge the biggest real-world BAFOS tension (signal vs. noise, builder trust, or customer value) with ONE sharp question.'
            : turn === 2
              ? 'Turn 2 of 4 (Trade-Off & Metric): React to their answer and press them on ONE concrete BAFOS trade-off, scope cut, or measurable success metric.'
              : 'Turn 3 of 4 (Final Decision Check): Explicitly signal we are wrapping up ("Last question before we lock this in...") and ask for their single final recommendation/decision for BAFOS so we can conclude on the next turn.';

    return `You are roleplaying as ${persona}, ${personaRole}, in a brief 4-turn meeting about BAFOS for "${modTitle}" (${courseTitle}).
Product context: ${BAFOS_CONTEXT}
Scenario: ${scenarioPrompt}
${turnGoal}
Rules:
- Stay in character as ${persona}. Be realistic, direct, and concise.
- Maximum 2–3 complete sentences (strictly under 65 words). Never use bullet lists or long lectures.
- Always finish your sentence cleanly.`;
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
            error: 'AI Coach is not configured yet (add GEMINI_API_KEY to activate). Use Cohort Scenario Dialogue in the meantime.',
        });
    }

    const { moduleId, history, userMessage } = req.body || {};
    if (!isValidUuid(moduleId)) {
        return res.status(400).json({ error: 'Valid moduleId is required.' });
    }

    const isAdmin = member.enrollment.role === 'admin';

    // Strict end-of-module gating (also protects Gemini free-tier quota)
    const dialogueAccess = await checkModuleDialogueUnlocked({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        moduleId,
        isAdmin,
    });
    if (!dialogueAccess.unlocked) {
        return res.status(403).json({
            aiConfigured: true,
            error: dialogueAccess.reason || 'Complete this module’s quiz/project first to unlock AI Coach.',
            dialogueAccess,
        });
    }

    const cleanMsg = sanitizePlainText(userMessage, MAX_USER_CHARS);
    if (cleanMsg.length < 5) {
        return res.status(400).json({ error: 'Write at least a short sentence (5+ characters) to continue the dialogue.' });
    }

    const safeHistory: DialogueTurn[] = Array.isArray(history)
        ? history
              .slice(-6)
              .map((h: any) => ({
                  role: (h?.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                  text: sanitizePlainText(h?.text, MAX_HISTORY_CHARS),
              }))
              .filter((h) => h.text.length > 0)
        : [];

    const userTurnsSoFar = safeHistory.filter((h) => h.role === 'user').length;
    if (userTurnsSoFar >= MAX_TURNS) {
        return res.status(400).json({
            aiConfigured: true,
            error: 'This 4-turn AI Coach session is already complete. Click "Practice Again" to start a fresh session or share your insight to the cohort.',
        });
    }

    const currentTurn = userTurnsSoFar + 1;
    const isFinalDebrief = currentTurn >= MAX_TURNS;

    // Soft per-learner daily session cap checked only on Turn 1 (protects free-tier Gemini quota)
    if (currentTurn === 1 && !isAdmin) {
        const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
            .from('lms_activity_events')
            .select('id', { count: 'exact', head: true })
            .eq('cohort_id', member.cohort.id)
            .eq('user_id', member.enrollment.user_id)
            .eq('event_type', 'ai_dialogue_completed')
            .gte('created_at', sinceIso);

        if ((count || 0) >= MAX_DAILY_SESSIONS_PER_LEARNER) {
            return res.status(429).json({
                aiConfigured: true,
                error: `Daily AI Coach limit reached (${MAX_DAILY_SESSIONS_PER_LEARNER} sessions/24h). You can continue sharing in Cohort Scenario right away.`,
            });
        }
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

    const systemInstruction = buildTurnInstruction({
        turn: currentTurn,
        modTitle: mod.title,
        courseTitle,
        learnerName: member.enrollment.full_name,
        persona: scenario.roleplayPersona,
        personaRole: scenario.personaRole,
        scenarioPrompt: scenario.scenarioPrompt,
    });

    const contents = buildGeminiContents(safeHistory, cleanMsg);

    let lastErrorDetail = '';
    for (const model of GEMINI_MODELS) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const genConfig: Record<string, any> = {
                temperature: 0.6,
                // Tight yet safe output token caps so responses are concise AND never truncated mid-sentence
                maxOutputTokens: isFinalDebrief ? 300 : 180,
            };
            if (model.startsWith('gemini-2.5')) {
                genConfig.thinkingConfig = { thinkingBudget: 0 };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    contents,
                    generationConfig: genConfig,
                }),
                signal: AbortSignal.timeout(15000),
            });

            const payload: any = await response.json().catch(() => ({}));
            if (!response.ok) {
                lastErrorDetail = payload?.error?.message || `HTTP ${response.status}`;
                console.error(`[lms/dialogue-coach] ${model} failed (${response.status}):`, lastErrorDetail);
                if (response.status === 401 || response.status === 403) {
                    return res.status(502).json({
                        aiConfigured: true,
                        error: `Gemini API key rejected (${lastErrorDetail}). Check GEMINI_API_KEY in Vercel/env.`,
                    });
                }
                continue;
            }

            const replyText =
                payload?.candidates?.[0]?.content?.parts
                    ?.filter((p: any) => !p?.thought)
                    ?.map((p: any) => p?.text || '')
                    .join('')
                    .trim() || '';

            if (!replyText) {
                lastErrorDetail = 'Empty candidate text';
                console.error(`[lms/dialogue-coach] ${model} returned empty text:`, JSON.stringify(payload).slice(0, 300));
                continue;
            }

            if (isFinalDebrief) {
                await logLmsEvent({
                    cohortId: member.cohort.id,
                    userId: member.enrollment.user_id,
                    eventType: 'ai_dialogue_completed',
                    metadata: { moduleId: mod.id, moduleTitle: mod.title, turns: currentTurn, model },
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
            lastErrorDetail = err?.message || 'Network timeout';
            console.error(`[lms/dialogue-coach] ${model} exception:`, lastErrorDetail);
        }
    }

    return res.status(502).json({
        aiConfigured: true,
        error: `AI Coach could not respond right now (${lastErrorDetail || 'upstream error'}). Please retry or post in Cohort Scenario.`,
    });
}
