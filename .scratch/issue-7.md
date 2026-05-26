## What to build

Add output mode post-processing to AnswerLLM and expose the selector in SettingsOverlay.

**Three modes**:
- **Auto** (default): hints ≤ 400 chars → display as-is; hints > 400 chars → compress to 150-250 char skeleton retaining bolded keywords
- **Skeleton**: always compress to 150-250 chars regardless of length
- **Full**: always display complete draft regardless of length

Compression is a second fast LLM pass (haiku) extracting the 3-5 most critical bullet points from the full draft.

Mode persists via electron-store and is changeable in SettingsOverlay without restart.

## Acceptance criteria

- [ ] Auto mode: hints > 400 chars compressed; hints ≤ 400 chars shown as-is
- [ ] Skeleton mode: all hints compressed to 150-250 chars
- [ ] Full mode: all hints shown at original length
- [ ] Mode selector visible in SettingsOverlay; persists across restarts
- [ ] Compressed output retains bolded JD keywords from original
- [ ] Mode change takes effect on next trigger (no restart required)

## Blocked by

- #6 (InterviewAnswerLLM)
