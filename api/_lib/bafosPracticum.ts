export const BAFOS_CONTEXT =
    'BAFOS is CortDevs’ software engineering & founder intelligence platform that connects the tools used by founders, builders, and software teams—such as GitHub (commits, PRs, code reviews), CI/CD pipelines, Jira/Linear tasks, uptime & error monitors, and Slack—to monitor engineering velocity, delivery risk, and system health in one calm workspace.';

export interface ModuleDialogueScenario {
    title: string;
    roleplayPersona: string;
    personaRole: string;
    scenarioPrompt: string;
    openingMessage: string;
    guidingQuestions: string[];
    standupDebateHook: string;
}

export interface WeeklyStandupGuide {
    week: number;
    theme: string;
    questions: string[];
}

export interface BafosProjectLens {
    headline: string;
    focusPrompt: string;
    suggestedDeliverable: string;
    bafosToolsInScope: string[];
}

const SCENARIO_BY_KEYWORDS: Array<{ keywords: string[]; scenario: ModuleDialogueScenario }> = [
    {
        keywords: ['orientation', 'introduction', 'welcome'],
        scenario: {
            title: 'Defining Your 12-Week BAFOS AI PM Mission',
            roleplayPersona: 'Sarah Chen',
            personaRole: 'VP of Product (BAFOS)',
            scenarioPrompt:
                'We are building BAFOS to connect founders’ and builders’ tools (GitHub commits/PRs, CI/CD, issue trackers, and alerts) into clear health visibility. Leadership asks which part of BAFOS’s product strategy you want to sharpen over these 12 weeks—and what real team pain you want to solve first.',
            openingMessage:
                'Welcome to the BAFOS AI PM track! Before we dive in, tell me: when a founder or engineering lead connects GitHub and their dev tools to BAFOS, what single blind spot do you think BAFOS must solve first—and why?',
            guidingQuestions: [
                'What visibility gap do founders and builders struggle with across GitHub, PRs, and deployment tools?',
                'How will you apply each week’s AI PM frameworks directly to BAFOS decisions?',
            ],
            standupDebateHook: 'What is the #1 blind spot founders face today across their engineering tools that BAFOS should fix first?',
        },
    },
    {
        keywords: ['foundation', 'responsibilit', 'core'],
        scenario: {
            title: 'BAFOS PM vs. Engineering: Defining Ownership',
            roleplayPersona: 'Marcus Osei',
            personaRole: 'BAFOS Principal Engineering Lead',
            scenarioPrompt:
                'Our engineers are rapidly shipping the GitHub commits & PR ingestion connector for BAFOS. The Engineering Lead asks: "We already know how to pull GitHub webhooks and chart commit counts—why do we need a PM slowing us down with problem statements and outcome metrics?"',
            openingMessage:
                'Hey, glad to have you on BAFOS. Honestly, my engineers can already pull GitHub commits, PR merges, and build statuses and put them on a chart. What product decisions are you bringing that engineering isn’t already covering?',
            guidingQuestions: [
                'How does turning raw GitHub events into actionable health signals require product thinking, not just API plumbing?',
                'How will you partner with BAFOS engineers on "what & why" without micromanaging technical architecture?',
                'How do PM decisions connect BAFOS features directly to founder retention and business outcomes?',
            ],
            standupDebateHook: 'For BAFOS, where is the sharpest line between a PM deciding "what health signal matters" vs. Engineering deciding "how to ingest it"?',
        },
    },
    {
        keywords: ['market research', 'research technique', 'research toolkit', 'collecting', 'analysis'],
        scenario: {
            title: 'Validating Which Tools BAFOS Should Connect Next',
            roleplayPersona: 'David Adeyemi',
            personaRole: 'BAFOS Growth & Sales Lead',
            scenarioPrompt:
                'After a single demo call, Sales insists BAFOS must immediately build a Bitbucket + Azure DevOps + Jenkins connector bundle this month. You want 10 days of structured market research with founders and engineering teams first. Make your case without sounding like you are stalling growth.',
            openingMessage:
                'A 40-person agency just said they’d pay for BAFOS if we build Bitbucket, Jenkins, and Jira connectors by next month. Why do you want two weeks of market research when a paying buyer literally told us what to build?',
            guidingQuestions: [
                'Which qualitative + quantitative research methods give the fastest market signal on tool stacks in 10 days?',
                'How do you separate one loud prospect’s stack from a repeatable ICP (Ideal Customer Profile) pattern for BAFOS?',
            ],
            standupDebateHook: 'When a prospect asks BAFOS for a niche tool integration, when do you build fast vs. validate broader market demand first?',
        },
    },
    {
        keywords: ['lifecycle', 'pdlc', 'development life'],
        scenario: {
            title: 'Protecting BAFOS Lifecycle Gates During GitHub Beta',
            roleplayPersona: 'Elena Morales',
            personaRole: 'BAFOS Delivery Manager',
            scenarioPrompt:
                'BAFOS’s GitHub PR & Commit Health module is 2 weeks from beta freeze, and two early startup founders just asked to add Slack incident alerts and automated PR code-scoring before launch. Decide how to apply PDLC stage gates so BAFOS ships reliably.',
            openingMessage:
                'Two beta founders just told us they won’t use BAFOS daily unless we add Slack alerts and AI PR scoring before our beta release next Friday. Do we stretch the build phase or hold our launch gate?',
            guidingQuestions: [
                'How do you distinguish a true beta launch blocker from a v1.1 iteration on BAFOS?',
                'What PDLC exit criteria should BAFOS enforce before moving an integration from Build to Launch?',
            ],
            standupDebateHook: 'Which BAFOS scope requests are true v1 blockers vs. dangerous mid-sprint scope creep?',
        },
    },
    {
        keywords: ['vision', 'strategy', 'positioning'],
        scenario: {
            title: 'Defining BAFOS’s 18-Month Product Vision',
            roleplayPersona: 'Amara Nwosu',
            personaRole: 'CortDevs CEO',
            scenarioPrompt:
                'The BAFOS backlog has 18 disconnected ideas—from GitHub commit charts to billing trackers to HR check-ins. The CEO asks: "What is BAFOS’s actual 18-month product vision, and what are we deliberately saying NO to?"',
            openingMessage:
                'Looking at the BAFOS backlog, it feels like a grab bag of dashboards. If BAFOS can only be famous for ONE undeniable strength for founders and software teams over the next 18 months, what is it—and what are we cutting?',
            guidingQuestions: [
                'What makes BAFOS’s vision distinct from a generic project management tool or raw logging tool?',
                'Which "good ideas" should BAFOS say NO to so the core health-monitoring experience wins?',
            ],
            standupDebateHook: 'What is one tempting feature BAFOS should explicitly say NO to in Year 1 to stay razor-focused?',
        },
    },
    {
        keywords: ['buyer', 'persona', 'segmentation', 'psychology'],
        scenario: {
            title: 'Founder Buyer vs. Daily Builder Persona Tension in BAFOS',
            roleplayPersona: 'Rachel Kim',
            personaRole: 'Startup CTO & Economic Buyer',
            scenarioPrompt:
                'In BAFOS, non-technical founders love high-level delivery status summaries, while senior engineers worry a "health tracker" will feel like micromanagement. Balance buyer psychology and daily builder trust across BAFOS’s personas.',
            openingMessage:
                'I like the idea of BAFOS giving me executive visibility across GitHub and deployments, but if my engineers feel like you’re tracking their commit counts to spy on them, they’ll revolt. How does BAFOS win BOTH of us?',
            guidingQuestions: [
                'How do BAFOS’s Founder/CTO buyer goals differ from daily Software Engineer/Team Lead goals?',
                'Which signals help builders unblock themselves instead of feeling surveilled?',
            ],
            standupDebateHook: 'How does BAFOS give founders clarity on team health without making developers feel micromanaged?',
        },
    },
    {
        keywords: ['competitive', 'swot', 'jtbd', 'jobs to be done'],
        scenario: {
            title: 'Differentiating BAFOS vs. LinearB, Swarmia & GitHub Insights',
            roleplayPersona: 'Tunde Balogun',
            personaRole: 'Product Marketing Lead',
            scenarioPrompt:
                'Prospects ask: "Why should we pay for BAFOS when GitHub already has Insights and enterprise teams use LinearB or Datadog?" Use Competitive Analysis, SWOT, and Jobs-to-be-Done (JTBD) to sharpen BAFOS’s differentiation.',
            openingMessage:
                'Every founder I talk to asks why they need BAFOS when GitHub Insights is free and LinearB already tracks PR cycle time. What job is BAFOS hired to do that those tools fail at?',
            guidingQuestions: [
                'Where do single-tool analytics (like GitHub Insights) fail founders running multi-tool teams?',
                'What is BAFOS’s sharpest SWOT advantage for lean startups and growing product teams?',
            ],
            standupDebateHook: 'If a founder already has GitHub Insights + Datadog, what exact Job-to-be-Done makes them still adopt BAFOS?',
        },
    },
    {
        keywords: ['ai market', 'market dynamic', 'emerging'],
        scenario: {
            title: 'Where Does BAFOS’s Real AI Moat Live?',
            roleplayPersona: 'Dr. Priya Nair',
            personaRole: 'AI Systems Architect',
            scenarioPrompt:
                'Any startup can plug an LLM into GitHub webhooks over a weekend. Defend where BAFOS’s long-term defensible moat lives as foundation models get cheaper and smarter every quarter.',
            openingMessage:
                'If BAFOS uses commercial LLM APIs to summarize GitHub PRs and tool statuses, what stops a competitor from cloning our entire product in two weeks? Should we train our own model instead?',
            guidingQuestions: [
                'Does BAFOS’s moat come from custom LLM weights, or from cross-tool correlation, baseline history, and trusted workflow actions?',
                'How should BAFOS stay resilient as upstream AI models evolve?',
            ],
            standupDebateHook: 'What makes BAFOS hard to copy even when every competitor has access to the exact same LLMs?',
        },
    },
    {
        keywords: ['ideation', 'copilot', 'brainstorm'],
        scenario: {
            title: 'Selecting BAFOS’s First High-Trust AI Feature',
            roleplayPersona: 'Daniel Brooks',
            personaRole: 'Customer Success Lead',
            scenarioPrompt:
                'Your team brainstormed 25 AI ideas for BAFOS: auto-writing PR summaries, predicting missed sprint deadlines, detecting silent repo bottlenecks, and drafting weekly founder health digests. Pick the single best v1 AI pilot and justify it.',
            openingMessage:
                'We have 25 AI feature ideas for BAFOS—from predicting sprint delays to auto-reviewing code. We only have capacity to ship ONE AI capability well in v1. Which one do we bet on, and why?',
            guidingQuestions: [
                'Which BAFOS AI use case has high weekly value AND high tolerance for imperfect AI phrasing?',
                'Which use cases (like judging developer performance) carry too much trust risk for v1?',
            ],
            standupDebateHook: 'Which ONE AI feature in BAFOS delivers immediate "wow" value with the lowest hallucination risk?',
        },
    },
    {
        keywords: ['smart', 'kpi', 'power bi', 'metric', 'objective'],
        scenario: {
            title: 'Designing BAFOS’s North-Star Metrics & Guardrails',
            roleplayPersona: 'Grace Okafor',
            personaRole: 'Finance & BizOps Partner',
            scenarioPrompt:
                'BAFOS logged 50,000 GitHub webhook events this week, yet 60% of connected teams haven’t opened their health dashboard in 14 days. Define BAFOS’s SMART North-Star KPI and guardrail metrics that prove genuine retention value.',
            openingMessage:
                'Our webhook volume looks huge on paper—50,000 GitHub events ingested!—but teams aren’t coming back weekly and our LLM summary bill is climbing. What North-Star KPI actually measures BAFOS success?',
            guidingQuestions: [
                'Why is "events ingested" a vanity metric for BAFOS compared to "weekly active health decisions / resolved bottlenecks"?',
                'What guardrail metric protects BAFOS from alert fatigue and runaway AI token costs?',
            ],
            standupDebateHook: 'What single North-Star metric would prove a founder truly depends on BAFOS every week?',
        },
    },
    {
        keywords: ['roadmap', 'ms project', 'microsoft project', 'prioritiz'],
        scenario: {
            title: 'Sequencing BAFOS’s Integrations & AI Roadmap',
            roleplayPersona: 'Michael Vance',
            personaRole: 'Chief Operating Officer',
            scenarioPrompt:
                'Leadership wants exact ship dates for 6 connectors (GitHub, Linear, Jira, Vercel, Sentry, Slack) PLUS an AI Risk Engine over the next 2 quarters. Defend an outcome-based prioritization sequence for BAFOS.',
            openingMessage:
                'Why aren’t we building all six integrations in parallel right now so we can check every box on our landing page? Walk me through your prioritization framework for BAFOS’s roadmap.',
            guidingQuestions: [
                'Using RICE or Value-vs-Effort, why does nailing GitHub + 1 issue/deploy tool beat shipping 6 shallow connectors?',
                'How do you communicate roadmap confidence without making fake fixed-date promises on AI features?',
            ],
            standupDebateHook: 'Which 2–3 tools form the minimum "magic combination" for BAFOS v1 before expanding to 10+ connectors?',
        },
    },
    {
        keywords: ['requirement', 'prd', 'qa', 'quality', 'user stor', 'acceptance'],
        scenario: {
            title: 'Writing AI Acceptance Criteria for BAFOS Health Digests',
            roleplayPersona: 'Nadia Hassan',
            personaRole: 'QA & Release Lead',
            scenarioPrompt:
                'BAFOS generates a weekly AI "Repo & Team Health Digest" from GitHub commits, open PRs, and failed CI runs. QA asks how to test non-deterministic AI summaries so BAFOS never fabricates a PR blocker or misstates build status.',
            openingMessage:
                'I can test whether a GitHub webhook saved to Postgres—that’s pass/fail. How am I supposed to sign off on BAFOS’s AI Health Digest when the wording changes every time and one hallucinated "critical outage" could panic a founder?',
            guidingQuestions: [
                'How do you separate deterministic facts (exact PR count, failed build link) from AI narrative synthesis in a BAFOS PRD?',
                'What measurable eval threshold and fallback UX must ship if the LLM times out or has low data?',
            ],
            standupDebateHook: 'In BAFOS, what must ALWAYS be 100% deterministic data vs. where is probabilistic AI synthesis welcome?',
        },
    },
    {
        keywords: ['stakeholder', 'alignment', 'communication', 'ai product development'],
        scenario: {
            title: 'Aligning Security & Legal on BAFOS GitHub Permissions',
            roleplayPersona: 'Victor Eze',
            personaRole: 'Enterprise Security & Legal Reviewer',
            scenarioPrompt:
                'An enterprise team wants to pilot BAFOS, but their Security Lead flags OAuth scopes: "Will BAFOS read our private source code or feed our proprietary commits into public AI training?" Broker a trustworthy security & data-boundary architecture.',
            openingMessage:
                'Our security team is blocking BAFOS because your GitHub app asks for repo access. Prove to me that BAFOS won’t expose our private source code or leak commit metadata to external AI models.',
            guidingQuestions: [
                'Can BAFOS monitor commits, PR velocity, and CI status using metadata-only / least-privilege read scopes without storing source code?',
                'How should BAFOS communicate zero-data-retention AI guarantees to win enterprise security sign-off?',
            ],
            standupDebateHook: 'What is the minimum GitHub permission set BAFOS needs to be super useful while passing strict security reviews?',
        },
    },
    {
        keywords: ['design', 'ux', 'ui', 'accessibility', 'inclusive'],
        scenario: {
            title: 'Designing a Calm, Accessible BAFOS Health Dashboard',
            roleplayPersona: 'Chloe Bennett',
            personaRole: 'Senior Product Designer',
            scenarioPrompt:
                'Engineering built a BAFOS screen packed with 14 dense charts, flashing red badges, and color-only green/red status dots. Advocate for calm hierarchy, WCAG accessibility, and clear "Why is this flagged?" explainability.',
            openingMessage:
                'We already have all the GitHub and CI charts rendering on one screen—why spend another week redesigning layout hierarchy, color-blind status icons, and plain-English explanations?',
            guidingQuestions: [
                'How do you structure a BAFOS dashboard so a founder understands system health in 10 seconds without alert fatigue?',
                'Why must health statuses pair color with clear labels/icons and click-through evidence (exact PR/commit links)?',
            ],
            standupDebateHook: 'What makes a BAFOS health screen feel like a calm cockpit instead of a stressful wall of red alarms?',
        },
    },
    {
        keywords: ['heuristic', 'wireframe', 'mockup', 'figma', 'prototype'],
        scenario: {
            title: 'Heuristic Critique: BAFOS 60-Second GitHub Onboarding',
            roleplayPersona: 'Liam O’Connor',
            personaRole: 'UX Researcher',
            scenarioPrompt:
                'Your Figma prototype for onboarding a new team onto BAFOS takes 8 steps (create org, paste API keys, configure webhook URLs manually, map repo names, invite members) before the founder sees a single insight. Critique and simplify it.',
            openingMessage:
                'Engineering is ready to code our 8-step onboarding wizard tomorrow. It covers every edge case—do you really think we should simplify the wireframe before building?',
            guidingQuestions: [
                'Which usability heuristics are violated by asking founders to paste webhook URLs before seeing value?',
                'How could 1-click GitHub OAuth + instant sample/first-sync preview cut time-to-first-insight under 60 seconds?',
            ],
            standupDebateHook: 'What is the single fastest "aha moment" a founder should see within 60 seconds of connecting GitHub to BAFOS?',
        },
    },
    {
        keywords: ['usability', 'ethical', 'human-ai', 'responsible', 'bias'],
        scenario: {
            title: 'Preventing Surveillance Bias in BAFOS Team Health Scores',
            roleplayPersona: 'Dr. Fatima Bello',
            personaRole: 'Responsible AI Reviewer',
            scenarioPrompt:
                'In usability testing, a manager immediately used BAFOS’s commit & PR activity view to rank individual engineers—penalizing a senior engineer who spent the week mentoring and reviewing complex PRs instead of pushing tiny commits. Fix the human-AI design.',
            openingMessage:
                'During our pilot, a founder used BAFOS to ask why one engineer had fewer commits than everyone else—ignoring that she reviewed 19 critical PRs and unblocked a production outage. How do we prevent BAFOS from encouraging toxic metrics?',
            guidingQuestions: [
                'How should BAFOS aggregate health at the repo/workflow/team level rather than gamifying raw individual commit counts?',
                'What framing and contextual caveats keep AI health insights fair and human-verified?',
            ],
            standupDebateHook: 'Should BAFOS ever show individual developer leaderboards, or strictly team/repo/pipeline health?',
        },
    },
    {
        keywords: ['launch', 'go-to-market', 'gtm', 'marketing', 'sales enablement'],
        scenario: {
            title: 'Launching BAFOS to Early Startup Founders & Tech Teams',
            roleplayPersona: 'Kemi Adeola',
            personaRole: 'Product Marketing Lead',
            scenarioPrompt:
                'BAFOS is 3 weeks from public beta launch. Marketing wants to promise "Autonomous AI Engineering Management," while Support has no troubleshooting guide for broken GitHub tokens or missing webhooks. Build an honest, disciplined GTM launch plan.',
            openingMessage:
                'Our landing page draft calls BAFOS "Autonomous AI Engineering Management" to stand out. Should we run with that bold headline, and what enablement must be ready before opening signups?',
            guidingQuestions: [
                'How do you position BAFOS powerfully without overpromising AI autonomy that leads to Day-3 churn?',
                'What tiered rollout (internal CortDevs dogfooding → 10 friendly founders → public beta) de-risks launch?',
            ],
            standupDebateHook: 'What is the clearest, most honest 1-sentence pitch for BAFOS that makes a technical founder click "Connect GitHub"?',
        },
    },
    {
        keywords: ['risk', 'post-launch', 'monitor', 'operations', 'lifecycle', 'governance', 'workflow'],
        scenario: {
            title: 'Post-Launch BAFOS Ops: Webhook Drift & AI Cost Spikes',
            roleplayPersona: 'Samuel Mensah',
            personaRole: 'BAFOS SRE & AI Ops Lead',
            scenarioPrompt:
                'A month after launch, GitHub rate-limits hit 3 active BAFOS workspaces causing stale PR status, AND one high-commit monorepo triggered a 4x spike in weekly AI digest costs. Design BAFOS’s post-launch monitoring & incident playbook.',
            openingMessage:
                'Heads up: three customer workspaces are showing stale GitHub PR statuses because of webhook retries, and one monorepo with 800 commits/day just quadrupled our LLM digest cost. What’s our immediate fix and long-term ops guardrail?',
            guidingQuestions: [
                'What status transparency should BAFOS show users when a connected tool’s sync is delayed ("Last synced 2h ago — Reconnect")?',
                'How do you set per-workspace token budgets, eval drift alerts, and continuous feedback loops post-launch?',
            ],
            standupDebateHook: 'What operational guardrails keep BAFOS reliable and profitable when a customer connects a massive monorepo?',
        },
    },
    {
        keywords: ['enterprise', 'fundamentals'],
        scenario: {
            title: 'Positioning BAFOS for Growing Engineering Organizations',
            roleplayPersona: 'Sarah Chen',
            personaRole: 'VP of Product (BAFOS)',
            scenarioPrompt:
                'As BAFOS grows from 5-person startup teams to 50+ person engineering orgs, stakeholders ask what must change in governance, permissions, and reporting clarity.',
            openingMessage:
                'Our early startup users love BAFOS’s simplicity, but a 60-person company just asked about workspace roles and multi-repo rollups. How do we serve growing orgs without bloating the product?',
            guidingQuestions: [
                'Which enterprise capabilities (roles, audit logs, workspace scoping) add trust without hurting startup speed?',
                'How do you prioritize core workflow health over one-off enterprise custom requests?',
            ],
            standupDebateHook: 'What is the first enterprise-grade feature BAFOS needs as teams scale past 20 builders?',
        },
    },
];

const FALLBACK_SCENARIO: ModuleDialogueScenario = {
    title: 'Applying This Module Directly to BAFOS',
    roleplayPersona: 'Sarah Chen',
    personaRole: 'VP of Product (BAFOS)',
    scenarioPrompt:
        'Apply the core framework from this module directly to BAFOS (our platform connecting GitHub commits/PRs, CI/CD, and team tools to monitor engineering & system health). What single product decision would you change tomorrow, and what trade-off are you accepting?',
    openingMessage:
        'You just wrapped up this module—let’s apply it straight to BAFOS. What concrete product decision for BAFOS would you refine based on what you learned, and how would you defend the trade-off?',
    guidingQuestions: [
        'Which framework from this module sharpens how BAFOS monitors GitHub, PRs, or connected tools?',
        'What stakeholder pushback would you expect—and how would you address it?',
    ],
    standupDebateHook: 'What is one concrete change this module inspires for how we design or build BAFOS?',
};

/**
 * Matches moduleTitle FIRST (prevents courseTitle keywords like "Fundamentals" from shadowing specific module topics),
 * falling back to courseTitle only when moduleTitle has no direct match.
 */
export function getModuleDialogueScenario(moduleTitle = '', courseTitle = ''): ModuleDialogueScenario {
    const cleanMod = moduleTitle.toLowerCase();
    for (const entry of SCENARIO_BY_KEYWORDS) {
        if (entry.keywords.some((kw) => cleanMod.includes(kw))) {
            return entry.scenario;
        }
    }
    const cleanCourse = courseTitle.toLowerCase();
    for (const entry of SCENARIO_BY_KEYWORDS) {
        if (entry.keywords.some((kw) => cleanCourse.includes(kw))) {
            return entry.scenario;
        }
    }
    return FALLBACK_SCENARIO;
}

const WEEKLY_STANDUP_GUIDES: Record<number, WeeklyStandupGuide> = {
    1: {
        week: 1,
        theme: 'PM Foundations & Discovery for BAFOS',
        questions: [
            'When a founder connects GitHub + Slack + issue tracking to BAFOS, what single weekly health signal is genuinely actionable vs. noise?',
            'If we had 5 days to interview 8 founders/tech leads before building the next BAFOS connector, what 2 discovery questions would reveal real pain (not polite compliments)?',
            'What was your biggest aha moment or open blocker from Week 1’s foundations & market research materials?',
        ],
    },
    2: {
        week: 2,
        theme: 'PDLC, Vision & Enterprise Roadmapping for BAFOS',
        questions: [
            'What is ONE tempting feature BAFOS should explicitly say NO to in Year 1 to protect focus on tool health & engineering visibility?',
            'Should BAFOS prioritize deeper GitHub PR/CI intelligence first, or broader 5-tool uptime monitoring? Defend your roadmap trade-off.',
            'Which PDLC gate would protect BAFOS most from shipping half-baked integrations under deadline pressure?',
        ],
    },
    3: {
        week: 3,
        theme: 'Research Toolkits & BAFOS Buyer vs. Builder Personas',
        questions: [
            'How do we design BAFOS so founders/CTOs get clear delivery status WITHOUT engineers feeling like commit counts are spying on them?',
            'Which customer segment feels BAFOS’s pain most urgently today: 5–15 person startup teams, dev agencies, or 50+ person product orgs?',
            'What real evidence (not assumptions) would change our mind about BAFOS’s primary persona?',
        ],
    },
    4: {
        week: 4,
        theme: 'Competitive Intelligence, JTBD & BAFOS’s AI Moat',
        questions: [
            'If a founder already has GitHub Insights + Datadog, what exact Job-to-be-Done makes them still adopt and pay for BAFOS?',
            'As LLM APIs get cheaper every quarter, where does BAFOS’s defensible moat actually live?',
            'Which competitor weakness (LinearB, Swarmia, Jellyfish, or raw dashboards) gives BAFOS the cleanest opening?',
        ],
    },
    5: {
        week: 5,
        theme: 'AI Ideation, SMART Objectives & BAFOS North-Star KPIs',
        questions: [
            'Which ONE AI feature in BAFOS (PR bottleneck summary, silent risk alert, or founder weekly digest) gives the highest trust-to-effort ratio for v1?',
            'Why is "GitHub events ingested" a vanity metric—and what North-Star KPI proves teams genuinely rely on BAFOS weekly?',
            'What guardrail metric should stop us from shipping an AI alert that causes notification fatigue?',
        ],
    },
    6: {
        week: 6,
        theme: 'BAFOS Roadmaps, AI PRDs & Security/Stakeholder Alignment',
        questions: [
            'In a BAFOS Health Digest, which numbers must ALWAYS be 100% deterministic facts vs. where is AI narrative synthesis welcome?',
            'What is the minimum GitHub OAuth permission scope BAFOS needs to deliver value while passing strict enterprise security review?',
            'What belongs in a BAFOS AI PRD acceptance checklist that never appeared in traditional CRUD specs?',
        ],
    },
    7: {
        week: 7,
        theme: 'Design Fundamentals & Calm, Accessible BAFOS Dashboards',
        questions: [
            'How can a founder grasp BAFOS system & repo health in under 10 seconds without facing an overwhelming wall of charts?',
            'Where could poor visual hierarchy or color-only status dots hurt clarity or accessibility in BAFOS?',
            'What makes an AI health explanation in BAFOS feel immediately verifiable and trustworthy?',
        ],
    },
    8: {
        week: 8,
        theme: 'Heuristic Audits & 60-Second BAFOS Tool Onboarding',
        questions: [
            'What is the fastest "aha moment" a founder should see within 60 seconds of clicking "Connect GitHub" in BAFOS?',
            'Which onboarding friction step (OAuth permissions, repo selection, webhook config) is most likely to cause drop-off—and how do we eliminate it?',
            'Share one quick heuristic improvement from this week’s UX modules we should apply directly to BAFOS.',
        ],
    },
    9: {
        week: 9,
        theme: 'Usability Testing & Ethical Human-AI Design for BAFOS',
        questions: [
            'Should BAFOS ever display individual developer commit rankings, or strictly repo/workflow/team health—and why?',
            'How do we prevent managers from blindly trusting an AI "at-risk sprint" flag without checking real context with their team?',
            'What usability test task would immediately reveal whether a builder trusts or distrusts BAFOS?',
        ],
    },
    10: {
        week: 10,
        theme: 'BAFOS Launch Timelines, B2B GTM & Honest AI Positioning',
        questions: [
            'What is the sharpest, most honest 1-sentence pitch for BAFOS that makes a technical founder want to try it today?',
            'How should we structure a phased BAFOS launch (CortDevs internal dogfooding → design partners → public beta) to minimize churn?',
            'What must be in our Sales/Demo playbook so nobody overpromises "100% autonomous AI" to prospects?',
        ],
    },
    11: {
        week: 11,
        theme: 'Enterprise QA, Risk Registers & Post-Launch BAFOS KPIs',
        questions: [
            'If GitHub rate-limits or a webhook outage hits a BAFOS workspace, what graceful UI state preserves customer trust?',
            'Which 3 post-launch metrics should the BAFOS team review every Monday morning during the first 30 days after launch?',
            'What is the highest-severity technical or adoption risk in our BAFOS Risk Register right now?',
        ],
    },
    12: {
        week: 12,
        theme: 'AI Lifecycle Governance & Capstone BAFOS Synthesis',
        questions: [
            'How do we keep BAFOS’s AI digest quality high and LLM token costs predictable as customers connect massive monorepos?',
            'Looking back across all 12 weeks, which ONE product decision will have the biggest long-term impact on BAFOS’s success?',
            'Which BAFOS artifacts from our cohort projects should we immediately turn into live CortDevs execution tickets?',
        ],
    },
};

export function getWeeklyStandupQuestions(week: number): WeeklyStandupGuide {
    const clamped = Math.max(1, Math.min(12, Math.floor(week) || 1));
    return WEEKLY_STANDUP_GUIDES[clamped] || WEEKLY_STANDUP_GUIDES[1];
}

export function getBafosProjectLens(
    lessonTitle = '',
    moduleTitle = '',
    courseTitle = '',
): BafosProjectLens {
    const text = `${lessonTitle} ${moduleTitle} ${courseTitle}`.toLowerCase();

    if (text.includes('market research') || text.includes('competitive') || text.includes('swot') || text.includes('persona')) {
        return {
            headline: 'Recommended: Complete This Deliverable Using BAFOS',
            focusPrompt:
                'Instead of a fictional company, apply this research/competitive template directly to BAFOS—comparing how founders and builders currently monitor GitHub commits, PR velocity, CI builds, and team status vs. tools like GitHub Insights, LinearB, Swarmia, and Datadog.',
            suggestedDeliverable:
                'Define 2 sharp BAFOS personas (Startup Founder/CTO + Engineering Lead) and a concise competitive differentiation matrix showing BAFOS’s unique Job-to-be-Done.',
            bafosToolsInScope: ['GitHub (Commits & PRs)', 'CI/CD Pipelines', 'Linear / Jira', 'Slack'],
        };
    }

    if (text.includes('roadmap') || text.includes('strategy') || text.includes('kpi') || text.includes('power bi') || text.includes('smart')) {
        return {
            headline: 'Recommended: Build BAFOS’s Live Strategy & KPI Artifact',
            focusPrompt:
                'Use BAFOS as your live product for this strategy/roadmap assignment. Sequence BAFOS’s core connectors and first AI health digest capability into a realistic Now / Next / Later roadmap backed by SMART North-Star and guardrail KPIs.',
            suggestedDeliverable:
                'A BAFOS v1→v2 outcome roadmap + KPI table (North-Star retention metric, time-to-first-insight, false-alarm rate, and AI token cost guardrail).',
            bafosToolsInScope: ['GitHub Webhooks', 'CI/CD Status', 'AI Weekly Health Digest', 'Uptime Monitors'],
        };
    }

    if (text.includes('design') || text.includes('ux') || text.includes('ui') || text.includes('wireframe') || text.includes('figma') || text.includes('usability') || text.includes('heuristic')) {
        return {
            headline: 'Recommended: Design & Critique BAFOS’s Health Workspace',
            focusPrompt:
                'Apply this UX/design assignment directly to BAFOS: wireframe or audit either (a) BAFOS’s 60-second GitHub OAuth onboarding flow or (b) BAFOS’s calm Workspace Health Dashboard showing PR bottlenecks, failed builds, and explainable AI insights without surveillance bias.',
            suggestedDeliverable:
                'A low/mid-fidelity BAFOS wireframe or heuristic scorecard highlighting clear visual hierarchy, WCAG contrast, and clickable evidence links back to GitHub PRs/commits.',
            bafosToolsInScope: ['GitHub OAuth Onboarding', 'Workspace Health Cockpit', 'AI Explainability UI'],
        };
    }

    if (text.includes('launch') || text.includes('gtm') || text.includes('marketing') || text.includes('risk') || text.includes('post-launch') || text.includes('lifecycle')) {
        return {
            headline: 'Recommended: Create BAFOS’s Real Launch & AI Ops Playbook',
            focusPrompt:
                'Turn this assignment into an actionable BAFOS go-to-market, QA risk register, or post-launch monitoring plan—covering CortDevs internal dogfooding, design-partner beta rollout, GitHub webhook outage resilience, and LLM digest cost/quality monitoring.',
            suggestedDeliverable:
                'A BAFOS phased launch checklist, webhook/AI Risk Register (with mitigations), or 30-day post-launch KPI & drift monitoring plan.',
            bafosToolsInScope: ['GitHub Webhook Reliability', 'LLM Eval & Cost Guardrails', 'B2B Founder Beta'],
        };
    }

    return {
        headline: 'Recommended: Apply This Project Directly to BAFOS',
        focusPrompt:
            'Use BAFOS—our platform connecting GitHub commits/PRs, CI/CD, issue trackers, and status monitors for founders and software teams—as the live product for this deliverable (you can still download and reference the Microsoft template for structure).',
        suggestedDeliverable:
            'Adapt the project template to solve a real BAFOS product decision, citing specific developer tools (e.g., GitHub PRs, build status, Slack alerts) and measurable user outcomes.',
        bafosToolsInScope: ['GitHub (Commits & PRs)', 'CI/CD Builds', 'Issue Trackers', 'Team Health Alerts'],
    };
}
