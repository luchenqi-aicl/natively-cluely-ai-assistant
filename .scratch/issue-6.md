## What to build

Extend `electron/llm/AnswerLLM.ts` to inject `SessionContext` and apply interview-specific framework selection. Core differentiating module — **HITL: developer review required before merge**.

**Changes**:

1. **Context injection**: pull `SessionContext` from `SessionContextStore` on every invocation; inject `workExperience`, `projects`, `jdKeywords`, `careerPivotStory` into the system prompt

2. **Framework selection COT** (single-pass, no extra API call):
   - Behavioral signals ("举个例子", "描述一次", "Tell me about a time") → STAR
   - Difficulty/failure signals ("挑战", "失败", "obstacle") → SOAR
   - Product insight signals ("喜欢什么产品", "怎么看这个赛道") → 三层结构 (track → strengths + 2 weakness types → trend hook)
   - Motivational signals ("为什么选", "为什么转", "自我介绍") → Past→Present→Future + activate `careerPivotStory`
   - Other → full draft prose

3. **No-fabrication constraint**: Result/成果 must use numbers from `resume_context` only; use `[specific number]` placeholder when none exists

4. **Conversational tone**: prohibit "首先/其次/综上所述/值得一提的是" and similar AI filler

5. **JD alignment**: bold at least one `jdKeyword` per hint (markdown `**`)

6. **Default model**: `claude-haiku-4-5` (reads from model settings)

Agent can use a mock `SessionContext` to develop and test before PreInterviewSetupUI (#5) is complete.

## Acceptance criteria

- [ ] SessionContext fields injected into every prompt
- [ ] Correct framework selected for each of the 4 question types (verified against 30-question test set)
- [ ] STAR Result contains `[specific number]` placeholder when resume has no relevant data — never invented numbers
- [ ] No AI-filler phrases in output
- [ ] At least one JD keyword bolded per hint
- [ ] `careerPivotStory` referenced when question signals cross-industry context
- [ ] Median time from trigger to first displayed character < 2s (tested locally)
- [ ] Developer has reviewed prompt quality on 5 representative questions before merge

## Blocked by

- #1 (SessionContext schema + SessionContextStore)
- #2 (dual trigger mechanism)
- #5 (PreInterviewSetupUI) — soft dependency; mock context sufficient to start
