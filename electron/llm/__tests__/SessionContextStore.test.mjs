import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storePath = path.resolve(__dirname, '../../../dist-electron/electron/SessionContextStore.js');
const { SessionContextStore } = await import(pathToFileURL(storePath).href);

const MOCK_CONTEXT = {
    workExperience: [{
        company: 'PKU Health Policy Institute',
        role: 'Research Assistant',
        period: '2024-2025',
        achievements: ['Led data analysis for 3 policy reports', 'Built R model used in 2 follow-on projects'],
    }],
    projects: [{
        name: 'InterviewCopilot',
        role: 'Product Lead',
        tech: ['Electron', 'React', 'TypeScript', 'Claude API'],
        outcomes: ['MVP shipped in 3 weeks'],
    }],
    education: { institution: 'Peking University', degree: 'Master', field: 'Health Policy' },
    skills: ['R', 'Python', 'Product Management'],
    jdKeywords: ['AI PM', 'cross-functional', 'data-driven', 'user research'],
    careerPivotStory: 'Health Policy researcher → AI PM: data analysis maps to PM A/B test thinking',
};

test('get() returns null before any context is loaded', () => {
    const store = new SessionContextStore();
    assert.equal(store.get(), null);
});

test('get() returns context after load()', () => {
    const store = new SessionContextStore();
    store.load(MOCK_CONTEXT);
    assert.deepEqual(store.get(), MOCK_CONTEXT);
});

test('second load() overwrites the previous context', () => {
    const store = new SessionContextStore();
    store.load(MOCK_CONTEXT);
    const updated = { ...MOCK_CONTEXT, jdKeywords: ['machine learning', 'roadmap'] };
    store.load(updated);
    assert.deepEqual(store.get()?.jdKeywords, ['machine learning', 'roadmap']);
});

test('get() returns null after clear()', () => {
    const store = new SessionContextStore();
    store.load(MOCK_CONTEXT);
    store.clear();
    assert.equal(store.get(), null);
});

test('load() after clear() works correctly', () => {
    const store = new SessionContextStore();
    store.load(MOCK_CONTEXT);
    store.clear();
    store.load(MOCK_CONTEXT);
    assert.notEqual(store.get(), null);
    assert.equal(store.get()?.education.institution, 'Peking University');
});
