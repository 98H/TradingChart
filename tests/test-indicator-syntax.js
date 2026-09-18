// tests/test-indicator-syntax.js
import { Indicator } from 'pinets';

export function testScript(name, code) {
  try {
    const sanitized = code.replace(/\bcolor\.cyan\b/g, 'color.rgb(0, 229, 255)');
    const ind = Indicator.from(sanitized);
    const decl = ind.getDeclarationType();
    const meta = ind.getInputsMeta();
    return { success: true, declaration: decl, inputsCount: meta.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

console.log('Indicator test helper ready.');
