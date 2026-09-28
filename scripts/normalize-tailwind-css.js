import { readFileSync, writeFileSync } from 'node:fs';

const filePath = new URL('../css/tailwind.css', import.meta.url);
const contents = readFileSync(filePath, 'utf8');

// Existing fix: drop a redundant declaration Tailwind emits.
let normalized = contents.replace('vertical-align:middle;display:block', 'display:block');

// Cross-platform determinism: Tailwind converts arbitrary colours like bg-[#ff4d6a]/20 to
// oklab(). The last digit of those floats differs between platforms/binaries (Windows local
// build vs Linux CI: .0578817 vs .0578818), which made the "Tailwind build is up to date" CI
// check fail on every run. Rounding to a precision far below anything visible makes the output
// identical everywhere. Alpha (after "/") is left untouched.
const fmt = (n, dp) => {
  const s = Number(n.toFixed(dp)).toString();
  return s.replace(/^(-?)0\./, '$1.');
};
normalized = normalized.replace(/oklab\(([^)]*)\)/g, (m, inner) => {
  const [color, alpha] = inner.split('/');
  const parts = color.trim().split(/\s+/).map((tok) => {
    if (tok.endsWith('%')) return fmt(parseFloat(tok), 2) + '%';
    const n = parseFloat(tok);
    return Number.isNaN(n) ? tok : fmt(n, 4);
  });
  return `oklab(${parts.join(' ')}${alpha !== undefined ? '/' + alpha.trim() : ''})`;
});

if (normalized !== contents) {
  writeFileSync(filePath, normalized);
}