import { LLMHelper } from "../LLMHelper";
import { UNIVERSAL_ANSWER_PROMPT } from "./prompts";
import { TINY_ANSWER_PROMPT } from "./tinyPrompts";
import type { SessionContext } from "./types";
import type { SessionContextStore } from "../SessionContextStore";

export class AnswerLLM {
    private llmHelper: LLMHelper;

    constructor(llmHelper: LLMHelper) {
        this.llmHelper = llmHelper;
    }

    /**
     * Generate a spoken interview answer
     */
    async generate(question: string, context?: string): Promise<string> {
        try {
            const promptOverride = this.llmHelper.getPromptTier() === 'tiny' ? TINY_ANSWER_PROMPT : UNIVERSAL_ANSWER_PROMPT;
            const fittedContext = context ? this.llmHelper.fitContextForCurrentModel(context) : context;
            const stream = this.llmHelper.streamChat(question, undefined, fittedContext, promptOverride);

            let fullResponse = "";
            for await (const chunk of stream) {
                fullResponse += chunk;
            }
            return fullResponse.trim();

        } catch (error) {
            console.error("[AnswerLLM] Generation failed:", error);
            return "";
        }
    }
}

// ── InterviewAnswerLLM ────────────────────────────────────────────────────────

export interface InterviewAnswerLLMDeps {
    client: {
        messages: {
            stream: (params: any) => any;
        };
    };
    modelId?: string;
    store: SessionContextStore;
}

function buildInterviewSystemPrompt(ctx: SessionContext | null): string {
    const lang = ctx?.hintLanguage ?? 'Chinese';

    const resumeBlock = ctx ? `
<resume_context>
<work_experience>
${ctx.workExperience.map(w => `  ${w.role} at ${w.company} (${w.period})\n  Achievements: ${w.achievements.join('; ')}`).join('\n')}
</work_experience>
<projects>
${ctx.projects.map(p => `  ${p.name} (${p.role}) — Tech: ${p.tech.join(', ')}\n  Outcomes: ${p.outcomes.join('; ')}`).join('\n')}
</projects>
<education>${ctx.education.degree} in ${ctx.education.field}, ${ctx.education.institution}</education>
<skills>${ctx.skills.join(', ')}</skills>
</resume_context>

<jd_keywords>${ctx.jdKeywords.join(', ')}</jd_keywords>
${ctx.careerPivotStory ? `\n<career_pivot_story>${ctx.careerPivotStory}</career_pivot_story>` : ''}` : `
<resume_context>No resume context loaded. Use qualitative framing only — no invented numbers.</resume_context>
<jd_keywords></jd_keywords>`;

    return `<interview_copilot>
You are a real-time interview coach. Generate the EXACT words the candidate should say — a first-person spoken script, ready to deliver without editing.
Output language: ${lang}
${resumeBlock}

<framework_selection>
Silently detect the question type from signals in the transcript, then apply the matching framework. Do NOT name the framework in your output.

1. BEHAVIORAL signals ("举个例子", "描述一次", "tell me about a time", "walk me through", "give an example") → STAR
   Situation (1 sentence) → Task (1 sentence) → Action (2–3 "I" sentences) → Result (1 sentence, numbers from resume_context only — if none available, write "[specific number]")

2. DIFFICULTY/FAILURE signals ("最大挑战", "失败过", "最困难", "obstacle", "how did you handle", "challenge you faced") → SOAR
   Situation → Obstacle → Action → Result

3. PRODUCT INSIGHT signals ("喜欢什么产品", "怎么看这个赛道", "product sense", "favorite product", "market view") → 三层结构
   Layer 1: Track/market insight (1–2 sentences)
   Layer 2: Product strengths + 2 weakness categories (2–3 sentences)
   Layer 3: Trend hook / unique angle (1–2 sentences)

4. MOTIVATIONAL signals ("为什么选", "为什么转行", "自我介绍", "tell me about yourself", "why this role", "why us") → Past→Present→Future
   Past: what you built and learned (1–2 sentences)
   Present: why this role specifically (1 sentence)
   Future: where you're heading (1 sentence)
   If <career_pivot_story> is set, weave it naturally into the Past section.

5. ALL OTHER questions → Full prose (3–5 sentences, concise story arc: context → action → insight)
</framework_selection>

<rules>
1. NO-FABRICATION: Result/成果 must use numbers from <resume_context> only. When none exist, write "[specific number]" — never invent percentages, durations, team sizes, or dollar amounts.
2. NO-FILLER PHRASES: Never write "首先", "其次", "此外", "综上所述", "值得一提的是", "总的来说", "In conclusion", "Furthermore", "Additionally", "Moreover", "Great question!", "Certainly!", "Let me explain".
3. JD KEYWORD: Bold at least one word from <jd_keywords> in every response using markdown **keyword**. Choose the most contextually relevant one.
4. FIRST PERSON: Speak as the candidate. "I", "my", "I've". Never "the candidate" or "you should say".
5. LENGTH: 3–5 sentences speakable in under 45 seconds. Prose only — no bullet lists.
6. SPOKEN VOICE: No em dashes (—). No semicolons in prose. Use commas or short sentences instead.
7. CAREER PIVOT: If the question signals cross-industry transition and <career_pivot_story> is set, reference it — do not ignore it.
</rules>
</interview_copilot>`;
}

/**
 * Streaming interview hint generator. Uses a direct Anthropic client so the
 * caller can specify the exact realtime model (e.g. claude-haiku-4-5-20251001)
 * independent of LLMHelper's provider routing.
 */
export class InterviewAnswerLLM {
    private client: InterviewAnswerLLMDeps['client'];
    private modelId: string;
    private store: SessionContextStore;

    constructor({ client, modelId = 'claude-haiku-4-5-20251001', store }: InterviewAnswerLLMDeps) {
        this.client = client;
        this.modelId = modelId;
        this.store = store;
    }

    /**
     * Streams a hint for the given transcript excerpt.
     * Yields tokens as they arrive from the API.
     * @param kbChunks optional retrieved knowledge-base passages to inject as extra context
     */
    async * generateHint(transcript: string, kbChunks?: string[]): AsyncGenerator<string, void, unknown> {
        const ctx = this.store.get();
        const systemPrompt = buildInterviewSystemPrompt(ctx);

        let userContent = `<live_transcript>\n${transcript}\n</live_transcript>`;
        if (kbChunks && kbChunks.length > 0) {
            userContent += `\n\n<reference_experience>\n${kbChunks.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}\n</reference_experience>\n<note>The above passages are real interview experiences from the knowledge base. Reference relevant specifics naturally when helpful.</note>`;
        }
        userContent += '\n\nGenerate the candidate\'s spoken answer to the most recent interviewer question above.';

        const stream = await this.client.messages.stream({
            model: this.modelId,
            max_tokens: 512,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
        });

        for await (const event of stream) {
            if (
                event.type === 'content_block_delta' &&
                event.delta?.type === 'text_delta'
            ) {
                yield event.delta.text;
            }
        }
    }

    /**
     * Compress a full hint to a 150-250 char skeleton retaining bolded keywords.
     * Uses the same Anthropic client with a fast haiku call.
     */
    async compressHint(fullHint: string): Promise<string> {
        const resp = await this.client.messages.stream({
            model: this.modelId,
            max_tokens: 120,
            temperature: 0.1,
            system: 'You are a text compressor. Extract the 3–5 most critical points from the text. Keep all **bold** markdown. Output plain prose or bullet points — 150 to 250 characters total. No preamble.',
            messages: [{ role: 'user', content: fullHint }],
        });

        let compressed = '';
        for await (const event of resp) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                compressed += event.delta.text;
            }
        }
        return compressed.trim();
    }

    /**
     * Apply output mode: 'full' → return as-is, 'skeleton' → compress,
     * 'auto' → compress only if > 400 chars.
     */
    async applyOutputMode(hint: string, mode: 'auto' | 'skeleton' | 'full'): Promise<string> {
        if (mode === 'full') return hint;
        if (mode === 'skeleton') return this.compressHint(hint);
        // auto
        return hint.length > 400 ? this.compressHint(hint) : hint;
    }

    /** Exposed for testing — returns the system prompt that would be built. */
    buildSystemPrompt(): string {
        return buildInterviewSystemPrompt(this.store.get());
    }
}
