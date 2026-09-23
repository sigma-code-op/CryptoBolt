import { readFileSync, writeFileSync } from 'node:fs';

const filePath = new URL('../css/tailwind.css', import.meta.url);
const contents = readFileSync(filePath, 'utf8');
const normalized = contents.replace('vertical-align:middle;display:block', 'display:block');

if (normalized !== contents) {
  writeFileSync(filePath, normalized);
}