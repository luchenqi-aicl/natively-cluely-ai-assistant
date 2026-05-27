import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface KBDocument {
    id: string;
    filename: string;
    ingestedAt: string;
    chunkCount: number;
}

interface KBChunk {
    docId: string;
    text: string;
    embedding: number[] | null; // null when embeddings unavailable
}

interface KBStorage {
    documents: KBDocument[];
    chunks: KBChunk[];
}

export interface IngestResult {
    docId: string;
    chunkCount: number;
}

const CHUNK_SIZE = 500;  // chars per chunk
const CHUNK_OVERLAP = 80;

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Simple TF-IDF keyword overlap fallback (when embeddings unavailable)
function keywordScore(query: string, text: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const textWords = text.toLowerCase().split(/\W+/);
    if (queryWords.size === 0) return 0;
    let hits = 0;
    for (const w of textWords) {
        if (queryWords.has(w)) hits++;
    }
    return hits / queryWords.size;
}

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + CHUNK_SIZE, text.length);
        chunks.push(text.slice(start, end).trim());
        if (end >= text.length) break;
        start = end - CHUNK_OVERLAP;
    }
    return chunks.filter(c => c.length > 20);
}

async function extractText(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') {
        // pdf-parse is a CJS module
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
    }
    // TXT, MD, or anything else: read as UTF-8
    return fs.readFileSync(filePath, 'utf-8');
}

export class InterviewKnowledgeBase {
    private storagePath: string;
    private storage: KBStorage;
    private embeddingProvider: any = null;
    private embeddingReady = false;

    constructor(userDataPath: string) {
        this.storagePath = path.join(userDataPath, 'interview-kb.json');
        this.storage = this._load();
        this._initEmbedding();
    }

    private _load(): KBStorage {
        try {
            if (fs.existsSync(this.storagePath)) {
                return JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
            }
        } catch { /* corrupt file → start fresh */ }
        return { documents: [], chunks: [] };
    }

    private _save(): void {
        fs.writeFileSync(this.storagePath, JSON.stringify(this.storage), 'utf-8');
    }

    private async _initEmbedding(): Promise<void> {
        try {
            const { LocalEmbeddingProvider } = require('../rag/providers/LocalEmbeddingProvider');
            const provider = new LocalEmbeddingProvider();
            const available = await provider.isAvailable();
            if (available) {
                this.embeddingProvider = provider;
                this.embeddingReady = true;
            }
        } catch {
            // fall through — keyword fallback will be used
        }
    }

    private async _embed(text: string): Promise<number[] | null> {
        if (!this.embeddingReady || !this.embeddingProvider) return null;
        try {
            return await this.embeddingProvider.embed(text);
        } catch {
            return null;
        }
    }

    async ingestFile(filePath: string, filename: string): Promise<IngestResult> {
        const raw = await extractText(filePath);
        const chunks = chunkText(raw);

        if (chunks.length === 0) {
            throw new Error('No text could be extracted from the file.');
        }

        // Wait for embedding provider if it's still initializing
        if (!this.embeddingReady) {
            await this._initEmbedding();
        }

        const docId = randomUUID();
        const kbChunks: KBChunk[] = [];

        for (const text of chunks) {
            const embedding = await this._embed(text);
            kbChunks.push({ docId, text, embedding });
        }

        const doc: KBDocument = {
            id: docId,
            filename,
            ingestedAt: new Date().toISOString(),
            chunkCount: kbChunks.length,
        };

        this.storage.documents.push(doc);
        this.storage.chunks.push(...kbChunks);
        this._save();

        return { docId, chunkCount: kbChunks.length };
    }

    async query(text: string, topK = 3): Promise<string[]> {
        if (this.storage.chunks.length === 0) return [];

        const useEmbeddings = this.embeddingReady && this.storage.chunks.some(c => c.embedding !== null);

        let scored: Array<{ text: string; score: number }>;

        if (useEmbeddings) {
            const queryEmbedding = await this._embed(text);
            if (!queryEmbedding) {
                // fall back to keyword
                scored = this.storage.chunks.map(c => ({ text: c.text, score: keywordScore(text, c.text) }));
            } else {
                scored = this.storage.chunks.map(c => ({
                    text: c.text,
                    score: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : 0,
                }));
            }
        } else {
            scored = this.storage.chunks.map(c => ({ text: c.text, score: keywordScore(text, c.text) }));
        }

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .filter(s => s.score > 0)
            .map(s => s.text);
    }

    listDocs(): KBDocument[] {
        return [...this.storage.documents];
    }

    deleteDoc(docId: string): void {
        this.storage.documents = this.storage.documents.filter(d => d.id !== docId);
        this.storage.chunks = this.storage.chunks.filter(c => c.docId !== docId);
        this._save();
    }

    getStats(): { docCount: number; chunkCount: number } {
        return {
            docCount: this.storage.documents.length,
            chunkCount: this.storage.chunks.length,
        };
    }
}
