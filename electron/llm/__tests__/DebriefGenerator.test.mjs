import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/DebriefGenerator.js');
const storePath = path.resolve(__dirname, '../../../dist-electron/electron/SessionContextStore.js');

const { DebriefGenerator } = await import(pathToFileURL(distPath).href);
const { SessionContextStore } = await import(pathToFileURL(storePath).href);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_CONTEXT = {
    workExperience: [],
    projects: [],
    education: { institution: 'Peking University', degree: 'MSc', field: 'Health Policy' },
    skills: ['Python', 'SQL'],
    jdKeywords: ['data-driven', 'cross-functional'],
    careerPivotStory: 'Health researcher → AI PM',
    interviewType: 'behavioral',
};

const SAMPLE_QA = [
    { question: 'Tell me about a time you led a project.', hint: 'I led the InterviewCopilot project at PKU...' },
    { question: 'What is your greatest strength?', hint: 'My greatest strength is data-driven decision making...' },
];

function makeMockLLM(responseJson) {
    return {
        messages: {
            create: async () => ({
                content: [{ type: 'text', text: JSON.stringify(responseJson) }],
            }),
        },
    };
}

function makeSampleResponse(hasPivot = true) {
    return SAMPLE_QA.map((qa, i) => ({
        question: qa.question,
        hintSummary: `Summary ${i + 1} sentence one. Sentence two. Sentence three.`,
        scores: {
            star: 4,
            jdAlignment: 3,
            specificity: 5,
            ...(hasPivot ? { careerPivot: 4 } : {}),
        },
        improvements: i === 0 ? [] : ['Add more specific metrics.'],
    }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('generate returns DebriefReport with all questions', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const client = makeMockLLM(makeSampleResponse(true));
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);

    assert.equal(report.questions.length, SAMPLE_QA.length);
    assert.match(report.sessionDate, /^\d{4}-\d{2}-\d{2}/);
    assert.equal(report.interviewType, 'behavioral');
});

test('generate scores are clamped to 1-5', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const badScores = SAMPLE_QA.map(qa => ({
        question: qa.question,
        hintSummary: 'summary',
        scores: { star: 99, jdAlignment: -5, specificity: 3 },
        improvements: [],
    }));
    const client = makeMockLLM(badScores);
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);

    for (const q of report.questions) {
        assert.ok(q.scores.star >= 1 && q.scores.star <= 5, `star score out of range: ${q.scores.star}`);
        assert.ok(q.scores.jdAlignment >= 1 && q.scores.jdAlignment <= 5);
        assert.ok(q.scores.specificity >= 1 && q.scores.specificity <= 5);
    }
});

test('generate includes careerPivot score when context has pivotStory', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const client = makeMockLLM(makeSampleResponse(true));
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);
    assert.ok(report.questions[0].scores.careerPivot !== undefined, 'careerPivot score should be present');
});

test('generate omits careerPivot score when no pivotStory', async () => {
    const store = new SessionContextStore();
    store.load({ ...SAMPLE_CONTEXT, careerPivotStory: undefined });
    const client = makeMockLLM(makeSampleResponse(false));
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);
    assert.equal(report.questions[0].scores.careerPivot, undefined);
});

test('generate produces improvements only for scores <= 3', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const resp = [
        { question: 'Q1', hintSummary: 'summary', scores: { star: 5, jdAlignment: 5, specificity: 5 }, improvements: ['Should be ignored'] },
        { question: 'Q2', hintSummary: 'summary', scores: { star: 2, jdAlignment: 3, specificity: 4 }, improvements: ['Needs more detail.'] },
    ];
    const client = makeMockLLM(resp);
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);
    assert.equal(report.questions[0].improvements.length, 0, 'all scores > 3 → no improvements');
    assert.equal(report.questions[1].improvements.length, 1);
});

test('generate caps improvements at 2 items', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const resp = [{ question: 'Q1', hintSummary: 'summary', scores: { star: 1, jdAlignment: 1, specificity: 1 }, improvements: ['A', 'B', 'C', 'D'] }];
    const client = makeMockLLM(resp);
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate([SAMPLE_QA[0]]);
    assert.ok(report.questions[0].improvements.length <= 2);
});

test('generate returns empty report for no qaPairs', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const client = makeMockLLM([]);
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate([]);
    assert.equal(report.questions.length, 0);
});

test('generate handles markdown-fenced JSON response', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    const fencedJson = '```json\n' + JSON.stringify(makeSampleResponse(true)) + '\n```';
    const client = {
        messages: {
            create: async () => ({ content: [{ type: 'text', text: fencedJson }] }),
        },
    };
    const gen = new DebriefGenerator({ client, store });
    const report = await gen.generate(SAMPLE_QA);
    assert.equal(report.questions.length, SAMPLE_QA.length);
});

test('generate uses non-realtime model by default (claude-opus-4-7)', async () => {
    const store = new SessionContextStore();
    store.load(SAMPLE_CONTEXT);
    let capturedModel = null;
    const client = {
        messages: {
            create: async (params) => {
                capturedModel = params.model;
                return { content: [{ type: 'text', text: '[]' }] };
            },
        },
    };
    const gen = new DebriefGenerator({ client, store });
    await gen.generate(SAMPLE_QA);
    assert.equal(capturedModel, 'claude-opus-4-7');
});
