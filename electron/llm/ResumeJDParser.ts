// electron/llm/ResumeJDParser.ts
// Called once at session start. Extracts text from a PDF/DOCX resume buffer,
// calls Claude (non-realtime model) to produce a structured SessionContext,
// then loads it into SessionContextStore.

import Anthropic from '@anthropic-ai/sdk';
import { SessionContext, WorkExperience, ProjectExperience, Education } from './types';
import { sessionContextStore, SessionContextStore } from '../SessionContextStore';

const SYSTEM_PROMPT = `You are a resume and job description parser. Extract structured information as JSON.
Always output valid JSON matching the exact schema. No markdown fences, no explanation.`;

const buildUserPrompt = (resumeText: string, jdText: string): string => `
Resume:
---
${resumeText}
---

Job Description:
---
${jdText}
---

Extract the following as a single JSON object with this exact shape:
{
  "workExperience": [{ "company": "", "role": "", "period": "", "achievements": [""] }],
  "projects": [{ "name": "", "role": "", "tech": [""], "outcomes": [""] }],
  "education": { "institution": "", "degree": "", "field": "" },
  "skills": [""],
  "jdKeywords": [""],
  "careerPivotStory": ""
}

Rules:
- workExperience: list every position. achievements = bullet points verbatim.
- projects: list every project/side-project. tech = technology stack items.
- education: most recent degree only.
- skills: technical and domain skills from the resume.
- jdKeywords: the 5-10 most important keywords/phrases from the job description.
- careerPivotStory: if the candidate is switching industries (e.g. healthcare → tech, academic → PM),
  write one sentence describing the transition and the transferable skill bridge (e.g.
  "Health Policy researcher → AI PM: data analysis maps to PM A/B test thinking").
  Set to empty string "" if no cross-industry transition is present.

Output JSON only. No markdown code fences.`.trim();

export function extractJsonFromText(text: string): unknown {
    const trimmed = text.trim();
    // Strip possible ```json ... ``` fences the model may emit despite instructions
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenceMatch ? fenceMatch[1].trim() : trimmed;
    return JSON.parse(raw);
}

function validateSessionContext(obj: unknown): SessionContext {
    if (!obj || typeof obj !== 'object') throw new Error('Parsed value is not an object');
    const o = obj as Record<string, unknown>;

    const validateArray = (v: unknown, name: string): unknown[] => {
        if (!Array.isArray(v)) throw new Error(`${name} must be an array`);
        return v;
    };

    const workExperience: WorkExperience[] = validateArray(o.workExperience, 'workExperience').map((w: any) => ({
        company: String(w?.company ?? ''),
        role: String(w?.role ?? ''),
        period: String(w?.period ?? ''),
        achievements: Array.isArray(w?.achievements) ? w.achievements.map(String) : [],
    }));

    const projects: ProjectExperience[] = validateArray(o.projects, 'projects').map((p: any) => ({
        name: String(p?.name ?? ''),
        role: String(p?.role ?? ''),
        tech: Array.isArray(p?.tech) ? p.tech.map(String) : [],
        outcomes: Array.isArray(p?.outcomes) ? p.outcomes.map(String) : [],
    }));

    const edu = (o.education ?? {}) as any;
    const education: Education = {
        institution: String(edu?.institution ?? ''),
        degree: String(edu?.degree ?? ''),
        field: String(edu?.field ?? ''),
    };

    const skills: string[] = Array.isArray(o.skills) ? o.skills.map(String) : [];
    const jdKeywords: string[] = Array.isArray(o.jdKeywords) ? o.jdKeywords.map(String) : [];

    const pivotRaw = typeof o.careerPivotStory === 'string' ? o.careerPivotStory.trim() : '';
    const careerPivotStory = pivotRaw || undefined;

    return { workExperience, projects, education, skills, jdKeywords, ...(careerPivotStory ? { careerPivotStory } : {}) };
}

export async function extractTextFromBuffer(buffer: Buffer, filename: string): Promise<string> {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text ?? result;
    }
    if (lower.endsWith('.docx')) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    throw new Error(`Unsupported file type: ${filename}. Supported: .pdf, .docx`);
}

export interface ResumeJDParserDeps {
    client: Anthropic;
    modelId?: string;
    store?: SessionContextStore;
}

export class ResumeJDParser {
    private client: Anthropic;
    private modelId: string;
    private store: SessionContextStore;

    constructor({ client, modelId = 'claude-opus-4-7', store = sessionContextStore }: ResumeJDParserDeps) {
        this.client = client;
        this.modelId = modelId;
        this.store = store;
    }

    async parse(resumeText: string, jdText: string): Promise<SessionContext> {
        const message = await this.client.messages.create({
            model: this.modelId,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildUserPrompt(resumeText, jdText) }],
        });

        const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
        const parsed = extractJsonFromText(text);
        const context = validateSessionContext(parsed);
        this.store.load(context);
        return context;
    }

    async parseFile(buffer: Buffer, filename: string, jdText: string): Promise<SessionContext> {
        const resumeText = await extractTextFromBuffer(buffer, filename);
        return this.parse(resumeText, jdText);
    }
}
