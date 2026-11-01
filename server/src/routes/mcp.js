// ---------------------------------------------------------------------------
// POST /mcp — a small, stateless, read-only Model Context Protocol server
// (Streamable HTTP transport, JSON responses only). It exposes CryptoBolt's
// pure trading calculators to AI agents. No auth, no user data, no keys, no
// outbound calls: every tool is arithmetic on the arguments it is given.
// Advertised at https://cryptobolt.io/.well-known/mcp/server-card.json
// ---------------------------------------------------------------------------

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  InputError,
  liquidationPrice,
  positionSize,
  futuresPnl,
  fundingFee,
} from '../lib/trading-math.js';

const router = Router();

export const MCP_SERVER_INFO = { name: 'cryptobolt-calculators', title: 'CryptoBolt Trading Calculators', version: '1.0.0' };
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const SIDE = { type: 'string', enum: ['long', 'short'], description: 'Position direction.' };
const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'calculate_liquidation_price',
    title: 'Liquidation price',
    description: 'Estimate the liquidation price of an isolated-margin leveraged futures position (simplified model).',
    inputSchema: {
      type: 'object',
      properties: {
        side: SIDE,
        entry_price: { type: 'number', description: 'Entry price in USD.' },
        leverage: { type: 'number', description: 'Leverage multiple, 1 or higher.' },
        maintenance_margin_pct: { type: 'number', description: 'Maintenance margin rate in percent. Default 0.5.' },
      },
      required: ['side', 'entry_price', 'leverage'],
    },
    annotations: READ_ONLY,
    run: liquidationPrice,
  },
  {
    name: 'calculate_position_size',
    title: 'Position size',
    description: 'Position size, notional, margin and 1R/2R/3R targets from balance, risk %, entry and stop-loss.',
    inputSchema: {
      type: 'object',
      properties: {
        side: SIDE,
        balance: { type: 'number', description: 'Account balance in USD.' },
        risk_pct: { type: 'number', description: 'Percent of balance to risk, e.g. 1.' },
        entry_price: { type: 'number' },
        stop_price: { type: 'number' },
        leverage: { type: 'number', description: 'Default 1.' },
      },
      required: ['side', 'balance', 'risk_pct', 'entry_price', 'stop_price'],
    },
    annotations: READ_ONLY,
    run: positionSize,
  },
  {
    name: 'calculate_futures_pnl',
    title: 'Futures profit and loss',
    description: 'Net profit/loss, ROE and fees for a leveraged futures trade.',
    inputSchema: {
      type: 'object',
      properties: {
        side: SIDE,
        entry_price: { type: 'number' },
        exit_price: { type: 'number' },
        margin: { type: 'number', description: 'Margin in USD.' },
        leverage: { type: 'number' },
        fee_pct: { type: 'number', description: 'Taker fee per side in percent. Default 0.05.' },
      },
      required: ['side', 'entry_price', 'exit_price', 'margin', 'leverage'],
    },
    annotations: READ_ONLY,
    run: futuresPnl,
  },
  {
    name: 'estimate_funding_fee',
    title: 'Funding fee',
    description: 'What a perpetual futures position pays or receives in funding over a holding period.',
    inputSchema: {
      type: 'object',
      properties: {
        side: SIDE,
        notional: { type: 'number', description: 'Position value in USD.' },
        funding_rate_pct: { type: 'number', description: 'Funding rate per interval in percent, e.g. 0.01.' },
        interval_hours: { type: 'number', description: 'Hours between funding payments. Default 8.' },
        days: { type: 'number', description: 'Holding period in days.' },
      },
      required: ['side', 'notional', 'funding_rate_pct', 'days'],
    },
    annotations: READ_ONLY,
    run: fundingFee,
  },
];

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// Returns a JSON-RPC response object, or null for notifications (no response).
export function handleRpc(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  const isNotification = msg.id === undefined || msg.id === null;
  const { id, method, params } = msg;

  if (isNotification) return null;

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      const protocolVersion = SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions:
            'Read-only trading calculators for crypto futures. Estimates only; not financial advice.',
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS.map(({ run, ...t }) => t) },
      };
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params?.name).slice(0, 60)}`);
      try {
        const out = tool.run(params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: false },
        };
      } catch (err) {
        if (err instanceof InputError) {
          return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: err.message }], isError: true } };
        }
        return rpcError(id, -32603, 'Internal error');
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method.slice(0, 60)}`);
  }
}

const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: rpcError(null, -32000, 'Too many requests.'),
});

router.post('/mcp', mcpLimiter, (req, res) => {
  const body = req.body;
  if (Array.isArray(body)) {
    if (body.length === 0 || body.length > 20) return res.status(400).json(rpcError(null, -32600, 'Invalid batch'));
    const out = body.map(handleRpc).filter(Boolean);
    return out.length ? res.json(out) : res.status(202).end();
  }
  const out = handleRpc(body);
  if (out === null) return res.status(202).end();
  return res.json(out);
});

router.get('/mcp', (_req, res) => {
  res.set('Allow', 'POST').status(405).json(rpcError(null, -32000, 'Use POST with a JSON-RPC 2.0 body.'));
});

export default router;