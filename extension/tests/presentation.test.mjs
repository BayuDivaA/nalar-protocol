import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const file = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

function openPopup(storage, wallet = { chainId: 97 }) {
  const ids = ['intent', 'save', 'clearIntent', 'message', 'siteName', 'toggle', 'systemStatus', 'statusDot', 'themeToggle', 'securityHeading', 'securityDescription', 'networkSelect', 'networkNote', 'networkError', 'networkErrorTitle', 'networkErrorText', 'networkRetry', 'networkTestnet'];
  const elements = Object.fromEntries(ids.map((id) => [id, {
    value: '', textContent: '', attributes: {}, listeners: {}, hidden: true,
    classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, listener) { this.listeners[name] = listener; },
    focus() {},
  }]));
  const document = {
    getElementById: (id) => elements[id],
    querySelector: () => ({}),
    documentElement: {
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
    },
  };
  const chrome = {
    tabs: { query: async () => [{ id: 1, url: 'https://dapp.example/swap' }] },
    runtime: { sendMessage: async ({ chainId }) => { storage.selectedNetwork = chainId; return { ok: true }; } },
    scripting: { executeScript: async ({ func, args }) => [{ result: await func(...args) }] },
    storage: { local: {
      get: async (keys) => Object.fromEntries(keys.map((key) => [key, storage[key]])),
      set: async (values) => Object.assign(storage, values),
    } },
  };
  const window = { matchMedia: () => ({ matches: false }), ethereum: wallet && { request: async ({ method, params }) => {
    if (method === 'eth_chainId') return `0x${wallet.chainId.toString(16)}`;
    if (method === 'eth_blockNumber') { if (wallet.failRpc) throw Error('RPC offline'); return '0x1'; }
    if (method === 'wallet_switchEthereumChain') { if (wallet.failSwitch) throw Error('Rejected'); wallet.chainId = Number(params[0].chainId); return null; }
    throw Error(`Unexpected method ${method}`);
  } } };
  const NALAR_CONFIG = { SUPPORTED_CHAINS: {
    97: { chainId: 97, name: 'BNB TESTNET', fullName: 'BNB Smart Chain Testnet' },
    56: { chainId: 56, name: 'BNB MAINNET', fullName: 'BNB Smart Chain Mainnet' },
  } };
  vm.runInNewContext(file('popup.js'), {
    document, chrome, URL, setTimeout: () => {}, console,
    window, NALAR_CONFIG,
  });
  return { elements, document };
}

test('popup retains active, theme, and intent in existing storage keys', async () => {
  const storage = {};
  const first = openPopup(storage);
  await new Promise(setImmediate);
  assert.equal(first.elements.systemStatus.textContent, 'ACTIVE');
  assert.equal(storage.protectionEnabled, true);
  await first.elements.toggle.listeners.click();
  assert.equal(storage.protectionEnabled, false);
  assert.equal(first.elements.systemStatus.textContent, 'PAUSED');
  assert.equal(first.elements.toggle.attributes['aria-pressed'], 'false');
  await first.elements.themeToggle.listeners.click();
  assert.equal(storage.nalarTheme, 'light');
  first.elements.intent.value = 'Swap tBNB for NDEMO';
  await first.elements.save.listeners.click();
  assert.equal(storage.intents['https://dapp.example'], 'Swap tBNB for NDEMO');

  const reopened = openPopup(storage);
  await new Promise(setImmediate);
  assert.equal(reopened.elements.systemStatus.textContent, 'PAUSED');
  assert.equal(reopened.elements.intent.value, 'Swap tBNB for NDEMO');
  assert.equal(reopened.document.documentElement.attributes['data-theme'], 'light');
  await reopened.elements.toggle.listeners.click();
  assert.equal(storage.protectionEnabled, true);
  assert.equal(reopened.elements.systemStatus.textContent, 'ACTIVE');
});

test('saved intent can be cleared for the current site without deleting other sites', async () => {
  const storage = { intents: { 'https://dapp.example': 'Swap tBNB', 'https://other.example': 'Mint NFT' } };
  const popup = openPopup(storage);
  await new Promise(setImmediate);
  await popup.elements.clearIntent.listeners.click();
  assert.equal(popup.elements.intent.value, '');
  assert.equal(storage.intents['https://dapp.example'], undefined);
  assert.equal(storage.intents['https://other.example'], 'Mint NFT');
  assert.match(popup.elements.message.textContent, /removed/i);
});

test('network switch persists only after the wallet verifies the chain and RPC', async () => {
  const storage = {};
  const wallet = { chainId: 97 };
  const popup = openPopup(storage, wallet);
  await new Promise(setImmediate);
  popup.elements.networkSelect.value = '56';
  await popup.elements.networkSelect.listeners.change();
  assert.equal(wallet.chainId, 56);
  assert.equal(storage.selectedNetwork, 56);
  assert.equal(popup.elements.networkError.hidden, true);
  assert.equal(popup.elements.securityHeading.textContent, 'Ready before signing');
  const reopened = openPopup(storage, wallet);
  await new Promise(setImmediate);
  assert.equal(reopened.elements.networkSelect.value, '56');
  reopened.elements.networkSelect.value = '97';
  await reopened.elements.networkSelect.listeners.change();
  assert.equal(wallet.chainId, 97);
  assert.equal(storage.selectedNetwork, 97);
});

test('rejected switch and RPC failure leave the previous network selected', async () => {
  for (const failure of ['failSwitch', 'failRpc']) {
    const storage = { selectedNetwork: 97 };
    const wallet = { chainId: 97, [failure]: true };
    const popup = openPopup(storage, wallet);
    await new Promise(setImmediate);
    popup.elements.networkSelect.value = '56';
    await popup.elements.networkSelect.listeners.change();
    assert.equal(storage.selectedNetwork, 97);
    assert.equal(popup.elements.networkSelect.value, '97');
    assert.equal(popup.elements.networkError.hidden, false);
  }
});

test('missing or invalid saved network falls back only when Testnet is verified', async () => {
  const testnetStorage = { selectedNetwork: '56' };
  const testnet = openPopup(testnetStorage, { chainId: 97 });
  await new Promise(setImmediate);
  assert.equal(testnetStorage.selectedNetwork, 97);
  assert.equal(testnet.elements.networkError.hidden, true);

  const mainnetStorage = { selectedNetwork: '56' };
  const mainnet = openPopup(mainnetStorage, { chainId: 56 });
  await new Promise(setImmediate);
  assert.equal(mainnetStorage.selectedNetwork, '56');
  assert.equal(mainnet.elements.networkError.hidden, false);

  const unsupportedStorage = {};
  const unsupported = openPopup(unsupportedStorage, { chainId: 1 });
  await new Promise(setImmediate);
  assert.equal(unsupportedStorage.selectedNetwork, undefined);
  assert.equal(unsupported.elements.networkErrorTitle.textContent, 'NETWORK NOT SUPPORTED');

  const unavailable = openPopup({ selectedNetwork: 56 }, null);
  await new Promise(setImmediate);
  assert.equal(unavailable.elements.networkErrorTitle.textContent, 'NETWORK CONNECTION FAILED');
  assert.equal(unavailable.elements.securityHeading.textContent, 'Checks unavailable');
});

test('address and transaction links use the right explorer; unknown chain has no links', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function linkifyAddresses');
  const end = source.indexOf('  function humanizeAction', start);
  assert.ok(start > 0 && end > start);
  const links = [];
  let node;
  const document = {
    createTreeWalker: () => ({
      nextNode() { if (this.done) return false; this.done = true; return true; },
      get currentNode() { return node; },
    }),
    createDocumentFragment: () => ({ append(item) { if (item.href) links.push(item.href); } }),
    createTextNode: (text) => ({ text }),
    createElement: () => ({ setAttribute() {} }),
  };
  const context = { document, NodeFilter: { SHOW_TEXT: 4 },
    NALAR_CONFIG: { SUPPORTED_CHAINS: { 97: { explorer: 'https://testnet.bscscan.com' }, 56: { explorer: 'https://bscscan.com' } } },
    parseNumericChainId: Number,
    formatAddress: (address) => `${address.slice(0, 6)}…${address.slice(-4)}`,
  };
  vm.runInNewContext(`${source.slice(start, end)};this.linkifyAddresses = linkifyAddresses`, context);
  const address = `0x${'a'.repeat(40)}`;
  const hash = `0x${'b'.repeat(64)}`;
  for (const [chain, explorer] of [[97, 'testnet.bscscan.com'], [56, 'bscscan.com']]) {
    node = { nodeValue: `Contract ${address}; hash ${hash}`,
      parentElement: { closest: () => false }, replaceWith() {} };
    links.length = 0;
    context.linkifyAddresses({}, chain);
    assert.deepEqual(links, [`https://${explorer}/address/${address}`, `https://${explorer}/tx/${hash}`]);
  }
  links.length = 0;
  context.linkifyAddresses({}, 1);
  assert.deepEqual(links, []);
});

test('wallet network is rechecked before an allowed transaction reaches the wallet', async () => {
  const source = file('injected.js');
  const start = source.indexOf('  async function handleTransactionRequest(');
  const end = source.indexOf('  function securitySummary(', start);
  assert.ok(start > 0 && end > start);
  const wallet = { chainId: 56, sends: 0 };
  const listeners = new Set();
  let selectedChainId = 56;
  let decision;
  let failure;
  const window = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    postMessage(message) {
      if (message.type !== 'TX_REQUEST') return;
      queueMicrotask(() => {
        for (const listener of listeners) listener({ source: window, data: {
          source: 'NALAR_EXTENSION', type: 'TX_RESULT', id: message.id,
          security: { decision: 'ALLOW' },
        } });
      });
    },
  };
  const context = {
    window, console, setTimeout, clearTimeout, requestId: 0,
    NALAR_CONFIG: { SUPPORTED_CHAINS: { 56: { hex: '0x38', fullName: 'BNB Smart Chain Mainnet' }, 97: { hex: '0x61', fullName: 'BNB Smart Chain Testnet' } } },
    parseNumericChainId: (value) => Number(value),
    normalizeChainIdHex: (value) => `0x${value.toString(16)}`,
    getProtectionStatus: async () => true,
    getSelectedNetwork: async () => selectedChainId,
    getStoredIntent: async () => 'Send BNB',
    showIntentOverlay: async () => 'Send BNB',
    saveIntent: async () => {},
    showAnalysisOverlay: () => ({ remove() {} }),
    showDecisionOverlay: (_result, _state, onContinue) => { decision = onContinue; },
    showNetworkFailureOverlay: (options) => { failure = options; },
    securitySummary: () => ({}),
  };
  vm.runInNewContext(`${source.slice(start, end)};this.handleTransactionRequest = handleTransactionRequest`, context);
  const originalRequest = async ({ method }) => {
    if (method === 'eth_chainId') return `0x${wallet.chainId.toString(16)}`;
    if (method === 'eth_blockNumber') return '0x1';
    if (method === 'eth_sendTransaction') { wallet.sends++; return '0xhash'; }
    throw Error(`Unexpected method ${method}`);
  };
  const args = { method: 'eth_sendTransaction', params: [{ to: '0xabc' }] };
  const send = () => context.handleTransactionRequest({ originalRequest, provider: {}, args, providerLabel: 'test' });

  const safe = send();
  await new Promise(setImmediate);
  await decision();
  assert.equal(await safe, '0xhash');
  assert.equal(wallet.sends, 1);

  const stale = send();
  await new Promise(setImmediate);
  wallet.chainId = 97;
  await decision();
  assert.equal(wallet.sends, 1);
  assert.equal(failure.title, 'NETWORK MISMATCH');
  failure.onCancel();
  await assert.rejects(stale, /network could not be verified/);

  args.params[0].chainId = '0x61';
  const mismatched = send();
  await new Promise(setImmediate);
  assert.equal(failure.title, 'NETWORK MISMATCH');
  assert.match(failure.description, /DApp requested a different network/);
  assert.equal(args.params[0].chainId, '0x61');
  assert.equal(wallet.sends, 1);
  failure.onCancel();
  await assert.rejects(mismatched, /Transaction cancelled/);
});

test('failed intent persistence never starts analysis or forwards to the wallet', async () => {
  const source = file('injected.js');
  const start = source.indexOf('  async function handleTransactionRequest(');
  const end = source.indexOf('  function securitySummary(', start);
  let failure;
  let sends = 0;
  let analyzed = 0;
  const context = {
    console, setTimeout, clearTimeout,
    NALAR_CONFIG: { SUPPORTED_CHAINS: { 97: { fullName: 'BNB Smart Chain Testnet' } } },
    parseNumericChainId: Number,
    normalizeChainIdHex: (value) => `0x${value.toString(16)}`,
    getProtectionStatus: async () => true,
    getSelectedNetwork: async () => 97,
    getStoredIntent: async () => '',
    showIntentOverlay: async () => 'Mint one NFT',
    saveIntent: async () => { throw Error('Storage unavailable'); },
    showNetworkFailureOverlay: (options) => { failure = options; },
    showAnalysisOverlay: () => { analyzed++; },
  };
  vm.runInNewContext(`${source.slice(start, end)};this.handleTransactionRequest = handleTransactionRequest`, context);
  const originalRequest = async ({ method }) => {
    if (method === 'eth_chainId') return '0x61';
    if (method === 'eth_blockNumber') return '0x1';
    if (method === 'eth_sendTransaction') { sends++; return '0xhash'; }
    throw Error(`Unexpected method ${method}`);
  };
  const pending = context.handleTransactionRequest({ originalRequest, provider: {}, args: { method: 'eth_sendTransaction', params: [{ to: '0xabc' }] }, providerLabel: 'test' });
  await new Promise(setImmediate);
  assert.equal(failure.title, 'INTENT UNAVAILABLE');
  assert.equal(analyzed, 0);
  assert.equal(sends, 0);
  failure.onCancel();
  await assert.rejects(pending, /INTENT UNAVAILABLE/);
});

test('uncertain intent is not described as mismatch and configured tax is not described as charged', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function getPrimaryRootCause(');
  const end = source.indexOf('  function createWhyStoppedCard(', start);
  const context = { getFallbackSummary: () => 'Review the transaction.' };
  vm.runInNewContext(`${source.slice(start, end)};this.getPrimaryRootCause = getPrimaryRootCause`, context);
  assert.equal(context.getPrimaryRootCause({ comparison: { status: 'UNKNOWN' }, summary: 'Could not verify intent.' }, { intentMatch: false, comparison: { overall: 'UNCERTAIN' } }, 'REVIEW'), 'Could not verify intent.');
  const tax = context.getPrimaryRootCause({}, { scamAnalyses: [{ contractPrivileges: { state: [{ code: 'CURRENT_SELL_TAX', value: 9800 }] } }] }, 'BLOCK');
  assert.match(tax, /configured 98% sell tax/);
  assert.doesNotMatch(tax, /charges|preventing you/);
});
