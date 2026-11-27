import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// js/certificate.js is a browser script (package.json is type: module), so load it in a sandbox
// with a CommonJS-style `module` and no `document`; it then only exports its pure helpers.
const sandbox = { module: { exports: {} }, Uint8Array, Math, JSON, String, Object };
vm.runInNewContext(readFileSync(new URL('../js/certificate.js', import.meta.url), 'utf8'), sandbox);
const { cleanName, certId, summary, jpegToPdf, longDate, SLUGS } = sandbox.module.exports;

const allDone = () => Object.fromEntries(SLUGS.map((s) => [s, 1]));
const allQuiz = (best, total = 4) => Object.fromEntries(SLUGS.map((s) => [s, { best, total }]));

test('there are twelve lessons and they match the course hub order', () => {
  assert.equal(SLUGS.length, 12);
  const hub = readFileSync(new URL('../trading-course.html', import.meta.url), 'utf8');
  const order = [...hub.matchAll(/data-lesson-card="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, [...SLUGS]);
});

test('certificate stays locked until all 12 lessons are complete', () => {
  assert.equal(summary({}).complete, false);
  const eleven = allDone(); delete eleven[SLUGS[5]];
  const s = summary({ done: eleven });
  assert.equal(s.complete, false);
  assert.equal(s.done, 11);
  assert.equal(s.next, SLUGS[5]);
  assert.equal(summary({ done: allDone() }).complete, true);
});

test('distinction needs every quiz taken and a 90% average', () => {
  assert.equal(summary({ done: allDone(), quiz: allQuiz(4) }).distinction, true);
  assert.equal(summary({ done: allDone(), quiz: allQuiz(4) }).pct, 100);
  assert.equal(summary({ done: allDone(), quiz: allQuiz(3) }).distinction, false); // 75%
  const missing = allQuiz(4); delete missing[SLUGS[0]];
  assert.equal(summary({ done: allDone(), quiz: missing }).distinction, false);
  assert.equal(summary({ quiz: allQuiz(4) }).distinction, false); // quizzes without lessons never qualify
});

test('quiz scores are capped at the quiz total', () => {
  assert.equal(summary({ done: allDone(), quiz: allQuiz(9, 4) }).pct, 100);
});

test('names are cleaned and limited', () => {
  assert.equal(cleanName('  Ada   Lovelace  '), 'Ada Lovelace');
  assert.equal(cleanName('<b>Eve</b>'), 'bEve/b');
  assert.equal(cleanName('x'.repeat(80)).length, 40);
  assert.equal(cleanName(null), '');
});

test('certificate id is stable, formatted and depends on name and date', () => {
  const a = certId('Ada Lovelace', '2026-11-27');
  assert.match(a, /^CB-[0-9A-Z]{4}-[0-9A-Z]{4}-261127$/);
  assert.equal(a, certId('ada lovelace', '2026-11-27'));
  assert.notEqual(a, certId('Ada Lovelace', '2026-11-28'));
  assert.notEqual(a, certId('Grace Hopper', '2026-11-27'));
});

test('dates are written out in full', () => {
  assert.equal(longDate('2026-11-27'), '27 November 2026');
  assert.equal(longDate('2027-01-05'), '5 January 2027');
  assert.equal(longDate('nope'), '');
});

test('PDF wrapper produces a valid one-page file with correct xref offsets', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 1600, 1131);
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  const start = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(start, start + 4), 'xref');
  const offsets = [...text.slice(start).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
  assert.equal(offsets.length, 5);
  offsets.forEach((o, i) => assert.equal(text.slice(o, o + (String(i + 1).length + 6)), `${i + 1} 0 obj`));
  assert.ok(text.includes('/Length 10 '));
  assert.ok(text.includes('/MediaBox [0 0 842 595]'));
});

test('hub page ships the certificate section, assets and schema', () => {
  const hub = readFileSync(new URL('../trading-course.html', import.meta.url), 'utf8');
  assert.ok(hub.includes('data-cert-canvas'));
  assert.ok(hub.includes('js/certificate.js'));
  assert.ok(hub.includes('css/certificate.css'));
  assert.ok(hub.includes('educationalCredentialAwarded'));
  assert.ok(hub.includes('Do I get a certificate?'));
});

test('every lesson page loads the certificate panel', () => {
  for (const s of SLUGS) {
    const html = readFileSync(new URL(`../${s}.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('data-cert-lesson'), s);
    assert.ok(html.includes('js/certificate.js'), s);
  }
});