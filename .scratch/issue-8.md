## What to build

Extend `electron/llm/RecapLLM.ts` to generate a structured debrief report at session end. **HITL: developer review of scoring quality required before merge**.

**Output structure**:
- Ordered list of all questions asked in the session
- Per-question AI hint summary (2-3 sentences)
- Four dimension scores (1-5) per question: STAR completeness, JD keyword alignment, specificity, career pivot coherence (only when `careerPivotStory` is set)
- Up to 2 improvement suggestions per question scoring ≤ 3; empty array when score > 3

**Scoring rubric** (from docs/CONTEXT.md):
- STAR Completeness — 5: all 4 sections + quantified Result; 1: no structure
- JD Alignment — 5: ≥3 keywords naturally integrated; 1: unrelated to JD
- Specificity — 5: ≥2 quantified numbers or named projects; 1: filler only
- Career Pivot Coherence — 5: explicit old-to-new bridge with specifics; 1: background is a liability

**Model**: `claude-opus-4-7` (reads from non-realtime model setting). Called once as a batch after session ends. Report persisted via MeetingPersistence.

## Acceptance criteria

- [ ] Report contains all session questions in order
- [ ] Each question has a 2-3 sentence hint summary
- [ ] All 4 dimensions scored; career pivot dimension omitted when not applicable
- [ ] Improvement suggestions generated for score ≤ 3; empty for score > 3
- [ ] Unit tests: AI scores deviate ≤ 0.8 points from human-annotated ground truth on average
- [ ] Report survives app restart (persisted via MeetingPersistence)
- [ ] Developer has manually reviewed scoring on ≥ 5 Q&A pairs before merge

## Blocked by

- #6 (InterviewAnswerLLM)
