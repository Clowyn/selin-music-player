## 2026-08-07T00:16:45Z
Task: Investigate metadata cleaning edge cases and regex robustness in app/api/lyrics/route.ts.
Analyze:
1. Standard YouTube titles (e.g. Tarkan - Yolla (Official Music Video), Mor ve Ötesi - Cambaz [HD], Sezen Aksu - Seni Yerler (Official Audio)).
2. Turkish channel names (netd müzik, Poll Production, Pasaj Müzik, etc.) and how sanitizeInputs extracts real artist & title when channel name is passed as artist.
3. Formulate exact TypeScript helper functions and regex patterns for cleanTitle, cleanArtist, and sanitizeInputs.
Write your analysis to d:\Projeler\Selin\selin-player\.agents\explorer2_m2\analysis.md and handoff.md, and send a message back to parent.
