import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../js/webmcp.js', import.meta.url), 'utf8');

function load(modelContext) {
  const ctx = { navigator: modelContext ? { modelContext } : {}, window: { location: { assign() {} } }, fetch() {}, console };
  vm.runInNewContext(src, ctx);
  return ctx;
}

test('webmcp.js does nothing in browsers without navigator.modelContext', () => {
  assert.doesNotThrow(() => load(null));
});

test('webmcp.js registers its tools with valid schemas', () => {
  const tools = [];
  load({ registerTool: (t) => tools.push(t) });
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'calculate_futures_pnl', 'calculate_liquidation_price', 'calculate_position_size',
    'estimate_funding_fee', 'get_crypto_price', 'open_cryptobolt_page',
  ]);
  for (const t of tools) {
    assert.ok(t.description.length > 20);
    assert.equal(t.inputSchema.type, 'object');
    assert.equal(typeof t.execute, 'function');
  }
});

test('webmcp liquidation tool returns the same number as the MCP server', async () => {
  const tools = {};
  load({ registerTool: (t) => { tools[t.name] = t; } });
  const out = await tools.calculate_liquidation_price.execute({ side: 'long', entry_price: 100, leverage: 10 });
  assert.equal(JSON.parse(out.content[0].text).liquidation_price, 90.5);
});

test('every public page loads webmcp.js and advertises its Markdown twin', () => {
  const pages = readdirSync(new URL('..', import.meta.url)).filter((f) => f.endsWith('.html') && f !== '404.html');
  for (const p of pages) {
    const html = readFileSync(new URL('../' + p, import.meta.url), 'utf8');
    assert.match(html, /js\/webmcp\.js/, p);
  }
});