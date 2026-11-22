export interface ModuleDialogueScenario {
    title: string;
    roleplayPersona: string;
    personaRole: string;
    scenarioPrompt: string;
    openingMessage: string;
    guidingQuestions: string[];
    standupDebateHook: string;
}

const SCENARIO_BY_KEYWORDS: Array<{ keywords: string[]; scenario: ModuleDialogueScenario }> = [
    {
        keywords: ['orientation', 'introduction', 'welcome'],
        scenario: {
            title: 'Setting Your 12-Week AI PM Mission',
            roleplayPersona: 'Sarah Chen',
            personaRole: 'VP of Product',
            scenarioPrompt:
                'You are starting a 12-week enterprise AI product management track. Leadership asks what one real workflow at CortDevs you want to re-think through an AI PM lens over the next 90 days—and how you will measure whether your thinking actually improved.',
            openingMessage:
                'Welcome aboard! Before we dive into frameworks, tell me: what specific product or workflow challenge are you hoping to get sharper at over the next 12 weeks, and why does it matter to real users?',
            guidingQuestions: [
                'What customer problem do you want to understand more deeply?',
                'How will you apply weekly frameworks to real work instead of just memorizing theory?',
            ],
            standupDebateHook: 'Compare one habit each teammate plans to change in how they evaluate product ideas this week.',
        },
    },
    {
        keywords: ['foundation', 'responsibilit', 'fundamentals', 'core'],
        scenario: {
            title: 'Your First Week as an Enterprise Product Manager',
            roleplayPersona: 'Marcus Osei',
            personaRole: 'Principal Engineering Lead',
            scenarioPrompt:
                'During your first week on an enterprise SaaS team, the Engineering Lead says: "Our engineers already talk to customers and ship fast—why do we need a PM slowing us down with docs?" Explain your core responsibilities and how PM decisions connect directly to business outcomes.',
            openingMessage:
                'Hey, glad you joined the team. Honestly, engineering has been talking to clients directly and shipping features every sprint. What value are you bringing that we aren’t already covering?',
            guidingQuestions: [
                'How does PM work differ from Engineering and Project Management?',
                'How will you partner with engineers rather than micromanage delivery?',
                'How do you tie feature priorities to measurable business outcomes?',
            ],
            standupDebateHook: 'Where is the sharpest line between a PM deciding "what & why" vs. Engineering owning "how"?',
        },
    },
    {
        keywords: ['market research', 'research technique', 'research toolkit', 'collecting'],
        scenario: {
            title: 'Defending Discovery Time Before Writing Code',
            roleplayPersona: 'David Adeyemi',
            personaRole: 'Head of Sales',
            scenarioPrompt:
                'Sales just lost a big deal and demands you immediately build a custom reporting module by next month. You believe the team needs 10 days of structured market & customer research first. Make your case without sounding like you are stalling revenue.',
            openingMessage:
                'We just lost a $120K renewal because we didn’t have custom executive reports. Why are you asking for two weeks of "market research" when the customer literally told us what they want?',
            guidingQuestions: [
                'Which qualitative and quantitative research methods give the fastest signal in 10 days?',
                'How do you distinguish one loud prospect’s request from a repeatable market pattern?',
            ],
            standupDebateHook: 'When is a sales-driven feature request worth building fast vs. pausing for deeper research?',
        },
    },
    {
        keywords: ['lifecycle', 'pdlc', 'development life'],
        scenario: {
            title: 'Navigating a Slipping Product Lifecycle Stage',
            roleplayPersona: 'Elena Morales',
            personaRole: 'Enterprise Delivery Manager',
            scenarioPrompt:
                'Your product is in the Build phase, but beta customers keep asking for major scope changes that belong back in Discovery. How do you manage lifecycle gates so you ship on time without launching the wrong solution?',
            openingMessage:
                'We are 3 weeks from beta freeze and two pilot customers just asked to completely change our onboarding workflow. Do we pause the build or push ahead as planned?',
            guidingQuestions: [
                'How do you evaluate whether new feedback is a launch blocker vs. a v1.1 iteration?',
                'What lifecycle artifacts help stakeholders see the trade-off clearly?',
            ],
            standupDebateHook: 'Share a time (or scenario) where skipping a lifecycle gate caused rework later.',
        },
    },
    {
        keywords: ['vision', 'strategy', 'positioning'],
        scenario: {
            title: 'Turning Features Into a Coherent Product Strategy',
            roleplayPersona: 'Amara Nwosu',
            personaRole: 'Chief Executive Officer',
            scenarioPrompt:
                'Your quarterly plan lists 14 disconnected feature requests from different departments. The CEO asks: "What is our actual 18-month product vision, and what are we deliberately saying NO to?"',
            openingMessage:
                'I read your feature list—everything looks nice, but I don’t see a strategy. If we can only win on ONE core differentiator over the next 18 months, what is it and what are we cutting?',
            guidingQuestions: [
                'What makes a product vision inspiring yet concrete enough to guide trade-offs?',
                'How do you frame strategic "no’s" so stakeholders stay aligned?',
            ],
            standupDebateHook: 'What is the hardest "good idea" you would cut to protect product focus?',
        },
    },
    {
        keywords: ['buyer', 'persona', 'segmentation', 'psychology'],
        scenario: {
            title: 'Buyer vs. End-User Conflict in Enterprise B2B',
            roleplayPersona: 'Rachel Kim',
            personaRole: 'Enterprise Procurement & IT Director',
            scenarioPrompt:
                'In enterprise software, the CISO/VP signs the check while frontline analysts use the tool daily. Your design delights daily users, but the executive buyer cares about compliance and audit logs. How do you segment and balance both personas?',
            openingMessage:
                'Your UX demo looked slick for analysts, sure—but my security and procurement team won’t approve a vendor without SOC2 audit trails and role-based access. Why should I sign this contract?',
            guidingQuestions: [
                'How do buyer personas differ from end-user personas in enterprise sales?',
                'Which persona pain points block adoption vs. block contract signature?',
            ],
            standupDebateHook: 'When buyer needs and end-user needs clash, how should an enterprise PM sequence them?',
        },
    },
    {
        keywords: ['competitive', 'swot', 'jtbd', 'jobs to be done'],
        scenario: {
            title: 'Responding to a Rival’s Surprise AI Launch',
            roleplayPersona: 'Tunde Balogun',
            personaRole: 'VP of Marketing',
            scenarioPrompt:
                'Your biggest competitor just announced a flashy AI assistant and Marketing wants an identical feature in 6 weeks. Use Competitive Intelligence, SWOT, and Jobs-to-be-Done (JTBD) to recommend a smarter strategic move.',
            openingMessage:
                'Did you see our competitor’s keynote? They launched an AI chatbot this morning and prospects are already asking about it. Can we match their feature list before next quarter?',
            guidingQuestions: [
                'What customer "job" is the competitor actually solving—and where is their weakness?',
                'When is feature parity a trap vs. table stakes?',
            ],
            standupDebateHook: 'Should you ever copy a competitor’s AI feature quickly, or always differentiate on JTBD?',
        },
    },
    {
        keywords: ['ai market', 'market dynamic', 'emerging'],
        scenario: {
            title: 'Evaluating Build vs. Buy in a Fast-Moving AI Market',
            roleplayPersona: 'Dr. Priya Nair',
            personaRole: 'AI Engineering Director',
            scenarioPrompt:
                'Foundation models improve every quarter. Leadership is debating training a proprietary model vs. building workflows on top of API models + proprietary enterprise data. Defend where lasting moat actually lives.',
            openingMessage:
                'If we build on commercial LLM APIs, won’t competitors clone us in a weekend? Shouldn’t we spend 9 months training our own custom model instead?',
            guidingQuestions: [
                'Where does defensible value live in AI products: model weights, proprietary workflow data, or distribution?',
                'How do you manage vendor lock-in and inference cost risk?',
            ],
            standupDebateHook: 'Where is the real moat for a mid-sized software company building AI products today?',
        },
    },
    {
        keywords: ['ideation', 'copilot', 'brainstorm'],
        scenario: {
            title: 'Filtering 30 AI Ideas Down to 1 High-Impact Bet',
            roleplayPersona: 'Daniel Brooks',
            personaRole: 'Customer Success Lead',
            scenarioPrompt:
                'After an ideation workshop with Copilot, your team has 30 AI feature concepts—from auto-summarizing tickets to predictive churn alerts. Walk through how you evaluate feasibility, data readiness, and user trust to pick the single best pilot.',
            openingMessage:
                'The team loved the brainstorm and came up with 30 AI ideas! Everyone thinks theirs should be first. How do we narrow this down objectively without playing favorites?',
            guidingQuestions: [
                'Which criteria matter most for an AI pilot: data quality, error tolerance, or frequency of pain?',
                'How can a PM use AI tools to accelerate ideation without losing customer grounding?',
            ],
            standupDebateHook: 'What makes a problem a GREAT fit for generative AI vs. a classic deterministic rule?',
        },
    },
    {
        keywords: ['smart', 'kpi', 'power bi', 'metric', 'objective'],
        scenario: {
            title: 'Choosing North-Star Metrics That Can’t Be Gamed',
            roleplayPersona: 'Grace Okafor',
            personaRole: 'Finance & BizOps Partner',
            scenarioPrompt:
                'Your team celebrates 10,000 AI prompts triggered this month, yet customer retention hasn’t budged. Redesign the KPI tree with SMART objectives and outcome metrics that prove genuine business value.',
            openingMessage:
                'Usage of our new AI button is up 300%, which looks great on a slide—but renewals are flat and API costs doubled. What metric actually proves this feature is working?',
            guidingQuestions: [
                'What is the difference between vanity activity metrics and outcome/value metrics?',
                'What guardrail metric protects against AI hallucinations or rising inference costs?',
            ],
            standupDebateHook: 'Which vanity metric fools product teams the most when launching AI features?',
        },
    },
    {
        keywords: ['roadmap', 'ms project', 'microsoft project', 'prioritiz'],
        scenario: {
            title: 'Defending an Outcome-Based Roadmap to Executives',
            roleplayPersona: 'Michael Vance',
            personaRole: 'Chief Operating Officer',
            scenarioPrompt:
                'Executives are asking for exact ship dates 9 months out on every item, while engineering warns AI evaluation accuracy is still uncertain. Present a roadmap structure that gives leadership predictability without fake precision.',
            openingMessage:
                'I need exact launch dates for Q1, Q2, and Q3 so I can commit to enterprise clients. Why does your roadmap show "Now / Next / Later" themes instead of fixed dates?',
            guidingQuestions: [
                'How do you balance executive predictability with discovery/AI uncertainty?',
                'Which prioritization framework (RICE, MoSCoW, Value vs. Effort) fits enterprise trade-offs best?',
            ],
            standupDebateHook: 'How do you handle a stakeholder who insists on a hard date for an unproven AI feature?',
        },
    },
    {
        keywords: ['requirement', 'prd', 'qa', 'quality', 'user stor', 'acceptance'],
        scenario: {
            title: 'Writing Acceptance Criteria for Probabilistic AI Features',
            roleplayPersona: 'Nadia Hassan',
            personaRole: 'QA & Release Lead',
            scenarioPrompt:
                'Classic software has binary pass/fail tests, but your AI summarization feature produces slightly different outputs every run. Define clear requirements, evaluation thresholds, and fallback UX so QA can sign off confidently.',
            openingMessage:
                'I can’t sign off on this PRD—how am I supposed to test an AI output that changes every time I click Generate? What does "working" actually mean here?',
            guidingQuestions: [
                'How do you write measurable evaluation criteria (accuracy, latency, citation grounding) in a PRD?',
                'What graceful fallback should happen when the AI has low confidence?',
            ],
            standupDebateHook: 'What belongs in an AI PRD that you would never have written in a traditional CRUD PRD?',
        },
    },
    {
        keywords: ['stakeholder', 'alignment', 'communication', 'ai product development'],
        scenario: {
            title: 'Aligning Legal, Security, and Sales on an AI Rollout',
            roleplayPersona: 'Victor Eze',
            personaRole: 'Enterprise Legal Counsel',
            scenarioPrompt:
                'Sales wants to launch your AI assistant to all 500 enterprise tenants next Monday, while Legal is worried about customer data privacy and hallucinated advice. Broker a phased rollout plan both sides can endorse.',
            openingMessage:
                'If one customer’s confidential contract leaks into another tenant’s prompt—or the AI gives bad compliance advice—we are exposed. I’m putting a hold on Monday’s launch unless you convince me otherwise.',
            guidingQuestions: [
                'How do you address Legal’s real risk without killing launch momentum?',
                'What phased rollout guardrails (opt-in beta, human-in-the-loop, data boundaries) unlock alignment?',
            ],
            standupDebateHook: 'What is the best way to turn Legal/Security from a "last-minute blocker" into an early partner?',
        },
    },
    {
        keywords: ['design', 'ux', 'ui', 'accessibility', 'inclusive'],
        scenario: {
            title: 'Making an AI Experience Accessible & Trustworthy',
            roleplayPersona: 'Chloe Bennett',
            personaRole: 'Senior Product Designer',
            scenarioPrompt:
                'To ship faster, a stakeholder suggests cutting keyboard navigation, screen-reader labels, and "Why did AI suggest this?" explanations until v2. Advocate for inclusive UX and explainability as core product quality.',
            openingMessage:
                'We are short on frontend hours. If we drop WCAG contrast checks and AI confidence indicators for v1, we can launch 5 days earlier. Are you okay shipping without them?',
            guidingQuestions: [
                'Why is explainability (showing sources/confidence) essential for user trust in AI?',
                'What is the real enterprise cost of treating accessibility as a "later" checkbox?',
            ],
            standupDebateHook: 'What makes an AI interface feel trustworthy vs. frustratingly opaque?',
        },
    },
    {
        keywords: ['heuristic', 'wireframe', 'mockup', 'figma', 'prototype'],
        scenario: {
            title: 'Critiquing a Wireframe Before Engineering Starts',
            roleplayPersona: 'Liam O’Connor',
            personaRole: 'UX Researcher',
            scenarioPrompt:
                'A high-fidelity Figma prototype looks visually polished, but during a heuristic review you spot 6 clicks just to verify and edit an AI-generated draft. Give constructive, user-centered feedback that focuses on the workflow problem.',
            openingMessage:
                'Engineering wants to start building this Figma mockup tomorrow. It looks super clean visually—do you really think we need to iterate on the wireframe again?',
            guidingQuestions: [
                'Which usability heuristics matter most when users review and edit AI outputs?',
                'How can 1 day of low-fidelity iteration save 3 weeks of engineering rework?',
            ],
            standupDebateHook: 'What is the fastest usability heuristic check any PM can run on a mockup in 10 minutes?',
        },
    },
    {
        keywords: ['usability', 'ethical', 'human-ai', 'responsible', 'bias'],
        scenario: {
            title: 'Catching Bias & Over-Reliance in Usability Testing',
            roleplayPersona: 'Dr. Fatima Bello',
            personaRole: 'Responsible AI Reviewer',
            scenarioPrompt:
                'In usability testing, 80% of participants blindly accepted an AI recommendation even when it contained an obvious error. How do you redesign the human-in-the-loop interaction to prevent automation bias?',
            openingMessage:
                'Our test showed users blindly click "Approve" on AI outputs without reading them—even when the AI makes a biased or wrong call. How do we prevent rubber-stamping without ruining speed?',
            guidingQuestions: [
                'What UI patterns encourage healthy human verification instead of blind trust?',
                'How do you test for fairness and edge-case failure modes before broad release?',
            ],
            standupDebateHook: 'How much friction is healthy in an AI workflow to keep humans genuinely in control?',
        },
    },
    {
        keywords: ['launch', 'go-to-market', 'gtm', 'marketing', 'sales enablement'],
        scenario: {
            title: 'Orchestrating a High-Stakes B2B Enterprise Launch',
            roleplayPersona: 'Kemi Adeola',
            personaRole: 'Director of Product Marketing',
            scenarioPrompt:
                'Launch day is 3 weeks away, but Sales doesn’t know how to demo the AI feature without overpromising accuracy, and Support has no troubleshooting playbook. Prioritize your GTM & enablement checklist.',
            openingMessage:
                'Sales reps are already pitching this AI feature as "100% automated" to close deals, and Support says they haven’t even seen the tool yet. How are we getting everyone ready before launch?',
            guidingQuestions: [
                'What must Sales enablement include so reps sell the real capability honestly?',
                'How do you structure a tiered launch (canary → beta → GA) to protect customer trust?',
            ],
            standupDebateHook: 'What single launch readiness gap causes the biggest post-launch headaches in B2B?',
        },
    },
    {
        keywords: ['risk', 'post-launch', 'monitor', 'operations', 'lifecycle', 'governance', 'workflow'],
        scenario: {
            title: 'Handling Model Drift & Rising Costs Post-Launch',
            roleplayPersona: 'Samuel Mensah',
            personaRole: 'Site Reliability & AI Ops Lead',
            scenarioPrompt:
                'Six weeks after launch, AI answer quality dropped 14% after an upstream model update and API spend is 2.5x forecast. Walk through your post-launch incident response, KPI monitoring, and continuous improvement loop.',
            openingMessage:
                'Alert: thumbs-down feedback jumped 14% since Tuesday and our monthly AI API bill just crossed 250% of budget. What’s our immediate move and long-term fix?',
            guidingQuestions: [
                'What immediate containment steps protect customers while you diagnose root cause?',
                'What ongoing monitoring (evals, latency, cost-per-task, feedback loops) should every AI PM own post-launch?',
            ],
            standupDebateHook: 'Why is launching an AI product really just Day 1 compared to traditional software?',
        },
    },
];

const FALLBACK_SCENARIO: ModuleDialogueScenario = {
    title: 'Applying This Module to a Real Enterprise Product Decision',
    roleplayPersona: 'Sarah Chen',
    personaRole: 'VP of Product',
    scenarioPrompt:
        'Imagine you need to apply the frameworks from this module to an active CortDevs product tomorrow morning. An executive asks what single decision you would change based on what you learned—and what trade-off you are accepting.',
    openingMessage:
        'You just wrapped up this module—let’s make it practical. What is one concrete product decision you would handle differently now, and how would you defend the trade-off to stakeholders?',
    guidingQuestions: [
        'Which framework from this module applies most directly to your current or future product work?',
        'What pushback would you expect from engineering, design, or leadership—and how would you respond?',
    ],
    standupDebateHook: 'What was the most counter-intuitive insight from this module that sparked debate?',
};

export function getModuleDialogueScenario(
    moduleTitle = '',
    courseTitle = '',
): ModuleDialogueScenario {
    const haystack = `${moduleTitle} ${courseTitle}`.toLowerCase();
    for (const entry of SCENARIO_BY_KEYWORDS) {
        if (entry.keywords.some((kw) => haystack.includes(kw))) {
            return entry.scenario;
        }
    }
    return FALLBACK_SCENARIO;
}
