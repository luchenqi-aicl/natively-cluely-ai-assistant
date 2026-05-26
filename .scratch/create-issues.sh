#!/usr/bin/env bash
# InterviewCopilot — create GitHub issues in dependency order
# Usage: bash .scratch/create-issues.sh
# Requires: gh CLI authenticated with issues:write scope
#
# Issues #1 (SessionContext) and #2 (dual trigger) are already on GitHub.
# This script creates the remaining 7 issues and skips existing ones.

set -e
REPO="luchenqi-aicl/natively-cluely-ai-assistant"

create_issue() {
  local title="$1"
  local label="$2"
  local body="$3"
  echo "Creating: $title"
  gh api --method POST "/repos/$REPO/issues" \
    -f title="$title" \
    -f body="$body" \
    -f "labels[]=$label" \
    --jq '"  → " + .html_url'
  sleep 1
}

# ── Issue 3: Model settings panel (AFK, no blockers) ──────────────────────────
create_issue \
  "feat: model settings panel (realtime + non-realtime model selectors)" \
  "ready-for-agent" \
'## What to build

Add two model selectors to the existing SettingsOverlay:

- **Realtime hint model** (default: `claude-haiku-4-5`) — used by AnswerLLM during the interview
- **Non-realtime model** (default: `claude-opus-4-7`) — used by ResumeJDParser and DebriefGenerator

Both selectors use existing BYOK configuration. Other InterviewCopilot modules ship with hardcoded defaults; this slice adds the user-facing override.

## Acceptance criteria

- [ ] SettingsOverlay shows an InterviewCopilot section with two model dropdowns
- [ ] Realtime model defaults to `claude-haiku-4-5`; non-realtime defaults to `claude-opus-4-7`
- [ ] Selections persist across app restarts via existing electron-store
- [ ] AnswerLLM reads the realtime model setting; ResumeJDParser and DebriefGenerator read the non-realtime setting
- [ ] Changing the model takes effect on the next trigger (no restart required)

## Blocked by

None — can start immediately.'

# ── Issue 4: ResumeJDParser (AFK, blocked by #1) ──────────────────────────────
create_issue \
  "feat: ResumeJDParser — PDF/DOCX + JD text → SessionContext JSON" \
  "ready-for-agent" \
'## What to build

New `electron/llm/ResumeJDParser.ts` module. Called once at session start; not during the interview.

**Input**: PDF or DOCX resume file buffer + raw JD text string
**Output**: populated `SessionContext` JSON stored in `SessionContextStore`

Uses `pdf-parse` + `mammoth` (already in package.json) to extract text, then calls `claude-opus-4-7` to extract structured fields.

**Field priority**:
- P0 (must extract): `workExperience`, `projects`, `jdKeywords`
- P1 (best effort): `education`, `skills`
- Special: detect cross-industry career pivot → populate `careerPivotStory` if found (e.g. "Health Policy → AI PM")

## Acceptance criteria

- [ ] Accepts PDF and DOCX resume files
- [ ] Extracts all P0 fields with ≥90% accuracy against 3 fixture resumes (career-switcher / international student / new grad)
- [ ] Populates `careerPivotStory` when a cross-industry transition is detected
- [ ] Parsed context is stored in `SessionContextStore` and available to AnswerLLM
- [ ] Unit tests cover all three fixture resume types

## Blocked by

- #1 (SessionContext schema + SessionContextStore)'

# ── Issue 5: PreInterviewSetupUI (AFK, blocked by #1, #4) ────────────────────
create_issue \
  "feat: PreInterviewSetupUI — resume upload, JD paste, interview type, language" \
  "ready-for-agent" \
'## What to build

New React component shown as a mandatory setup step before the interview session starts. Follows existing Natively UI patterns (TailwindCSS, framer-motion).

**Fields**:
- Resume file upload (PDF / DOCX, drag-and-drop + file picker)
- JD text paste (multi-line textarea)
- Interview type selector (Technical / HR / Behavioral / Comprehensive)
- STT input language selector (language the interviewer speaks)
- Hint output language selector (language shown in overlay, default: Chinese)

On submit: calls ResumeJDParser → populates SessionContextStore → enables the Start Session button.

**Demoable**: upload a PDF resume + paste a JD → verify SessionContext is populated in the store before session starts.

## Acceptance criteria

- [ ] All 5 fields present and functional
- [ ] Submit is disabled until resume + JD are both provided
- [ ] ResumeJDParser is called on submit; loading state shown during parsing
- [ ] Parsing errors surface a user-readable message (e.g. "Could not read PDF — try DOCX")
- [ ] SessionContext is populated in SessionContextStore before session start
- [ ] Language selections default to Chinese for both input and output

## Blocked by

- #1 (SessionContext schema + SessionContextStore)
- #4 (ResumeJDParser)'

# ── Issue 6: InterviewAnswerLLM (HITL, blocked by #1, #2, soft #5) ───────────
create_issue \
  "feat: InterviewAnswerLLM — context injection + framework selection COT" \
  "ready-for-human" \
'## What to build

Extend `electron/llm/AnswerLLM.ts` to inject `SessionContext` and apply interview-specific framework selection. This is the core differentiating module — **HITL: developer review required before merge**.

**Changes to AnswerLLM.ts**:

1. **Context injection**: pull `SessionContext` from `SessionContextStore` on every invocation; inject `workExperience`, `projects`, `jdKeywords`, and `careerPivotStory` into the system prompt

2. **Framework selection COT** (embedded single-pass, no separate API call):
   - Behavioral signals ("举个例子", "描述一次", "Tell me about a time") → STAR
   - Difficulty/failure signals ("挑战", "失败", "obstacle") → SOAR
   - Product insight signals ("喜欢什么产品", "怎么看这个赛道") → 三层结构 (track → strengths + 2 weakness types → trend hook)
   - Motivational signals ("为什么选", "为什么转", "自我介绍") → Past→Present→Future + activate careerPivotStory
   - Other → full draft prose

3. **No-fabrication constraint**: Result/成果 section must use numbers from `resume_context` only; use `[specific number]` placeholder when none exists

4. **Conversational tone**: prohibit "首先/其次/综上所述/值得一提的是" and similar AI filler

5. **JD alignment**: bold (markdown `**`) at least one `jdKeyword` per hint

6. **Default model**: `claude-haiku-4-5` (reads from model settings, falls back to haiku)

Agent can use a mock `SessionContext` to develop and test this slice before PreInterviewSetupUI (#5) is complete.

## Acceptance criteria

- [ ] SessionContext fields are injected into every prompt
- [ ] Correct framework is selected for each of the 4 question types (verified against 30-question test set)
- [ ] STAR Result section contains `[specific number]` placeholder when resume has no relevant data — never invented numbers
- [ ] No AI-filler phrases appear in output
- [ ] At least one JD keyword is bolded per hint
- [ ] careerPivotStory is referenced when question signals cross-industry context
- [ ] Median time from trigger to first displayed character < 2s (tested locally)
- [ ] Developer has reviewed prompt quality on 5 representative questions before merge

## Blocked by

- #1 (SessionContext schema + SessionContextStore)
- #2 (dual trigger mechanism)
- #5 (PreInterviewSetupUI) — soft dependency only; mock context sufficient to start'

# ── Issue 7: Output mode controller (AFK, blocked by #6) ─────────────────────
create_issue \
  "feat: output mode controller (auto / skeleton / full)" \
  "ready-for-agent" \
'## What to build

Add output mode post-processing to AnswerLLM and expose the selector in SettingsOverlay.

**Three modes**:
- **Auto** (default): hints ≤ 400 chars → display as-is; hints > 400 chars → compress to 150-250 char skeleton
- **Skeleton**: always compress to 150-250 char skeleton regardless of length
- **Full**: always display complete draft regardless of length

The compression step is a second LLM pass (haiku, fast) that extracts the 3-5 most critical bullet points from the full draft.

**Settings**: add a mode toggle to SettingsOverlay; persists via electron-store.

## Acceptance criteria

- [ ] Auto mode: hint > 400 chars is compressed; hint ≤ 400 chars is shown as-is
- [ ] Skeleton mode: all hints compressed to 150-250 chars
- [ ] Full mode: all hints shown at original length
- [ ] Mode selector visible in SettingsOverlay; persists across restarts
- [ ] Compressed output retains the bolded JD keywords from the original hint
- [ ] Switching mode takes effect on the next trigger (no restart required)

## Blocked by

- #6 (InterviewAnswerLLM)'

# ── Issue 8: DebriefGenerator (HITL, blocked by #6) ──────────────────────────
create_issue \
  "feat: DebriefGenerator — 4-dimension scoring + improvement suggestions" \
  "ready-for-human" \
'## What to build

Extend `electron/llm/RecapLLM.ts` to generate a structured debrief report at session end. **HITL: developer review of scoring quality required before merge**.

**Output structure**:
```
{
  questions: string[],                    // ordered list of all questions asked
  hints: string[],                        // 2-3 sentence summary of AI hint per question
  scores: {
    starCompleteness: number,             // 1-5
    jdAlignment: number,                  // 1-5
    specificity: number,                  // 1-5
    careerPivotCoherence?: number         // 1-5, only when careerPivotStory is set
  }[],
  improvements: string[][]               // up to 2 suggestions per question (empty if score > 3)
}
```

**Scoring rubric** (from docs/CONTEXT.md):
- STAR Completeness 5: all 4 sections + quantified Result; 1: no structure
- JD Alignment 5: ≥3 keywords naturally integrated; 1: unrelated
- Specificity 5: ≥2 quantified numbers or named projects; 1: filler only
- Career Pivot Coherence 5: explicit old-to-new bridge; 1: background is a liability

**Model**: `claude-opus-4-7` (reads from non-realtime model setting). Called once as a batch after session ends.

## Acceptance criteria

- [ ] Report contains all questions asked in session order
- [ ] Each question has a 2-3 sentence hint summary
- [ ] All 4 scoring dimensions populated (careerPivotCoherence only when applicable)
- [ ] Improvement suggestions generated for every question scoring ≤ 3; empty for questions scoring > 3
- [ ] Unit tests: known Q&A pairs produce scores within ≤ 0.8 of human-annotated ground truth
- [ ] Report is persisted via MeetingPersistence and survives app restart
- [ ] Developer has manually reviewed scoring on ≥ 5 Q&A pairs before merge

## Blocked by

- #6 (InterviewAnswerLLM)'

# ── Issue 9: DebriefReportUI (AFK, blocked by #8) ────────────────────────────
create_issue \
  "feat: DebriefReportUI — scrollable debrief report with scores and suggestions" \
  "ready-for-agent" \
'## What to build

New React component that displays the post-interview debrief report. Follows existing Natively dashboard UI patterns.

**Layout**:
- Header: session date, interview type, overall average scores
- Per-question cards (scrollable list):
  - Question text
  - AI hint summary (2-3 sentences)
  - Score badges: 4 coloured chips (green ≥4, yellow 3, red ≤2)
  - Improvement suggestions (shown only when score ≤ 3)

Data sourced from DebriefGenerator output via `MeetingPersistence`. Report is available offline after session ends.

## Acceptance criteria

- [ ] All questions from the session are listed in order
- [ ] Each card shows hint summary, 4 score badges, and improvement suggestions (when applicable)
- [ ] Score badges use green / yellow / red colour coding (≥4 / 3 / ≤2)
- [ ] careerPivotCoherence badge is hidden when not applicable
- [ ] Report loads correctly after app restart (data from MeetingPersistence)
- [ ] Component renders without errors when improvements array is empty

## Blocked by

- #8 (DebriefGenerator)'

echo ""
echo "All issues created successfully."
