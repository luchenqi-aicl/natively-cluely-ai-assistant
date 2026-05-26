## What to build

New React component displaying the post-interview debrief report. Follows existing Natively dashboard UI patterns (TailwindCSS, framer-motion).

**Layout**:
- Header: session date, interview type, per-dimension average scores
- Scrollable list of per-question cards:
  - Question text
  - AI hint summary (2-3 sentences)
  - Score badges: 4 coloured chips (green ≥4 / yellow 3 / red ≤2)
  - Improvement suggestions shown only when score ≤ 3
  - Career pivot coherence badge hidden when not applicable

Data sourced from DebriefGenerator output via `MeetingPersistence`. Available offline after session ends.

## Acceptance criteria

- [ ] All session questions listed in order
- [ ] Each card shows hint summary, 4 score badges (or 3 when career pivot N/A), and suggestions
- [ ] Score badges use green / yellow / red colour coding (≥4 / 3 / ≤2)
- [ ] Report loads correctly after app restart
- [ ] Component renders without errors when improvements array is empty
- [ ] Career pivot badge hidden when `careerPivotStory` is absent

## Blocked by

- #8 (DebriefGenerator)
