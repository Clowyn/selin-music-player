import { parseLrc } from '../../app/api/lyrics/route';

interface TestCase {
  name: string;
  input: string;
  expected: Array<{ time: number; text: string }>;
}

const testCases: TestCase[] = [
  {
    name: '1. Standard two decimal timestamp',
    input: '[00:12.34]Sample text',
    expected: [{ time: 12.34, text: 'Sample text' }],
  },
  {
    name: '2. Three decimal places',
    input: '[01:05.678]Three decimal places',
    expected: [{ time: 65.678, text: 'Three decimal places' }],
  },
  {
    name: '3. Metadata headers ignored',
    input: '[ar:Artist Name][ti:Title]\n[al:Album Name]\n[by:Creator]\n[offset:0]',
    expected: [],
  },
  {
    name: '4. Multi-timestamp line',
    input: '[00:10.00][01:20.00]Repeated line',
    expected: [
      { time: 10, text: 'Repeated line' },
      { time: 80, text: 'Repeated line' },
    ],
  },
  {
    name: '5. Out of order timestamps',
    input: '[01:20.00]Second line\n[00:10.00]First line',
    expected: [
      { time: 10, text: 'First line' },
      { time: 80, text: 'Second line' },
    ],
  },
  {
    name: '6. Empty lines and missing text',
    input: '\n\n[00:05.00]   \n[00:15.00]Valid line\n',
    expected: [{ time: 15, text: 'Valid line' }],
  },
  {
    name: '7. Full mixed LRC document',
    input: `[ar: Test Artist]
[ti: Test Song]
[al: Test Album]
[by: AutoGenerator]
[00:00.00]Intro line
[00:12.34]Two decimals
[01:05.678]Three decimals
[02:00.00][02:30.50]Refrain repeated
[00:05.50]Out of order line
[00:10.00]
[03:00.00]The End`,
    expected: [
      { time: 0, text: 'Intro line' },
      { time: 5.5, text: 'Out of order line' },
      { time: 12.34, text: 'Two decimals' },
      { time: 65.678, text: 'Three decimals' },
      { time: 120, text: 'Refrain repeated' },
      { time: 150.5, text: 'Refrain repeated' },
      { time: 180, text: 'The End' },
    ],
  },
  {
    name: '8. Turkish Unicode characters & emojis',
    input: '[00:45.10]Şarkı sözü: Sevdiğim & Gönlüm ✨💖',
    expected: [{ time: 45.1, text: 'Şarkı sözü: Sevdiğim & Gönlüm ✨💖' }],
  },
  {
    name: '9. Timestamp without decimal part [mm:ss]',
    input: '[02:15]No decimal timestamp',
    expected: [{ time: 135, text: 'No decimal timestamp' }],
  },
  {
    name: '10. Large minute count [120:30.50]',
    input: '[120:30.50]Long track timestamp',
    expected: [{ time: 7230.5, text: 'Long track timestamp' }],
  },
];

let passed = 0;
let failed = 0;

console.log('=== LRC Parser Extended Stress Test Runner ===\n');

for (const tc of testCases) {
  const result = parseLrc(tc.input);
  const resultStr = JSON.stringify(result);
  const expectedStr = JSON.stringify(tc.expected);

  if (resultStr === expectedStr) {
    console.log(`[PASS] ${tc.name}`);
    passed++;
  } else {
    console.error(`[FAIL] ${tc.name}`);
    console.error(`  Expected: ${expectedStr}`);
    console.error(`  Got:      ${resultStr}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
