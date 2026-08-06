# Dispatch - Worker 1 (Milestone 1: R1 Wider Control Bar & R2 Compact UpNext Strip)

## Identity & Scope
- Working directory: d:\Projeler\Selin\selin-player\.agents\worker_m1
- Project root: d:\Projeler\Selin\selin-player
- Scope document: d:\Projeler\Selin\selin-player\PROJECT.md
- Original request: d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md
- Explorer reports to reference:
  - `d:\Projeler\Selin\selin-player\.agents\explorer1_m1\handoff.md`
  - `d:\Projeler\Selin\selin-player\.agents\explorer2_m1\handoff.md`
  - `d:\Projeler\Selin\selin-player\.agents\explorer3_m1\handoff.md`

## Write Ownership
- `components/PlayerControls.tsx`
- `components/UpNextRow.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Detailed Tasks
1. **R1: Wider Control Bar (`components/PlayerControls.tsx`)**:
   - Modify vertical padding to increase vertical height by ~5px (e.g. from `p-3 sm:p-4` to `px-3 py-4 sm:px-6 sm:py-5`).
   - Preserve all existing 9 control buttons, responsive gaps, tooltips, and state handlers.

2. **R2: Compact Recommendations Strip (`components/UpNextRow.tsx`)**:
   - Replace the large ~200px card grid/carousel with a compact horizontal single-line strip taking ~50px max vertical height.
   - Render recommended songs as horizontal pill items (`h-10` / `h-11`) containing cover thumbnail, track title, artist name, Play button, and Queue button.
   - Tapping the pill body/play button plays the track immediately. Tapping the queue button adds the track to the end of the queue.
   - Ensure horizontal scrolling works smoothly and scrollbars are styled or hidden.
   - Update skeleton loaders to matching pill shapes during loading state.

3. **Build & Verification**:
   - Execute `npm run lint` and `npm run build` using terminal/command execution.
   - Verify that there are zero TypeScript or ESLint errors and build completes with exit code 0.
   - Write your implementation summary and verification logs to `d:\Projeler\Selin\selin-player\.agents\worker_m1\changes.md` and handoff report `d:\Projeler\Selin\selin-player\.agents\worker_m1\handoff.md`.

## 2026-08-07T00:00:19Z
<USER_REQUEST>
You are Worker 1 for Milestone 1 (R1 & R2 UI).
Your working directory is: d:\Projeler\Selin\selin-player\.agents\worker_m1
Read instructions in: d:\Projeler\Selin\selin-player\.agents\worker_m1\DISPATCH.md
Read scope in: d:\Projeler\Selin\selin-player\PROJECT.md
Read original request in: d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md
Reference Explorer handoffs:
- d:\Projeler\Selin\selin-player\.agents\explorer1_m1\handoff.md
- d:\Projeler\Selin\selin-player\.agents\explorer2_m1\handoff.md
- d:\Projeler\Selin\selin-player\.agents\explorer3_m1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implement R1 (Wider Control Bar in components/PlayerControls.tsx) and R2 (Compact Recommendations Strip in components/UpNextRow.tsx).
Run `npm run lint` and `npm run build` to verify code correctness.
Document changes in `d:\Projeler\Selin\selin-player\.agents\worker_m1\changes.md` and write handoff to `d:\Projeler\Selin\selin-player\.agents\worker_m1\handoff.md`.
Send a message when completed.
</USER_REQUEST>
