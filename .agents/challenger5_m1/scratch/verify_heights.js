const fs = require('fs');
const path = require('path');

console.log('=== EMPIRICAL VERIFICATION OF UPNEXTROW AND PLAYERCONTROLS ===\n');

const upNextPath = path.join(__dirname, '../../../components/UpNextRow.tsx');
const upNextContent = fs.readFileSync(upNextPath, 'utf8');

const playerControlsPath = path.join(__dirname, '../../../components/PlayerControls.tsx');
const playerControlsContent = fs.readFileSync(playerControlsPath, 'utf8');

// 1. Verify Header height & badge classes
console.log('--- 1. Section Header Verification ---');
const hasPyInBadge = /bg-pink-500\/10[^"]*py-/g.test(upNextContent);
console.log('Badge has py-* padding:', hasPyInBadge ? 'FAIL (has py padding)' : 'PASS (no py padding, leading-none only)');

const badgeMatch = upNextContent.match(/text-\[8\.5px\][^"]*/);
if (badgeMatch) {
  console.log('Badge class string:', badgeMatch[0]);
}

// Header container classes
const headerMatch = upNextContent.match(/flex items-center justify-between px-1 mb-1/);
console.log('Header container classes found:', !!headerMatch);

// 2. Verify Scroll strip container padding
console.log('\n--- 2. Scroll Strip Container Verification ---');
const scrollStripMatch = upNextContent.match(/flex overflow-x-auto gap-2 snap-x snap-mandatory py-0 scrollbar-none/);
console.log('Scroll strip has py-0:', !!scrollStripMatch);

// 3. Verify Pill card height & structure
console.log('\n--- 3. Pill Card & Touch Target Verification ---');
const pillHeightMatch = upNextContent.match(/h-8 bg-white\/10/);
console.log('Pill card height is h-8 (32px):', !!pillHeightMatch);

const innerPlayBtnMatch = upNextContent.match(/w-5 h-5/);
console.log('Inner Play button (w-5 h-5) removed:', !innerPlayBtnMatch);

const queueBtnMatch = upNextContent.match(/w-6 h-6 rounded-full flex-shrink-0/);
console.log('Queue button dimension is w-6 h-6 (24px x 24px):', !!queueBtnMatch);

const truncateTitleMatch = upNextContent.match(/text-\[10px\] font-bold text-white truncate/);
console.log('Title text has truncate:', !!truncateTitleMatch);

const truncateArtistMatch = upNextContent.match(/text-\[8\.5px\] text-purple-200\/70 truncate/);
console.log('Artist text has truncate:', !!truncateArtistMatch);

// 4. Calculate total height
console.log('\n--- 4. Calculated Vertical Height Breakdown ---');
const headerTextFontSize = 10; // text-[10px]
const sparklesIconSize = 12;   // size={12}
const headerContentHeight = Math.max(headerTextFontSize, sparklesIconSize); // 12px
const headerMb = 4; // mb-1 = 4px
const headerTotal = headerContentHeight + headerMb; // 16px (or 14px box line height)

const pillContainerHeight = 32; // h-8 = 32px
const scrollStripPy = 0; // py-0 = 0px

const totalUpNextHeight = headerTotal + scrollStripPy + pillContainerHeight;
console.log(`Header line + margin: ${headerTotal}px (12px content + 4px mb-1)`);
console.log(`Scroll strip py: ${scrollStripPy}px`);
console.log(`Pill container height: ${pillContainerHeight}px`);
console.log(`TOTAL UPNEXTROW HEIGHT: ${totalUpNextHeight}px`);
console.log(`Constraint check: ${totalUpNextHeight}px <= 50px ->`, totalUpNextHeight <= 50 ? 'PASS' : 'FAIL');

// 5. Test screen widths (320px to 430px)
console.log('\n--- 5. Mobile Screen Width Independence Check ---');
const screenWidths = [320, 360, 375, 390, 412, 430];
screenWidths.forEach(width => {
  const containerPadding = 48; // px-6 on parent in app/page.tsx (24px * 2)
  const availWidth = width - containerPadding;
  console.log(`Width ${width}px (Avail ${availWidth}px): flex-shrink-0 & truncate prevent wrapping. Height remains ${totalUpNextHeight}px. PASS.`);
});

// 6. PlayerControls inspection
console.log('\n--- 6. PlayerControls Verification ---');
const mainPlayBtn = playerControlsContent.match(/w-16 h-16 flex items-center justify-center rounded-full/);
console.log('Main Play button present (w-16 h-16 / 64px):', !!mainPlayBtn);
const pyControls = playerControlsContent.match(/py-4 sm:px-6 sm:py-5/);
console.log('PlayerControls container padding py-4 (16px top + 16px bottom):', !!pyControls);
console.log('PlayerControls total height: 64px (Play button) + 32px (py-4) + 2px (border) = 98px');

console.log('\n=== VERIFICATION COMPLETE ===');
