import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(ROOT, relativePath), 'utf8');

test('AI BYOK secrets are session-scoped, not persistent', () => {
  const insight = read('js/10-ai-insight.js');
  const chat = read('js/ai-chat.js');
  assert.match(insight, /sessionStorage\.getItem\('cw_groq_api_key'\)/);
  assert.match(chat, /sessionStorage\.getItem\("cw_groq_api_key"\)/);
  assert.doesNotMatch(insight, /localStorage\.(getItem|setItem|removeItem)\(['"]cw_groq_api_key/);
  assert.doesNotMatch(chat, /localStorage\.(getItem|setItem|removeItem)\(["']cw_groq_api_key/);
});

test('AI page controls have accessible names', () => {
  const html = read('ai.html');
  assert.match(html, /<label for="asset-input">Asset<\/label>/);
  assert.match(html, /<label for="market-type">Market<\/label>/);
  assert.match(html, /<label for="timeframe">Chart timeframe<\/label>/);
  assert.match(html, /id="chat-input"[\s\S]*aria-label="Ask CryptoBolt about the market"/);
});

test('terminal chart dependency does not block parsing', () => {
  assert.match(read('app.html'), /<script defer src="https:\/\/unpkg\.com\/lightweight-charts@4\.2\.1/);
});

test('account copy does not promise automatic exchange order imports', () => {
  const html = read('account.html');
  assert.match(html, /Purchase Receipt Log/);
  assert.match(html, /must be added manually/);
  assert.doesNotMatch(html, /Your Real Purchase History/);
});

test('deployment documentation links resolve to repository files', () => {
  for (const file of ['DEPLOYMENT_GUIDE.md', 'DEPLOY_CHECKLIST.md', 'ACCOUNTS_SETUP.md']) {
    assert.doesNotThrow(() => read(file));
  }
  for (const file of ['root-README.md', 'DEPLOY_CHECKLIST.md', 'ACCOUNTS_SETUP.md']) {
    assert.doesNotMatch(read(file), /CryptoBolt_Complete_Deployment_Guide\.md/);
  }
});
