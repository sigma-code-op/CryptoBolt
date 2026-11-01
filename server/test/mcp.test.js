import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRpc, TOOLS } from '../src/routes/mcp.js';

const call = (name, args) => handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

test('initialize negotiates a supported protocol version', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(res.result.protocolVersion, '2025-06-18');
  assert.ok(res.result.capabilities.tools);
  const old = handleRpc({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(old.result.protocolVersion, '2025-06-18');
});

test('notifications produce no response', () => {
  assert.equal(handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('tools/list exposes every tool without leaking the run function', () => {
  const res = handleRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(res.result.tools.length, TOOLS.length);
  for (const t of res.result.tools) {
    assert.ok(t.name && t.description && t.inputSchema);
    assert.equal(t.run, undefined);
  }
});

test('liquidation price matches the site calculator (10x long at 100, 0.5% MMR -> 90.5)', () => {
  const res = call('calculate_liquidation_price', { side: 'long', entry_price: 100, leverage: 10 });
  assert.equal(res.result.structuredContent.liquidation_price, 90.5);
  const short = call('calculate_liquidation_price', { side: 'short', entry_price: 100, leverage: 10 });
  assert.equal(short.result.structuredContent.liquidation_price, 109.5);
});

test('position size: 1% of 10,000 risked with a 2 stop on a 100 entry', () => {
  const res = call('calculate_position_size', { side: 'long', balance: 10000, risk_pct: 1, entry_price: 100, stop_price: 98, leverage: 5 });
  const o = res.result.structuredContent;
  assert.equal(o.risk_usd, 100);
  assert.equal(o.quantity, 50);
  assert.equal(o.notional_usd, 5000);
  assert.equal(o.margin_usd, 1000);
  assert.equal(o.targets['2R'], 104);
});

test('futures pnl and funding fee', () => {
  const pnl = call('calculate_futures_pnl', { side: 'long', entry_price: 100, exit_price: 110, margin: 1000, leverage: 10, fee_pct: 0 });
  assert.equal(pnl.result.structuredContent.net_pnl, 1000);
  const fund = call('estimate_funding_fee', { side: 'long', notional: 10000, funding_rate_pct: 0.01, days: 1 });
  assert.equal(fund.result.structuredContent.total_usd, -3);
  assert.equal(fund.result.structuredContent.direction, 'you pay');
});

test('bad input is a tool error, unknown tool and method are protocol errors', () => {
  assert.equal(call('calculate_liquidation_price', { side: 'sideways' }).result.isError, true);
  assert.equal(call('nope', {}).error.code, -32602);
  assert.equal(handleRpc({ jsonrpc: '2.0', id: 9, method: 'resources/list' }).error.code, -32601);
  assert.equal(handleRpc({ nope: true }).error.code, -32600);
});