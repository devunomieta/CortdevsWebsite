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

const MAX_TURNS = 4; // 4 user turns -> final turn produces a crisp 3-bullet PM Coach Debrief
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
function buildGeminiContents(history: DialogueTurn[], latestUserMsg: string): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const raw: Array<{ role: 'user' | 'model'; text: string }> = [
        ...history.map((h) => ({
            role: (h.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            text: h.text,
        })),
        { role: 'user', text: latestUserMsg },
    ];

    // If the conversation opens with the AI stakeholder's greeting ('model'), prepend a clean 'user' opener
    if (raw.length > 0 && raw[0].role === 'model') {
        raw.unshift({ role: 'user', text: 'Hi, I am ready to discuss this BAFOS scenario with you.' });
    }

    // Merge consecutive same-role messages so Gemini never throws an alternation 400
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

    // Strict end-of-module gating (also protects Gemini free-tier quota!)
    const dialogueAccess = await checkModuleDialogueUnlocked({
        cohortId: member.cohort.id,
        userId: member.enrollment.user_id,
        moduleId,
        isAdmin: member.enrollment.role === 'admin',
    });
    if (!dialogueAccess.unlocked) {
        return res.status(403).json({
            aiConfigured: true,
            error: dialogueAccess.reason || 'Complete this module’s quiz/project first to unlock AI Coach.',
            dialogueAccess,
        });
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
        ? `You are a sharp, practical Enterprise AI Product Management Coach wrapping up a BAFOS product roleplay for the module "${mod.title}" (${courseTitle}).
Live product being built by the team: ${BAFOS_CONTEXT}
Scenario context: ${scenario.scenarioPrompt}
The learner (${member.enrollment.full_name}) just finished their final response in a ${MAX_TURNS}-turn stakeholder dialogue with ${scenario.roleplayPersona} (${scenario.personaRole}).
Now step OUT of character and give a concise, actionable PM Coach Debrief in plain text with exactly 3 short bullet sections:
• What you nailed for BAFOS: (1–2 specific strengths from their answers)
• Blind spot to consider: (1 realistic product, developer-trust, or enterprise nuance for BAFOS)
• Bring to Sunday Standup: (1 sharp question or product call they can share with their cohort)
Keep the entire debrief under 145 words. Be concrete and grounded in BAFOS (GitHub PRs/commits, CI/CD, tool health) — never generic fluff.`
        : `You are roleplaying as ${scenario.roleplayPersona}, ${scenario.personaRole}, in a realistic product meeting about BAFOS for the module "${mod.title}" (${courseTitle}).
Live product context: ${BAFOS_CONTEXT}
Scenario context: ${scenario.scenarioPrompt}
Rules:
1. Stay completely in character as ${scenario.roleplayPersona}. Speak naturally like a real senior teammate or enterprise buyer in a 1:1 meeting about BAFOS.
2. Acknowledge one concrete point the learner just made, then push back gently or ask ONE focused follow-up question that tests real-world AI PM judgment on BAFOS (e.g. GitHub/tool signal vs. noise, developer trust, scope trade-offs, metrics, or security).
3. Keep your reply concise: 2 to 4 sentences max (under 85 words). Never lecture or output textbook bullet lists.
4. This is turn ${currentTurn} of ${MAX_TURNS}.`;

    const contents = buildGeminiContents(safeHistory, cleanMsg);

    let lastErrorDetail = '';
    for (const model of GEMINI_MODELS) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const genConfig: Record<string, any> = {
                temperature: 0.65,
                maxOutputTokens: isFinalDebrief ? 650 : 400,
            };
            // Disable thinking token burn on Gemini 2.5 models for instant conversational roleplay
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
                // If API key itself is invalid/unauthorized, stop retrying other models
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
