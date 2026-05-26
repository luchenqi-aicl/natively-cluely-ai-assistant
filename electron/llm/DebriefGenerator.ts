import type { SessionContextStore } from '../SessionContextStore';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface QuestionDebriefScore {
    star: number;          // 1–5: STAR completeness
    jdAlignment: number;   // 1–5: JD keyword alignment
    specificity: number;   // 1–5: quantified details / named projects
    careerPivot?: number;  // 1–5: present only when careerPivotStory is set
}

export interface QuestionDebrief {
    question: string;
    hintSummary: string;     // 2–3 sentences
    scores: QuestionDebriefScore;
    improvements: string[];  // ≤ 2 items; empty when all scores > 3
}

export interface DebriefReport {
    sessionDate: string;     // ISO date string
    interviewType: string;
    questions: QuestionDebrief[];
}

export interface QAPair {
    question: string;
    hint: string;
}

export interface DebriefGeneratorDeps {
    client: {
        messages: {
            create: (params: any) => Promise<{ content: Array<{ type: string; text?: string }> }>;
        };
    };
    modelId?: string;
    store: SessionContextStore;
}

// ── Scoring rubric prompt ─────────────────────────────────────────────────────

const DEBRIEF_SYSTEM_PROMPT = `You are an interview coach scoring candidate answers.

SCORING RUBRIC (1–5 scale):

STAR Completeness:
5 — All 4 STAR sections present with a quantified Result
4 — All 4 sections present, Result is qualitative
3 — 3 of 4 sections present
2 — Only Situation + Action, no Result
1 — No recognizable structure

JD Alignment:
5 — ≥ 3 JD keywords naturally integrated
4 — 2 JD keywords integrated
3 — 1 JD keyword integrated
2 — Tangentially related to the role
1 — Completely unrelated to the JD

Specificity:
5 — ≥ 2 quantified numbers or named projects
4 — 1 quantified number or named project
3 — Qualitative but concrete
2 — Vague generalities ("I worked on a project")
1 — Filler only ("I am a hard worker")

Career Pivot Coherence (only scored when careerPivotStory is set):
5 — Explicit old-to-new bridge with named specifics
4 — Clear bridge, qualitative framing
3 — Acknowledges background but weak connection
2 — Background mentioned, no bridge
1 — Cross-industry background treated as a liability

OUTPUT FORMAT — return a JSON array (no markdown fences, no prose):
[
  {
    "question": "...",
    "hintSummary": "2-3 sentence summary of the candidate's answer",
    "scores": {
      "star": 1-5,
      "jdAlignment": 1-5,
      "specificity": 1-5,
      "careerPivot": 1-5  // omit entirely when not applicable
    },
    "improvements": ["suggestion 1", "suggestion 2"]  // ≤ 2 items; [] when all scores > 3
  }
]`;

// ── Validation helpers ────────────────────────────────────────────────────────

function clampScore(v: unknown): number {
    const n = Number(v);
    if (!isFinite(n)) return 3;
    return Math.max(1, Math.min(5, Math.round(n)));
}

function validateDebrief(raw: unknown[], hasPivot: boolean): QuestionDebrief[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => {
        const scores: QuestionDebriefScore = {
            star: clampScore(item?.scores?.star),
            jdAlignment: clampScore(item?.scores?.jdAlignment),
            specificity: clampScore(item?.scores?.specificity),
        };
        if (hasPivot && item?.scores?.careerPivot != null) {
            scores.careerPivot = clampScore(item.scores.careerPivot);
        }
        const allGood = Object.values(scores).every(s => s > 3);
        const improvements: string[] = allGood
            ? []
            : (Array.isArray(item?.improvements) ? item.improvements.slice(0, 2).map(String) : []);
        return {
            question: String(item?.question ?? ''),
            hintSummary: String(item?.hintSummary ?? ''),
            scores,
            improvements,
        };
    });
}

function extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/);
    const raw = fenced ? fenced[1] : text;
    return JSON.parse(raw.trim());
}

// ── DebriefGenerator ──────────────────────────────────────────────────────────

export class DebriefGenerator {
    private client: DebriefGeneratorDeps['client'];
    private modelId: string;
    private store: SessionContextStore;

    constructor({ client, modelId = 'claude-opus-4-7', store }: DebriefGeneratorDeps) {
        this.client = client;
        this.modelId = modelId;
        this.store = store;
    }

    async generate(qaPairs: QAPair[]): Promise<DebriefReport> {
        if (qaPairs.length === 0) {
            return {
                sessionDate: new Date().toISOString(),
                interviewType: this.store.get()?.interviewType ?? 'behavioral',
                questions: [],
            };
        }

        const ctx = this.store.get();
        const hasPivot = !!ctx?.careerPivotStory;

        const contextBlock = ctx ? `
<session_context>
  <jd_keywords>${ctx.jdKeywords.join(', ')}</jd_keywords>
  ${hasPivot ? `<career_pivot_story>${ctx.careerPivotStory}</career_pivot_story>` : ''}
</session_context>` : '';

        const qaPairsText = qaPairs.map((qa, i) =>
            `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.hint}`
        ).join('\n\n');

        const userMessage = `${contextBlock}\n\n<qa_pairs>\n${qaPairsText}\n</qa_pairs>\n\nScore each Q&A pair using the rubric. Return only the JSON array.`;

        const response = await this.client.messages.create({
            model: this.modelId,
            max_tokens: 2048,
            temperature: 0.1,
            system: DEBRIEF_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
        });

        const textBlock = response.content.find(b => b.type === 'text');
        const rawText = textBlock?.text ?? '[]';
        const parsed = extractJson(rawText);
        const questions = validateDebrief(parsed as unknown[], hasPivot);

        return {
            sessionDate: new Date().toISOString(),
            interviewType: ctx?.interviewType ?? 'behavioral',
            questions,
        };
    }
}
