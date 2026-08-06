# Dead Ends Log - Orchestrator R2

| Iteration | Approach Tried | Why It Failed | Files Touched |
|-----------|---------------|---------------|---------------|
| M1-Iter1  | UpNextRow using `h-10` pills (40px) + standard header margins | Total height was 64px (> 50px limit) | `components/UpNextRow.tsx` |
| M1-Iter2  | UpNextRow using `h-8` pills (32px) + header badge `py-0.5` | Total height was 52.5px (> 50px limit due to header badge padding + container overflow) | `components/UpNextRow.tsx` |
