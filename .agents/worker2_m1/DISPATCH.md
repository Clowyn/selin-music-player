# Dispatch - Worker 2 (Milestone 1 Remediation: Fix UpNextRow Height to <= 50px)

## Identity & Scope
- Working directory: d:\Projeler\Selin\selin-player\.agents\worker2_m1
- Scope document: d:\Projeler\Selin\selin-player\PROJECT.md
- Original request: d:\Projeler\Selin\selin-player\.agents\ORIGINAL_REQUEST.md
- Feedback from Challenger 1: `d:\Projeler\Selin\selin-player\.agents\challenger1_m1\handoff.md`

## Problem Statement
In iteration 1, Challenger 1 measured `components/UpNextRow.tsx` vertical height at ~64px (Header 20px + Padding 4px + Pill `h-10` 40px), which exceeds the requirement R2 constraint (taking ~50px max vertical height).

## Target File
`components/UpNextRow.tsx`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Tasks
1. Update `components/UpNextRow.tsx`:
   - Change pill container height from `h-10` (40px) to `h-8` (32px).
   - Adjust cover thumbnail image to `w-6 h-6` (24px).
   - Adjust header margins (`mb-0.5` or `mb-1`) and container bottom margin (`mb-1` or `mb-1.5`).
   - Verify that total section vertical height is strictly <= 48px to 50px max.
2. Build Verification:
   - Run `npm run lint` and `npm run build`.
3. Output documentation to `d:\Projeler\Selin\selin-player\.agents\worker2_m1\changes.md` and handoff report `d:\Projeler\Selin\selin-player\.agents\worker2_m1\handoff.md`.
