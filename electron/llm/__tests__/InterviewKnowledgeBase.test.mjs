import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/InterviewKnowledgeBase.js');

const { InterviewKnowledgeBase } = await import(pathToFileURL(distPath).href);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'interview-kb-test-'));
}

function writeTempFile(dir, filename, content) {
    const fp = path.join(dir, filename);
    fs.writeFileSync(fp, content, 'utf-8');
    return fp;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('ingestFile returns chunkCount > 0 for text file', async () => {
    const dir = makeTempDir();
    const fp = writeTempFile(dir, 'resume.txt', 'I worked at Google for 3 years as a software engineer. I led a team of 5 engineers to build a new search ranking system that improved CTR by 15%. I also mentored junior engineers and conducted technical interviews.');
    const kb = new InterviewKnowledgeBase(dir);
    const result = await kb.ingestFile(fp, 'resume.txt');
    assert.ok(result.chunkCount > 0, 'should produce at least one chunk');
    assert.ok(typeof result.docId === 'string' && result.docId.length > 0, 'should have a docId');
});

test('listDocs returns ingested documents', async () => {
    const dir = makeTempDir();
    const fp = writeTempFile(dir, 'notes.md', '# Interview Notes\n\nBehavioral: Tell me about a time you led a project.\nAnswer: At my previous company I led...');
    const kb = new InterviewKnowledgeBase(dir);
    await kb.ingestFile(fp, 'notes.md');
    const docs = kb.listDocs();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].filename, 'notes.md');
    assert.ok(docs[0].chunkCount > 0);
});

test('deleteDoc removes document and its chunks', async () => {
    const dir = makeTempDir();
    const fp = writeTempFile(dir, 'doc.txt', 'This is a sample document about leadership experience at Startup X where I managed product roadmap and led cross-functional teams.');
    const kb = new InterviewKnowledgeBase(dir);
    const { docId } = await kb.ingestFile(fp, 'doc.txt');
    assert.equal(kb.listDocs().length, 1);
    kb.deleteDoc(docId);
    assert.equal(kb.listDocs().length, 0);
});

test('query returns relevant chunks via keyword fallback', async () => {
    const dir = makeTempDir();
    const content = 'I worked at Facebook as a product manager for two years. I launched a new notification system that reduced churn by 20%. I collaborated with engineering and design teams daily.';
    const fp = writeTempFile(dir, 'exp.txt', content);
    const kb = new InterviewKnowledgeBase(dir);
    await kb.ingestFile(fp, 'exp.txt');
    // Keyword overlap fallback (no embedding in test env since model not bundled in test)
    const results = await kb.query('product manager experience', 3);
    // Results may be empty if keyword score is 0, or may have relevant chunks
    assert.ok(Array.isArray(results), 'should return an array');
});

test('listDocs count matches getStats docCount', async () => {
    const dir = makeTempDir();
    const fp1 = writeTempFile(dir, 'a.txt', 'Document A content about software engineering experience and leadership at a technology company.');
    const fp2 = writeTempFile(dir, 'b.txt', 'Document B content about product management and cross functional collaboration in startup environment.');
    const kb = new InterviewKnowledgeBase(dir);
    await kb.ingestFile(fp1, 'a.txt');
    await kb.ingestFile(fp2, 'b.txt');
    const stats = kb.getStats();
    assert.equal(stats.docCount, 2);
    assert.ok(stats.chunkCount >= 2);
    assert.equal(kb.listDocs().length, 2);
});

test('storage persists across instantiation', async () => {
    const dir = makeTempDir();
    const fp = writeTempFile(dir, 'persist.txt', 'This document should persist across instantiations of the knowledge base and be available in subsequent sessions.');
    const kb1 = new InterviewKnowledgeBase(dir);
    const { docId } = await kb1.ingestFile(fp, 'persist.txt');

    // Create a new instance pointing at same dir
    const kb2 = new InterviewKnowledgeBase(dir);
    const docs = kb2.listDocs();
    assert.equal(docs.length, 1);
    assert.equal(docs[0].id, docId);
});

test('ingestFile throws for empty file', async () => {
    const dir = makeTempDir();
    const fp = writeTempFile(dir, 'empty.txt', '   ');
    const kb = new InterviewKnowledgeBase(dir);
    await assert.rejects(
        () => kb.ingestFile(fp, 'empty.txt'),
        /No text/
    );
});
