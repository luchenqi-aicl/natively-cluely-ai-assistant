// electron/llm/types.ts
// Shared types for the Natively LLM system

// ── InterviewCopilot ──────────────────────────────────────────────────────────

export interface WorkExperience {
    company: string;
    role: string;
    period: string;
    achievements: string[];
}

export interface ProjectExperience {
    name: string;
    role: string;
    tech: string[];
    outcomes: string[];
}

export interface Education {
    institution: string;
    degree: string;
    field: string;
}

/**
 * Structured context parsed from a candidate's resume + JD before an interview.
 * Loaded once into SessionContextStore at session start; cleared on session end.
 */
export interface SessionContext {
    workExperience: WorkExperience[];
    projects: ProjectExperience[];
    education: Education;
    skills: string[];
    jdKeywords: string[];
    /** Present when the candidate has a cross-industry background worth surfacing. */
    careerPivotStory?: string;
    /** Language for AI-generated hints (e.g. 'Chinese', 'English'). Defaults to 'Chinese'. */
    hintLanguage?: string;
    /** Interview type selected by the user (e.g. 'behavioral', 'technical'). */
    interviewType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from "@google/genai";

/**
 * Generation configuration for Gemini calls
 */
export interface GenerationConfig {
    maxOutputTokens: number;
    temperature: number;
    topP: number;
}

/**
 * Mode-specific token limits
 */
export const MODE_CONFIGS = {
    answer: {
        maxOutputTokens: 65536,
        temperature: 0.25,
        topP: 0.85,
    } as GenerationConfig,

    assist: {
        maxOutputTokens: 65536,
        temperature: 0.25,
        topP: 0.85,
    } as GenerationConfig,

    followUp: {
        maxOutputTokens: 65536,
        temperature: 0.25,
        topP: 0.85,
    } as GenerationConfig,

    recap: {
        maxOutputTokens: 65536,
        temperature: 0.25,
        topP: 0.85,
    } as GenerationConfig,

    followUpQuestions: {
        maxOutputTokens: 65536,
        temperature: 0.4, // Slightly higher creative freedom
        topP: 0.9,
    } as GenerationConfig,
} as const;

/**
 * Gemini content structure
 */
export interface GeminiContent {
    role: "user" | "model";
    parts: { text: string }[];
}

/**
 * LLM client interface for dependency injection
 */
export interface LLMClient {
    getGeminiClient(): GoogleGenAI | null;
}
