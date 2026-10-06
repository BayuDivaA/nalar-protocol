import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const from = '0x53E993819F2Bc45A029615e8634BDdEEab4F7817';
const to = '0xe56E18ff683AbF6E1aA01804FaCaeB3694FDdd35';

function background(storage, fetch, progress = []) {
  let listener;
  const context = vm.createContext({
    chrome: {
      runtime: { onMessage: { addListener(value) { listener = value; } } },
      tabs: { sendMessage: async (tabId, message, options) => { progress.push({ tabId, message, options }); } },
      storage: { local: {
        get: async (keys) => Object.fromEntries(keys.map((key) => [key, storage[key]])),
        set: async (values) => Object.assign(storage, values),
      } },
    },
    fetch, AbortController, TextDecoder, setTimeout, clearTimeout, console,
  });
  context.importScripts = () => vm.runInContext(source('config.js'), context);
  vm.runInContext(source('background.js'), context);
  return (message) => new Promise((resolve) => listener(message, { tab: { id: 7 }, frameId: 2 }, resolve));
}

const request = (chainId) => ({
  type: 'CHECK_TRANSACTION', origin: 'https://dapp.example', chainId,
  transaction: { chainId, from, to, value: '0x0', data: '0x' },
});

test('streamed progress belongs to the current request and does not replace final result validation', async () => {
  const progress = [];
  const result = { ok: true, decision: 'BLOCK', riskScore: 90, intentMatch: false, comparison: { overall: 'MISMATCH', matches: false }, simulation: { success: true }, explanation: { summary: 'Permission requested.' } };
  const frame = `event: progress\ndata: ${JSON.stringify({ stage: 'decode', status: 'running', chainId: 56 })}\n\nevent: result\ndata: ${JSON.stringify(result)}\n\n`;
  const bytes = new TextEncoder().encode(frame);
  const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(bytes.slice(0, 21)); controller.enqueue(bytes.slice(21)); controller.close(); },
  }), { headers: { 'Content-Type': 'text/event-stream' } }), progress);
  const response = await send({ ...request(56), id: 44 });
  assert.equal(response.security.decision, 'BLOCK');
  assert.equal(progress.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(progress[0])), { tabId: 7, options: { frameId: 2 }, message: { type: 'TX_PROGRESS', id: 44, chainId: 56, progress: { stage: 'decode', status: 'running', chainId: 56 } } });
});

test('truncated, duplicate, malformed or wrong-chain security streams never produce ALLOW', async () => {
  for (const frame of [
    'event: progress\ndata: {"stage":"intent","status":"completed","chainId":56}\n\n',
    'event: result\ndata: {}\n\nevent: result\ndata: {}\n\n',
    'event: progress\ndata: not-json\n\n',
    'event: progress\ndata: {"stage":"decode","status":"running","chainId":97}\n\n',
  ]) {
    const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => new Response(frame, { headers: { 'Content-Type': 'text/event-stream' } }));
    const response = await send(request(56));
    assert.equal(response.security, null);
    assert.equal(response.errorCode, 'ANALYSIS_UNAVAILABLE');
  }
});

test('streamed backend errors and interrupted reads hold the transaction', async () => {
  for (const code of ['NETWORK_CONNECTION_FAILED', 'ANALYSIS_UNAVAILABLE', 'UNSUPPORTED_CHAIN']) {
    const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => new Response(
      `event: result\ndata: ${JSON.stringify({ ok: false, error: code, receivedChainId: 56 })}\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    ));
    const result = await send(request(56));
    assert.equal(result.security, null);
    assert.equal(result.errorCode, code === 'UNSUPPORTED_CHAIN' ? 'NETWORK_NOT_SUPPORTED' : code);
  }
  const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => new Response(new ReadableStream({
    start(controller) { controller.error(Object.assign(new Error('deadline'), { name: 'AbortError' })); },
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const result = await send(request(56));
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'ANALYSIS_TIMEOUT');
});

test('selected Mainnet reaches existing backend with chain 56', async () => {
  const storage = { selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB for token' } };
  let sent;
  const send = background(storage, async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, decision: 'BLOCK', riskScore: 90, intentMatch: false, comparison: { overall: 'MISMATCH', matches: false }, simulation: { success: true }, explanation: { summary: 'Approval requested.' } }) };
  });
  const response = await send(request('0x38'));
  assert.equal(sent.transaction.chainId, 56);
  assert.equal(response.security.decision, 'BLOCK');
});

test('mismatch, unsupported, and invalid selected chains never reach analysis', async () => {
  for (const [stored, chain, code] of [[97, 56, 'NETWORK_MISMATCH'], [56, 1, 'NETWORK_NOT_SUPPORTED'], ['56junk', 56, 'NETWORK_UNAVAILABLE']]) {
    let calls = 0;
    const send = background({ selectedNetwork: stored }, async () => { calls++; throw Error('Must not fetch'); });
    const result = await send(request(chain));
    assert.equal(result.security, null);
    assert.equal(result.errorCode, code);
    assert.equal(calls, 0);
  }
});

test('missing wallet chain is not inferred from the transaction payload', async () => {
  let calls = 0;
  const send = background({ selectedNetwork: 56 }, async () => { calls++; throw Error('Must not fetch'); });
  const result = await send({ ...request(56), chainId: null });
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'NETWORK_UNAVAILABLE');
  assert.equal(calls, 0);
});

test('RPC, MCP, and timeout errors cannot return a safe decision', async () => {
  for (const [status, body, code] of [
    [503, { error: 'NETWORK_CONNECTION_FAILED' }, 'NETWORK_CONNECTION_FAILED'],
    [503, { error: 'ANALYSIS_UNAVAILABLE' }, 'ANALYSIS_UNAVAILABLE'],
  ]) {
    const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => ({
      ok: false, status, text: async () => JSON.stringify(body),
    }));
    const result = await send(request(56));
    assert.equal(result.security, null);
    assert.equal(result.errorCode, code);
  }
  const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => {
    throw Object.assign(new Error('deadline'), { name: 'AbortError' });
  });
  const result = await send(request(56));
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'ANALYSIS_TIMEOUT');

  const bodyTimeout = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => ({
    ok: true, status: 200, text: async () => { throw Object.assign(new Error('deadline'), { name: 'AbortError' }); },
  }));
  const bodyResult = await bodyTimeout(request(56));
  assert.equal(bodyResult.security, null);
  assert.equal(bodyResult.errorCode, 'ANALYSIS_TIMEOUT');
});

test('incomplete successful response cannot become ALLOW', async () => {
  const send = background({ selectedNetwork: 56, intents: { 'https://dapp.example': 'Swap BNB' } }, async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ ok: true, decision: 'ALLOW' }),
  }));
  const result = await send(request(56));
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'ANALYSIS_UNAVAILABLE');
});

test('ambiguous comparison cannot become ALLOW even if backend labels it so', async () => {
  const send = background({ selectedNetwork: 97, intents: { 'https://dapp.example': 'Swap' } }, async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      ok: true, decision: 'ALLOW', riskScore: 12, intentMatch: false,
      comparison: { overall: 'UNCERTAIN', matches: false },
      simulation: { success: true }, explanation: { summary: 'Could not verify intent.' },
    }),
  }));
  const result = await send(request(97));
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'ANALYSIS_UNAVAILABLE');
});

test('unavailable BNB evidence cannot be presented as a completed safe analysis', async () => {
  const send = background({ selectedNetwork: 97, intents: { 'https://dapp.example': 'Mint one NFT' } }, async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      ok: true, decision: 'ALLOW', riskScore: 12, intentMatch: true,
      comparison: { overall: 'MATCH', matches: true },
      simulation: { success: true }, explanation: { summary: 'No blocking issue found.' },
      bnbIntelligence: { available: false, observations: [] },
    }),
  }));
  const result = await send(request(97));
  assert.equal(result.security, null);
  assert.equal(result.errorCode, 'ANALYSIS_UNAVAILABLE');
});

test('failed simulation keeps the backend BLOCK result', async () => {
  const send = background({ selectedNetwork: 97, intents: { 'https://dapp.example': 'Mint an NFT' } }, async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({
      ok: true, decision: 'BLOCK', riskScore: 100, intentMatch: false,
      comparison: { matches: false, mismatches: ['Transaction simulation failed.'] },
      simulation: { success: false }, explanation: { summary: 'The transaction simulation failed.' },
    }),
  }));
  const result = await send(request(97));
  assert.equal(result.security?.decision, 'BLOCK');
  assert.equal(result.errorCode, null);
});
