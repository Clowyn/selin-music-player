import { parseLrc, cleanTitle, cleanArtist, sanitizeInputs } from './app/api/lyrics/route.js';

// Since route.ts is TS, let's write a quick ts-node/tsx script or transpiled node script to run empirical tests.
console.log('Testing lyrics helper functions...');
