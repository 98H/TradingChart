// tests/validate-all-indicators.js
import { INDICATORS_LIBRARY } from '../client/src/indicatorsData.js';
import { Indicator } from 'pinets';

console.log(`Auditing ${INDICATORS_LIBRARY.length} indicators with PineTS compiler...`);

let passed = 0;
let failed = 0;
const failures = [];

for (const ind of INDICATORS_LIBRARY) {
  try {
    const sanitized = ind.script.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
    const parsed = Indicator.from(sanitized);
    const decl = parsed.getDeclarationType();
    const meta = parsed.getInputsMeta();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ id: ind.id, name: ind.name, error: e.message });
  }
}

console.log(`Passed: ${passed}/${INDICATORS_LIBRARY.length}`);
console.log(`Failed: ${failed}/${INDICATORS_LIBRARY.length}`);

if (failures.length > 0) {
  console.error('Failures:', JSON.stringify(failures, null, 2));
  process.exit(1);
} else {
  console.log('ALL INDICATORS VALIDATED WITH 100% SUCCESS!');
  process.exit(0);
}
