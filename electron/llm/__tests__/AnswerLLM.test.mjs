import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/AnswerLLM.js');
const storePath = path.resolve(__dirname, '../../../dist-electron/electron/SessionContextStore.js');

const { InterviewAnswerLLM } = await import(pathToFileURL(distPath).href);
const { SessionContextStore } = await import(pathToFileURL(storePath).href);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_CONTEXT = {
    workExperience: [{
        company: 'Health Policy Institute, Peking University',
        role: 'Research Assistant',
        period: '2022–2024',
        achievements: ['Led quantitative analysis for 3 national health policy reports'],
    }],
    projects: [{
        name: 'InterviewCopilot',
        role: 'Product Lead',
        tech: ['Electron', 'React', 'TypeScript'],
        outcomes: ['Shipped MVP in 3 weeks; 50 beta users in first month'],
    }],
    education: { institution: 'Peking University', degree: 'Master of Science', field: 'Health Policy' },
    skills: ['Python', 'React', 'Product Management', 'A/B Testing', 'SQL'],
    jdKeywords: ['cross-functional', 'data-driven', 'user research', 'A/B testing'],
    careerPivotStory: 'Health Policy researcher → AI PM: quantitative analysis maps to PM data-driven decision making',
    hintLanguage: 'Chinese',
    interviewType: 'behavioral',
};

// ── Mock Anthropic streaming client ───────────────────────────────────────────

function makeStreamingMock(tokens) {
    const events = [
        ...tokens.map(t => ({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: t },
        })),
        { type: 'message_stop' },
    ];

    return {
        messages: {
            stream: async () => ({
                [Symbol.asyncIterator]: async function* () {
                    for (const ev of events) yield ev;
                },
            }),
        },
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('generateHint streams tokens from Anthropic client', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const tokens = ['In ', 'my ', 'experience ', 'at Peking University,'];
    const client = makeStreamingMock(tokens);
    const llm = new InterviewAnswerLLM({ client, modelId: 'claude-haiku-4-5-20251001', store });

    const collected = [];
    for await (const tok of llm.generateHint('Tell me about yourself.')) {
        collected.push(tok);
    }
    assert.deepEqual(collected, tokens);
});

test('generateHint works with no context (empty store)', async () => {
    const store = new SessionContextStore();
    const tokens = ['I ', 'don\'t have specific context loaded,'];
    const client = makeStreamingMock(tokens);
    const llm = new InterviewAnswerLLM({ client, store });

    const collected = [];
    for await (const tok of llm.generateHint('Why do you want this role?')) {
        collected.push(tok);
    }
    assert.equal(collected.length, tokens.length);
});

test('buildSystemPrompt includes resume fields', () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const llm = new InterviewAnswerLLM({
        client: makeStreamingMock([]),
        store,
    });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /Health Policy Institute/);
    assert.match(prompt, /InterviewCopilot/);
    assert.match(prompt, /A\/B testing/);
});

test('buildSystemPrompt includes careerPivotStory when present', () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /career_pivot_story/);
    assert.match(prompt, /Health Policy researcher/);
});

test('buildSystemPrompt omits career_pivot_story block when absent', () => {
    const store = new SessionContextStore();
    const ctxNoPivot = { ...SAMPLE_CONTEXT, careerPivotStory: undefined };
    store.load(ctxNoPivot);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    // The tag appears in framework instructions as text, but the XML block
    // with actual pivot story content should not be present
    assert.equal(prompt.includes('Health Policy researcher → AI PM'), false,
        'pivot story content must not appear when careerPivotStory is absent');
});

test('buildSystemPrompt uses hintLanguage from context', () => {
    const store = new SessionContextStore();
    store.load({ ...SAMPLE_CONTEXT, hintLanguage: 'English' });
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /Output language: English/);
});

test('buildSystemPrompt defaults to Chinese when hintLanguage absent', () => {
    const store = new SessionContextStore();
    const ctxNoLang = { ...SAMPLE_CONTEXT };
    delete ctxNoLang.hintLanguage;
    store.load(ctxNoLang);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /Output language: Chinese/);
});

test('buildSystemPrompt includes no-fabrication rule', () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /\[specific number\]/);
    assert.match(prompt, /NO-FABRICATION/);
});

test('buildSystemPrompt includes JD keyword bolding rule', () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /JD KEYWORD/);
    assert.match(prompt, /\*\*keyword\*\*/);
});

test('buildSystemPrompt shows no-filler phrase ban', () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const llm = new InterviewAnswerLLM({ client: makeStreamingMock([]), store });
    const prompt = llm.buildSystemPrompt();
    assert.match(prompt, /首先/);
    assert.match(prompt, /综上所述/);
    assert.match(prompt, /NO-FILLER/);
});

test('generateHint uses the injected modelId', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);

    let capturedParams = null;
    const capturingClient = {
        messages: {
            stream: async (params) => {
                capturedParams = params;
                return { [Symbol.asyncIterator]: async function* () {} };
            },
        },
    };

    const llm = new InterviewAnswerLLM({ client: capturingClient, modelId: 'claude-haiku-4-5-20251001', store });
    for await (const _ of llm.generateHint('test')) { /* drain */ }

    assert.equal(capturedParams?.model, 'claude-haiku-4-5-20251001');
    assert.equal(capturedParams?.max_tokens, 512);
});
