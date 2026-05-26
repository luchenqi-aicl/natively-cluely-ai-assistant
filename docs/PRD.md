# PRD: InterviewCopilot — AI 面试实时提词器

> 基于 Natively v2.6.0 改造。完整决策日志见 `docs/CONTEXT.md`。

---

## Problem Statement

求职者，尤其是跨行业转型者和非英语母语者，在面试现场面临一个共同困境：他们拥有真实的经历和能力，但在高压、实时的面试环境中，很难快速将这些经历组织成结构清晰、与岗位高度相关的回答。具体表现为：

- 行为类问题（「举个例子…」）时，脑子空白，说不出有数字支撑的 STAR 结构
- 产品洞察类问题（「你喜欢什么 AI 产品？」）时，回答停留在「好用」层面，无法体现 PM 级别的判断力
- 跨行业背景难以主动转化为优势，转行故事讲不清楚
- 面试结束后，无法系统复盘哪些问题回答得薄弱、下次如何改进

现有工具（Natively）提供通用的 AI 实时辅助，但缺少面试场景的专项能力：无法加载候选人简历和 JD 作为上下文、无法识别面试问题类型并套用对应框架、无法在面试后生成带评分的结构化复盘报告。

---

## Solution

在 Natively 底座上改造出 **InterviewCopilot**：一个专为面试场景设计的 AI 实时提词器。

核心能力：
1. **面试前**：加载候选人简历（PDF/DOCX）和目标 JD，解析成结构化会话上下文，供全程调用
2. **面试中**：双触发机制（静音 1.5 秒自动触发 + 用户按「c」键手动触发），根据问题类型自动选择框架（STAR / 三层产品洞察 / 过去→现在→未来），生成个性化提词，关键词加粗，输出语言可配置
3. **面试后**：自动生成复盘报告，包含本场问题清单、每题 AI 提词摘要、四维评分和改进建议

---

## User Stories

### 面试前准备

1. As an interview candidate, I want to upload my resume (PDF or DOCX) before the interview starts, so that the AI can reference my real experiences when generating hints rather than generic content.
2. As an interview candidate, I want to paste the target job description text before the interview, so that the AI can align my hints with the JD's specific keywords and requirements.
3. As an interview candidate, I want to select my interview type (Technical / HR / Behavioral / Comprehensive) before starting, so that the AI can calibrate its framework selection appropriately.
4. As an interview candidate, I want to set the STT input language (the language the interviewer speaks) separately from the hint output language (the language I read), so that I can receive Chinese hints during an English-language interview.
5. As an interview candidate, I want my parsed session context (resume + JD) to be loaded once and reused throughout the entire interview, so that each hint feels personalized without re-uploading anything.
6. As a career-switcher, I want the system to automatically detect and preserve a "career pivot story" field from my resume (e.g., Health Policy → AI PM), so that this narrative is available for the AI to proactively reference when relevant.
7. As an interview candidate, I want the resume parser to prioritize extracting work/internship experience (company, role, timeline, key achievements), project experience (role, tech, outcomes), and JD keywords, so that the most interview-relevant information is always available.
8. As an interview candidate, I want to be able to choose the AI model for non-realtime tasks (resume parsing, debrief generation) with a default of `claude-opus-4-7`, so that I get high-quality structured output for tasks where latency doesn't matter.
9. As an interview candidate, I want to choose the AI model for real-time hint generation with a default of `claude-haiku-4-5`, so that I get the fastest possible response during the interview.
10. As a BYOK user, I want all InterviewCopilot features to use my own Anthropic API key, so that I control my costs and data stays local.

### 面试中实时提词

11. As an interview candidate, I want a hint to be automatically triggered after the interviewer has been silent for 1.5 seconds, so that I receive guidance at the right moment without breaking my focus.
12. As an interview candidate, I want to press the 'c' key to manually trigger a hint at any moment, so that I can control timing when the auto-trigger fires too early or too late.
13. As an interview candidate, I want the AI to automatically detect behavioral questions (containing signals like "举个例子", "描述一次", "Tell me about a time") and respond with a STAR framework, so that my answer is structured and defensible.
14. As an interview candidate, I want the AI to switch to SOAR (Situation / Obstacle / Action / Result) when it detects the question is about difficulty, failure, or challenges, so that my answer emphasizes resilience.
15. As an interview candidate, I want the AI to automatically detect product insight questions (containing signals like "喜欢什么产品", "怎么看这个赛道", "评价某产品") and respond with a three-layer structure (track selection → strengths + two types of weaknesses → industry trend hook), so that my answer demonstrates PM-level critical thinking.
16. As an interview candidate, I want the AI to detect motivational questions ("为什么选", "为什么转", "自我介绍") and respond with a past→present→future narrative that activates the career pivot story when applicable, so that my cross-industry background becomes an asset rather than a liability.
17. As an interview candidate, I want the AI to align every hint with at least one JD keyword and bold it, so that my answer naturally speaks the interviewer's language.
18. As an interview candidate, I want the AI to reference only real numbers and experiences from my resume in the Result section of STAR answers — and use a `[specific number]` placeholder when no real data exists — so that my answers are truthful and I am never caught fabricating.
19. As an interview candidate, I want the hint text to use a natural, conversational tone (never "首先/其次/综上所述" or other AI-sounding filler), so that my answers sound like a real person speaking, not a chatbot.
20. As an interview candidate, I want the hint to appear in the floating overlay within 2 seconds of triggering (median), so that I can use it while the question is still fresh.
21. As an interview candidate, I want the output language of hints to default to Chinese and be configurable in settings, so that non-native English speakers can process hints faster in their native language.

### 提词输出模式

22. As an interview candidate, I want the system to automatically compress hints longer than 400 characters into a concise skeleton (150-250 characters), so that I'm not overwhelmed with text in a time-pressured situation.
23. As an interview candidate, I want to switch between three output modes in settings — Auto (adaptive by length), Skeleton (always concise), Full (always complete draft) — so that I can tune verbosity to my personal style.
24. As an interview candidate, I want key phrases and JD-aligned keywords in every hint to be bolded (markdown `**`), so that I can scan the most important points at a glance without reading every word.

### 面试后复盘

25. As an interview candidate, I want a debrief report to be automatically generated when the interview session ends, so that I can review what happened without relying on memory.
26. As an interview candidate, I want the debrief to list every question asked during the interview in order, so that I have a complete and accurate record.
27. As an interview candidate, I want the debrief to show the AI hint provided for each question (compressed to 2-3 sentence summary), so that I can see what guidance was available.
28. As an interview candidate, I want each question to be scored on four dimensions — STAR structure completeness, JD keyword alignment, specificity (real numbers/named projects), and cross-industry narrative coherence — using a 1-5 scale, so that I know exactly where I performed well and where I fell short.
29. As an interview candidate, I want the AI to provide up to 2 specific improvement suggestions for each low-scoring question (score ≤ 3), so that I have actionable next steps before my next interview.
30. As an interview candidate, I want the debrief report to be saved locally (extending Natively's existing MeetingPersistence), so that I can review it later without an internet connection.
31. As an interview candidate, I want the human-vs-AI scoring gap to be ≤ 0.8 points on a 5-point scale, so that the scores are trustworthy enough to act on.

### 设置与配置

32. As an interview candidate, I want all language settings (STT input language, hint output language) to be accessible from a single settings panel, so that I can configure them in under 30 seconds before an interview.
33. As an interview candidate, I want the pre-interview setup screen to be a dedicated step before the session starts (not buried in general settings), so that it's obvious what I need to do to get personalized hints.

---

## Implementation Decisions

### Module Map

**Modified (existing Natively modules):**

| Module | Change |
|---|---|
| `electron/llm/AnswerLLM.ts` | Inject `SessionContext`; add framework selection COT; implement output mode logic (auto/skeleton/full with 400-char threshold); enforce conversational tone constraints; default model: `claude-haiku-4-5` |
| `electron/llm/IntentClassifier.ts` | Extend to 4 interview question types (behavioral, product insight, motivational, other); classification embedded in AnswerLLM prompt as single-pass COT — no separate API call |
| `electron/llm/RecapLLM.ts` | Extend to produce structured debrief: question list, per-question hint summaries, 4-dimension scores (1-5), ≤2 improvement suggestions per low-score question; default model: `claude-opus-4-7` |
| `electron/llm/prompts.ts` | Add InterviewCopilot prompt templates: AnswerGenerator system prompt, DebriefGenerator prompt with rubric, ResumeJDParser extraction prompt |
| `src/hooks/useShortcuts.ts` | Add 'c' key as configurable trigger for hint generation |

**New modules:**

| Module | Description |
|---|---|
| `electron/llm/ResumeJDParser.ts` | Deep module. Input: PDF/DOCX buffer + raw JD text string. Output: structured `SessionContext` JSON. Uses `pdf-parse` + `mammoth` (already in `package.json`). Model: `claude-opus-4-7`. Called once at session start. |
| `electron/SessionContextStore.ts` | In-memory store for active interview session. Interface: `load(context)`, `get()`, `clear()`. Cleared when session ends. |
| `src/components/PreInterviewSetupUI.tsx` | Form: resume upload, JD text input, interview type selector, input/output language selectors. Shown before session starts. |
| `src/components/DebriefReportUI.tsx` | Displays debrief: scrollable question list, hint summaries, score badges, improvement suggestions. Data from extended RecapLLM output via MeetingPersistence. |

### Session Context Schema

```typescript
interface SessionContext {
  workExperience: {
    company: string;
    role: string;
    period: string;
    achievements: string[];
  }[];
  projects: {
    name: string;
    role: string;
    tech: string[];
    outcomes: string[];
  }[];
  education: { institution: string; degree: string; field: string };
  skills: string[];
  jdKeywords: string[];
  careerPivotStory?: string;
  // e.g., "Health Policy researcher → AI PM: data-driven policy analysis
  //         maps directly to PM's A/B test and metrics thinking"
}
```

### Trigger Architecture

Dual-trigger builds on Natively's existing VAD + silence detection in `electron/ProcessingHelper.ts`:
- **Auto-trigger**: 1.5s silence on system audio channel (interviewer) only — microphone channel excluded to prevent self-triggering
- **Manual trigger**: 'c' key → dispatches same event as auto-trigger; pressing 'c' again during generation cancels it

### Scoring Rubric (Debrief Generator)

| Dimension | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|
| STAR Completeness | All 4 sections + quantified Result | All 4 sections, Result without numbers | Missing 1 section or vague Result | Only S+A, no T or R | No structure |
| JD Keyword Alignment | ≥3 keywords, naturally integrated | 2 keywords | 1 keyword or forced | Adjacent but no keyword | Unrelated |
| Specificity | ≥2 quantified numbers or named projects | 1 number or specific case | Detail without numbers | Completely abstract | Filler only |
| Career Pivot Coherence* | Old-to-new bridge explicit + specific | Bridge mentioned but weak | Old experience only, no bridge | Background avoided | Background is a liability |

*Dimension 4 applies only when `careerPivotStory` field is non-empty.

### Model Selection

| Task | Default | Rationale |
|---|---|---|
| Resume/JD parsing | `claude-opus-4-7` | No latency constraint; best structured extraction quality |
| Real-time hint generation | `claude-haiku-4-5` | Median TTFT ~0.5-1.0s; best Chinese STAR quality at this speed tier |
| Debrief scoring + suggestions | `claude-opus-4-7` | Batch processing; rubric adherence benefits from stronger model |
| Fallback | User's BYOK choice | Consistent with Natively's BYOK architecture |

---

## Testing Decisions

### What makes a good test

Test external behavior — what goes in, what comes out — not implementation details or internal model calls. For LLM-based modules, test that the prompt is correctly assembled and the output is correctly parsed; do not assert on generated text content directly.

### Modules to test

| Module | Test approach |
|---|---|
| `ResumeJDParser` | Unit tests with 3 fixture resumes (career-switcher / international student / new grad, in PDF and DOCX). Assert P0 fields extracted with ≥90% field-level accuracy against human-annotated ground truth. |
| `SessionContextStore` | Unit tests: load/get/clear lifecycle; assert `get()` returns null after `clear()`; assert second `load()` overwrites previous context. |
| `DebriefGenerator` (extended RecapLLM) | Unit tests with known Q&A pairs and human-annotated scores. Assert AI scores deviate from human scores by ≤0.8 points average across 4 dimensions. |
| Trigger timing | Integration test: simulate 1.5s silence → assert trigger event fires; simulate 'c' key → assert same event fires. |

### Prior art

Existing tests live in `electron/services/__tests__/` and `electron/llm/__tests__/`. New tests follow the `.test.mjs` pattern (run via `npm test`).

---

## Out of Scope

- **Linux support** — inherited Natively limitation
- **Mock interview / practice mode** — focus is live, real-time assistance
- **Coding interview features** — handled by existing `CodeHintLLM.ts`; not duplicated here
- **Video conferencing SDK integration** — system audio capture handles this transparently
- **Multi-user or collaborative features** — single-user, local-first
- **Mobile companion app** — desktop only (Electron, macOS/Windows)
- **Post-MVP real-user data collection pipeline** — planned post-launch, not in this PRD

---

## Further Notes

- **Portfolio context**: Built as a portfolio piece for an Apple AI PM internship application. The PRD itself is an artifact demonstrating product thinking alongside the working software.
- **AGPL-3.0 license**: All modifications must comply with Natively's AGPL-3.0 license. Network-exposed modifications must make source available.
- **Data privacy**: No user data (resumes, transcripts, JD text) is transmitted to any server other than the user's chosen LLM provider via their BYOK key. Consistent with Natively's privacy-first design.
- **AI-generated test data**: The 30-question test set and golden-standard answers will be AI-generated, then human-reviewed and filtered before use as ground truth. Unreviewed AI-generated answers must not serve as gold standard.
- **Decision log**: Full grill session and domain glossary → `docs/CONTEXT.md`.
