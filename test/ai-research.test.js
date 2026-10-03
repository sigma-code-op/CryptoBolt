import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('ai.html ships the transparency, history/compare and glossary containers and loads the module after ai-chat.js', () => {
  const html = read('ai.html');
  for (const id of ['result-transparency', 'result-explainers', 'result-history-note', 'research-history', 'research-compare', 'ai-glossary']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  const chat = html.indexOf('js/ai-chat.js');
  const research = html.indexOf('js/ai-research.js');
  assert.ok(chat > -1 && research > chat, 'ai-research.js must load after ai-chat.js');
});

test('AI failures are classified client-side and never log or store an API key', () => {
  const chat = read('js/ai-chat.js');
  assert.match(chat, /class AiRequestError/);
  assert.match(chat, /redactKey/);
  for (const code of ['missing_key', 'invalid_key', 'rate_limited', 'house_rate_limited', 'timeout', 'network', 'malformed_response', 'empty_response']) {
    assert.ok(chat.includes(code), `ai-chat.js should handle ${code}`);
  }
  assert.match(chat, /retryAfterSeconds/);
  // keys stay in sessionStorage only
  assert.doesNotMatch(chat, /localStorage\.[a-zA-Z]+\(["']cw_groq_api_key/);
  // failed turns must not be written to chat memory
  assert.match(chat, /if \(result\.failure\) \{[\s\S]*?return;\s*\}/);
});

test('saved research history never includes API keys', () => {
  const research = read('js/ai-research.js');
  assert.doesNotMatch(research, /cw_groq_api_key|x-groq-key|sessionStorage/);
  assert.match(research, /HISTORY_LIMIT = 20/);
});

test('error reporter scrubs key-shaped strings before sending', () => {
  assert.match(read('js/error-reporter.js'), /gsk_\[A-Za-z0-9_-\]\{6,\}/);
});

test('server logger and AI routes use the redacting error helpers', () => {
  assert.match(read('server/src/lib/logger.js'), /redactSecrets/);
  const ai = read('server/src/routes/ai.js');
  assert.match(ai, /classifyAiError/);
  assert.doesNotMatch(ai, /console\.error\(\s*'\[cryptobolt-server\] Groq/);
});