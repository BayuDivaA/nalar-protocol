import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const file = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

const uiElement = (tag = 'div') => ({ tag, children: [], style: {}, attributes: {}, textContent: '',
  appendChild(child) { this.children.push(child); },
  insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); },
  setAttribute(name, value) { this.attributes[name] = value; },
  addEventListener() {},
});
const uiText = (node) => [node.textContent, ...node.children.map(uiText)].join(' ');

test('key reason precedes supporting sections and preserves the complete explanation and impact', () => {
  const source = file('injected.js');
  const reason = 'The requested swap asks for NFT permission instead.\nThis applies to the current collection, not a token transfer.';
  const impact = 'The operator could transfer NFTs in this collection. This does not itself transfer an NFT.';
  const explanation = Object.freeze({ whyStopped: Object.freeze({ primaryReason: reason, userImpact: impact }) });
  const section = (name) => ({ ...uiElement(), className: name });
  const context = {
    document: { createElement: uiElement, documentElement: uiElement(), addEventListener() {} },
    UI: {}, IDS: { decision: 'decision' }, getPrimaryRootCause: () => reason,
    createLabel: (text) => ({ ...uiElement(), textContent: text }),
    removeNalarElement() {}, applyOverlayStyle() {}, createModal: uiElement, linkifyAddresses() {},
    getDecisionStatus: () => ({}), createDecisionHeader: () => section('verdict'),
    createIntentVsActualComparison: () => section('intent'), createAffectedSection: () => section('affected'),
    createWhatThisMeansSection: () => section('meaning'), createEvidenceSection: () => section('evidence'),
    createTechnicalSection: () => section('technical'), createDecisionFooter: () => section('actions'),
  };
  const whyStart = source.indexOf('  function createWhyStoppedCard(');
  const whyEnd = source.indexOf('  function createIntentVsActualComparison(', whyStart);
  const resultStart = source.indexOf('  function showDecisionOverlay(');
  const resultEnd = source.indexOf('  function createDecisionHeader(', resultStart);
  vm.runInNewContext(`${source.slice(whyStart, whyEnd)}\n${source.slice(resultStart, resultEnd)};this.why = createWhyStoppedCard;this.show = showDecisionOverlay`, context);
  for (const decision of ['ALLOW', 'REVIEW', 'BLOCK']) {
    context.show({ explanation }, decision, () => {}, () => {}, 97);
    const overlay = context.document.documentElement.children.at(-1);
    const body = overlay.children[0].children[1];
    assert.deepEqual(body.children.map((child) => child.className), ['intent', 'nalar-why-stopped-card nalar-stagger-2', 'affected', 'meaning', 'evidence', 'technical']);
    const why = body.children[1];
    assert.equal(why.children[0].textContent, 'Why this verdict');
    assert.equal(why.children[1].textContent, reason);
    assert.equal(why.children[2].textContent, 'Impact');
    assert.equal(why.children[3].textContent, impact);
  }
  assert.equal(context.why({ whyStopped: { userImpact: reason } }, {}, 'REVIEW').children.length, 2, 'Do not repeat the key reason as impact');
  assert.equal(context.why({}, {}, 'REVIEW').children.length, 2, 'Do not invent missing impact');
});

test('verdict presents actual risk levels and never replaces a missing score with zero', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createDecisionHeader(');
  const end = source.indexOf('  function getPrimaryRootCause(', start);
  const context = { document: { createElement: uiElement }, UI: {}, createBrandEyebrow: (text) => ({ ...uiElement(), textContent: text }) };
  vm.runInNewContext(`${source.slice(start, end)};this.header = createDecisionHeader`, context);
  for (const [decision, level, score, caption] of [
    ['ALLOW', 'LOW', 12, 'Low risk'], ['REVIEW', 'MEDIUM', 65, 'Caution'],
    ['BLOCK', 'HIGH', 80, 'High risk'], ['BLOCK', 'CRITICAL', 90, 'Critical risk'],
    ['REVIEW', 'UNKNOWN', null, 'Risk unknown'],
  ]) {
    const header = context.header(decision, { title: 'Engine verdict', subtitle: 'Existing explanation' }, level, score);
    assert.match(uiText(header), new RegExp(caption));
    assert.match(uiText(header), new RegExp(decision));
    assert.match(uiText(header), /Existing explanation/);
    if (score === null) {
      assert.match(uiText(header), /Score unavailable/);
      assert.doesNotMatch(uiText(header), /0 \/ 100|null|NaN/);
    } else assert.match(uiText(header), new RegExp(`${score}.* / 100`));
  }
});

test('affected permissions and assets are taken only from the current effects', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createAffectedSection(');
  const end = source.indexOf('  function createWhatThisMeansSection(', start);
  const context = { document: { createElement: uiElement }, createLabel: (text) => ({ ...uiElement(), textContent: text }) };
  vm.runInNewContext(`${source.slice(start, end)};this.affected = createAffectedSection`, context);
  const token = `0x${'a'.repeat(40)}`;
  const spender = `0x${'b'.repeat(40)}`;
  const recipient = `0x${'c'.repeat(40)}`;
  const approval = { type: 'ERC20_ALLOWANCE', token, spender, unlimited: true, amount: '100000' };
  const result = Object.freeze({ effects: Object.freeze({ approvals: Object.freeze([Object.freeze(approval)]) }) });
  assert.match(uiText(context.affected(result)), /Unlimited token allowance/);
  assert.match(uiText(context.affected(result)), new RegExp(token));
  assert.match(uiText(context.affected(result)), new RegExp(spender));
  assert.doesNotMatch(uiText(context.affected(result)), /100000|BNB|DHON|NDEMO/);
  const swap = context.affected({ effects: { swaps: [{ tokenIn: token, tokenOut: recipient, recipient }] } });
  assert.match(uiText(swap), /Send asset.*Receive asset.*Recipient/s);
  assert.doesNotMatch(uiText(swap), new RegExp(spender));
  const mint = context.affected({ effects: { mints: [{ contract: token, recipient, quantity: 2 }] } });
  assert.match(uiText(mint), /NFT mint · 2/);
  const revoked = context.affected({ effects: { approvals: [{ type: 'ERC721_OPERATOR', token, operator: spender, approved: false }] } });
  assert.match(uiText(revoked), /NFT operator permission · revoked/);
  assert.equal(context.affected({}), null);
  assert.equal(context.affected({ effects: { approvals: [], swaps: [], mints: [] } }), null);
  const batch = context.affected({ effects: { approvals: Array.from({ length: 5 }, () => approval) } });
  assert.equal(batch.children.filter((child) => child.className === 'nalar-effect-row').length, 2);
  const more = batch.children.find((child) => child.className === 'nalar-affected-more');
  assert.equal(more.children[0].textContent, '3 more affected entries');
  assert.equal(more.children.length, 4, 'Every remaining permission is available in disclosure');
});

test('absent comparison data is visually unverified, not a fabricated match', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createIntentVsActualComparison(');
  const end = source.indexOf('  function createAffectedSection(', start);
  const context = { document: { createElement: uiElement }, UI: {}, createLabel: (text) => ({ ...uiElement(), textContent: text }), humanizeAction: (value) => value };
  vm.runInNewContext(`${source.slice(start, end)};this.compare = createIntentVsActualComparison`, context);
  const absent = context.compare({}, {}, 'REVIEW');
  assert.match(uiText(absent), /UNVERIFIED/);
  assert.equal(absent.children[0].children[1].attributes['data-state'], 'uncertain');
  const match = context.compare({}, { comparison: { overall: 'MATCH' } }, 'ALLOW');
  assert.match(uiText(match), /MATCHES/);
  const mismatch = context.compare({}, { comparison: { overall: 'MISMATCH' } }, 'BLOCK');
  assert.match(uiText(mismatch), /DOESN'T MATCH/);
  const amount = context.compare({ actualTransaction: { summary: 'Send native asset', input: '0.1 BNB', output: '1 token' } }, {}, 'REVIEW');
  assert.match(uiText(amount), /Input.*0\.1 BNB.*Output.*1 token/s);
});

test('redesigned result actions retain their original continue and cancel callbacks', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createDecisionFooter(');
  const end = source.indexOf('  /*', start);
  const context = {
    document: { createElement: uiElement }, UI: {}, IDS: { decision: 'decision' },
    getFooterNote: () => 'Original flow note',
    createButton: (label) => ({ ...uiElement('button'), textContent: label }),
    dismissNalarElement: (id, callback) => { assert.equal(id, 'decision'); callback(); },
  };
  vm.runInNewContext(`${source.slice(start, end)};this.footer = createDecisionFooter`, context);
  for (const decision of ['ALLOW', 'REVIEW', 'BLOCK']) {
    let cancelled = 0;
    let continued = 0;
    const footer = context.footer(decision, () => { continued++; }, () => { cancelled++; }, {});
    const actions = footer.children[1].children;
    assert.equal(actions.length, decision === 'BLOCK' ? 1 : 2);
    actions[0].onclick();
    assert.equal(cancelled, 1);
    assert.equal(continued, 0);
    if (decision !== 'BLOCK') {
      actions[1].onclick();
      assert.equal(continued, 1);
    }
  }
});

test('analysis failure has a neutral presentation and preserves recovery callbacks', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function showNetworkFailureOverlay(');
  const end = source.indexOf('  function showNetworkNotSupportedOverlay(', start);
  const root = uiElement();
  const context = {
    document: { createElement: () => ({ ...uiElement(), remove() {} }), documentElement: root },
    IDS: { network: 'network', analysis: 'analysis' }, UI: {}, removeNalarElement() {}, applyOverlayStyle() {},
    createModal: () => ({ ...uiElement(), classList: { add() {} } }),
    createBrandEyebrow: (text) => ({ ...uiElement(), textContent: text }),
    createButton: (text) => ({ ...uiElement('button'), textContent: text }),
  };
  vm.runInNewContext(`${source.slice(start, end)};this.show = showNetworkFailureOverlay`, context);
  let retries = 0;
  let cancellations = 0;
  context.show({ title: 'ANALYSIS UNAVAILABLE', description: 'Existing failure explanation.', onRetry: () => { retries++; }, onCancel: () => { cancellations++; } });
  const modal = root.children[0].children[0];
  assert.equal(modal.children[0].textContent, 'NALAR · TRANSACTION CHECK');
  assert.equal(modal.children[1].textContent, 'Analysis unavailable');
  assert.equal(modal.children[2].textContent, 'Existing failure explanation.');
  assert.deepEqual(modal.children[3].children.map((button) => button.textContent), ['Retry', 'Cancel']);
  modal.children[3].children[0].onclick();
  modal.children[3].children[1].onclick();
  assert.equal(retries, 1);
  assert.equal(cancellations, 1);
});

test('loading stays indeterminate until the current request finishes', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function showAnalysisOverlay(');
  const end = source.indexOf('  /*', start);
  const element = () => ({ children: [], attributes: {}, classList: { add() {} },
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const root = element();
  let dismissed;
  const context = {
    document: { createElement: element, documentElement: root },
    IDS: { analysis: 'analysis' }, window: { location: { hostname: 'dapp.example' } },
    NALAR_CONFIG: { SUPPORTED_CHAINS: { 56: { name: 'BNB MAINNET' }, 97: { name: 'BNB TESTNET' } } },
    parseNumericChainId: Number, removeNalarElement() {}, applyOverlayStyle() {},
    createModal: element, createBrandEyebrow: element,
    dismissNalarElement: (id, callback) => { dismissed = id; callback?.(); },
    setInterval() { assert.fail('Elapsed time must not complete security checks'); },
  };
  vm.runInNewContext(`${source.slice(start, end)};this.show = showAnalysisOverlay`, context);
  const loading = context.show(56);
  const modal = root.children[0].children[0];
  assert.equal(modal.attributes['aria-busy'], 'true');
  assert.equal(modal.children[1].textContent, 'Checking transaction');
  assert.match(modal.children[2].textContent, /BNB MAINNET/);
  assert.equal(modal.children[3].attributes.role, 'progressbar');
  assert.equal(modal.children[3].attributes['aria-valuenow'], undefined);
  assert.match(modal.children[4].textContent, /not been sent/);
  let completed = false;
  loading.remove(() => { completed = true; });
  assert.equal(dismissed, 'analysis');
  assert.equal(completed, true);
});

test('loading steps follow real events, ignore wrong chains, and keep address completion separate', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function showAnalysisOverlay(');
  const end = source.indexOf('  /*', start);
  const element = () => ({ ...uiElement(), isConnected: true, classList: { add() {} } });
  const root = element();
  const context = {
    document: { createElement: element, documentElement: root }, window: { location: { hostname: 'dapp.example' } },
    IDS: { analysis: 'analysis' }, parseNumericChainId: Number,
    removeNalarElement() {}, applyOverlayStyle() {}, createModal: element, createBrandEyebrow: element,
    formatAddress: (value) => `${value.slice(0, 6)}…${value.slice(-4)}`,
    linkifyAddresses: (node, chainId) => {
      assert.equal(chainId, 56);
      node.textContent = node.textContent.replace(/0x[a-fA-F0-9]{40}/g, (value) => `${value.slice(0, 6)}…${value.slice(-4)} ↗`);
    },
    dismissNalarElement() {},
  };
  vm.runInNewContext(`${file('config.js')}\n${source.slice(start, end)};this.show = showAnalysisOverlay`, context);
  const loading = context.show(56);
  const modal = root.children[0].children[0];
  const steps = modal.children[5];
  const [intent, decode] = steps.children;
  assert.equal(steps.hidden, true);
  loading.updateProgress({ stage: 'intent', status: 'completed', chainId: 56 });
  loading.updateProgress({ stage: 'intent', status: 'running', chainId: 97 });
  assert.equal(steps.hidden, true);
  loading.updateProgress({ stage: 'intent', status: 'running', chainId: 56 });
  assert.equal(steps.hidden, false);
  assert.equal(intent.children[2].textContent, 'In progress');
  assert.equal(decode.children[2].textContent, 'Waiting');
  loading.updateProgress({ stage: 'intent', status: 'completed', chainId: 56 });
  loading.updateProgress({ stage: 'intent', status: 'running', chainId: 56 });
  assert.equal(intent.children[0].textContent, '✓');
  assert.equal(intent.children[2].textContent, 'Completed');
  loading.updateProgress({ stage: 'scam', status: 'running', chainId: 56 });
  loading.updateProgress({ stage: 'scam', status: 'completed', chainId: 56, address: `0x${'a'.repeat(40)}` });
  assert.match(modal.children[4].textContent, /Checked.*0xaaaa…aaaa/);
  const scam = steps.children[6];
  assert.equal(scam.children[2].textContent, 'In progress');
  loading.updateProgress({ stage: 'scam', status: 'unavailable', chainId: 56 });
  assert.equal(scam.children[2].textContent, 'Unavailable');
  assert.doesNotMatch(uiText(modal), /100%|Passed|SAFE|ALLOW/);
});

test('AI provenance labels apply to AI wording, not deterministic findings or replaced reasons', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createWhyStoppedCard(');
  const end = source.indexOf('  function createIntentVsActualComparison(', start);
  const context = { document: { createElement: uiElement }, UI: {},
    createLabel: (text) => ({ ...uiElement(), textContent: text }), getPrimaryRootCause: (explanation) => explanation.whyStopped.primaryReason,
  };
  vm.runInNewContext(`${source.slice(start, end)};this.why = createWhyStoppedCard`, context);
  const explanation = { meta: { generator: 'AI' }, whyStopped: { primaryReason: 'The requested action differs.', userImpact: 'This grants permission, not a swap.' } };
  const ai = context.why(explanation, {}, 'BLOCK');
  assert.equal(ai.children[0].children[0].textContent, '[AI]');
  assert.equal(ai.children[2].children[0].textContent, '[AI]');
  assert.match(ai.children[0].children[0].title, /verdict comes from deterministic rules/);
  assert.doesNotMatch(uiText(context.why({ ...explanation, meta: { generator: 'DETERMINISTIC' } }, {}, 'BLOCK')), /\[AI\]/);
  context.getPrimaryRootCause = () => 'Observed configured sellTax = 9800.';
  assert.equal(context.why(explanation, {}, 'BLOCK').children[0].children.length, 0);
});

test('overlays share the existing theme preference without changing the DApp theme', async () => {
  const attributes = { 'data-theme': 'host-theme' };
  let onChanged;
  const document = { documentElement: { setAttribute: (key, value) => { attributes[key] = value; } }, addEventListener() {} };
  const context = {
    document, console, window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    chrome: { storage: {
      local: { get: async () => ({ nalarTheme: 'light' }) },
      onChanged: { addListener: (listener) => { onChanged = listener; } },
    }, runtime: { onMessage: { addListener() {} } } },
  };
  vm.runInNewContext(file('bridge.js'), context);
  await new Promise(setImmediate);
  assert.equal(attributes['data-nalar-theme'], 'light');
  onChanged({ nalarTheme: { newValue: 'dark' } }, 'local');
  assert.equal(attributes['data-nalar-theme'], 'dark');
  onChanged({ nalarTheme: { newValue: 'invalid' } }, 'local');
  assert.equal(attributes['data-nalar-theme'], 'dark');
  assert.equal(attributes['data-theme'], 'host-theme');
});

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
  assert.equal(unsupported.elements.networkErrorTitle.textContent, 'Network not supported');

  const unavailable = openPopup({ selectedNetwork: 56 }, null);
  await new Promise(setImmediate);
  assert.equal(unavailable.elements.networkErrorTitle.textContent, 'Wallet not detected');
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
  const progress = [];
  let decision;
  let failure;
  const window = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    postMessage(message) {
      if (message.type !== 'TX_REQUEST') return;
      queueMicrotask(() => {
        for (const [id, chainId] of [[message.id + 1, 56], [message.id, 97], [message.id, 56]]) {
          for (const listener of listeners) listener({ source: window, data: {
            source: 'NALAR_EXTENSION', type: 'TX_PROGRESS', id, chainId, progress: { stage: 'decode', status: 'running', chainId },
          } });
        }
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
    showAnalysisOverlay: () => ({ remove() {}, updateProgress: (event) => progress.push(event) }),
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
  assert.equal(progress.length, 1, 'Progress from another request or chain must be ignored');
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
  const tax = context.getPrimaryRootCause({}, { scamAnalyses: [{ findings: [{ code: 'EXCESSIVE_SELL_TAX', severity: 'CRITICAL', title: 'The token reports a configured 98% sell tax.' }], contractPrivileges: { state: [{ code: 'CURRENT_SELL_TAX', value: '9800', unit: 'BPS', status: 'KNOWN' }] } }] }, 'BLOCK');
  assert.match(tax, /configured 98% sell tax/);
  assert.doesNotMatch(tax, /charges|preventing you/);
  const unverifiedUnit = context.getPrimaryRootCause({}, { scamAnalyses: [{ contractPrivileges: { state: [{ code: 'CURRENT_SELL_TAX', value: '9800' }] } }] }, 'REVIEW');
  assert.doesNotMatch(unverifiedUnit, /98%|tax|configured/);
});

test('security evidence renders normalized findings without raw MCP observations', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createEvidenceSection(');
  const end = source.indexOf('  function createDecisionFooter(', start);
  const document = { createElement: (tag) => ({ tag, children: [], style: {}, attributes: {}, textContent: '',
    appendChild(child) { this.children.push(child); },
    addEventListener() {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }) };
  const context = { document, UI: { border: '#1E293B', surface: '#101A2E', muted: '#94A3B8', text: '#FFFFFF', soft: '#CBD5E1' }, window: {},
    humanizeEvidenceLabel: (value) => value, riskColor: () => '#FFFFFF', getChainName: () => 'BNB TESTNET', humanizeAction: (value) => value };
  vm.runInNewContext(`${source.slice(start, end)};this.createEvidenceSection = createEvidenceSection;this.createTechnicalSection = createTechnicalSection`, context);
  const raw = JSON.stringify({ isContract: true, transactionHashes: ['0xdeadbeef'], gasUsed: 21000, timestamp: 123456 });
  const target = `0x${'a'.repeat(40)}`;
  const spender = `0x${'b'.repeat(40)}`;
  const security = {
    transactionSummary: { target }, actual: { action: 'TOKEN_APPROVAL', functionName: 'approve', selector: '0x095ea7b3' },
    effects: { approvals: [{ spender }] }, simulation: { success: true },
    bnbIntelligence: { observations: [{ type: 'TARGET_CONTRACT', value: raw }, { type: 'LATEST_BLOCK', value: raw }] },
  };
  const rendered = context.createEvidenceSection({ evidence: [{ label: 'Intent check', value: 'Mismatch', source: 'INTENT' }] }, security);
  const allText = (node) => [node.textContent, ...node.children.map(allText)].join(' ');
  assert.match(allText(rendered), /Security evidence \(1 item\)/);
  assert.match(allText(rendered), /Intent check.*Mismatch/s);
  assert.doesNotMatch(allText(rendered), /BNB MCP|transactionHashes|gasUsed|timestamp|Latest Block|Target Contract/);
  const findingsOnly = context.createEvidenceSection({}, { ...security, transactionThreats: [{ title: 'Unidentified contract call' }] });
  assert.match(allText(findingsOnly), /Security evidence \(1 item\).*Unidentified contract call/s);
  assert.doesNotMatch(allText(findingsOnly), /BNB MCP|transactionHashes|gasUsed|timestamp/);
  const rawOnly = context.createEvidenceSection({}, { bnbIntelligence: security.bnbIntelligence });
  assert.match(allText(rawOnly), /Security evidence \(unavailable\)/);
  assert.doesNotMatch(allText(rawOnly), /transactionHashes|gasUsed|timestamp/);
  const technical = context.createTechnicalSection({}, security, 97);
  assert.match(allText(technical), /Target address.*0x[a]{40}/s);
  assert.match(allText(technical), /Spender \/ operator.*0x[b]{40}/s);
  assert.match(allText(technical), /Selector.*0x095ea7b3/s);
  assert.match(allText(technical), /BNB MCP status.*Unavailable/s);
  assert.doesNotMatch(allText(technical), /transactionHashes|gasUsed|timestamp/);
  const longValue = 'x'.repeat(100);
  const truncated = context.createTechnicalSection({}, { ...security, actual: { ...security.actual, functionName: longValue } }, 97);
  assert.doesNotMatch(allText(truncated), new RegExp(longValue));
  assert.ok(truncated.children[1].children.some((row) => row.children[1]?.title === longValue));
});

test('evidence ledger distinguishes supported categories and keeps all normalized findings', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createEvidenceSection(');
  const end = source.indexOf('  function createTechnicalSection(', start);
  const context = { document: { createElement: uiElement }, UI: {}, window: {}, riskColor: () => 'inherit' };
  vm.runInNewContext(`${source.slice(start, end)};this.evidence = createEvidenceSection;this.kind = evidenceKind`, context);
  for (const [item, category] of [
    [{ source: 'SIMULATION' }, 'Simulation'], [{ source: 'ABI' }, 'Contract analysis'],
    [{ source: 'ONCHAIN' }, 'On-chain evidence'], [{ source: 'ADDRESS_HISTORY' }, 'Address history'],
    [{ source: 'CONTRACT', code: 'UNLIMITED_ALLOWANCE' }, 'Token approval'],
    [{}, 'Security finding'], [{ source: 'REPUTATION' }, 'Reputation'],
  ]) assert.equal(context.kind(item), category);
  const evidence = context.evidence({ evidence: [{ label: 'Simulation', value: 'Passed', source: 'SIMULATION' }] }, {
    transactionThreats: [{ code: 'UNLIMITED_ALLOWANCE', title: 'Unlimited allowance', source: 'CONTRACT', description: 'Existing finding description.' }],
    scamAnalyses: [{ token: '0xabc', findings: [{ code: 'MINT_CAPABILITY', title: 'Mint capability', source: 'ABI' }] }],
  });
  assert.match(uiText(evidence), /Security evidence \(3 items\)/);
  assert.match(uiText(evidence), /Simulation.*Passed.*Mint capability.*Unlimited allowance.*Existing finding description/s);
  assert.doesNotMatch(uiText(evidence), /UNKNOWN · 0/);
  assert.equal(evidence.open, undefined, 'Evidence stays collapsed initially');
  const empty = context.evidence({}, { scamAnalyses: [{ token: 'metadata-only-token', riskScore: 12, findings: [] }] });
  assert.match(uiText(empty), /unavailable/);
  assert.doesNotMatch(uiText(empty), /metadata-only-token/);
});

test('evidence groups findings and roles by the current address without mixing them', () => {
  const source = file('injected.js');
  const start = source.indexOf('  function createEvidenceSection(');
  const end = source.indexOf('  function createTechnicalSection(', start);
  const context = { document: { createElement: uiElement }, UI: {}, riskColor: () => 'inherit' };
  vm.runInNewContext(`${source.slice(start, end)};this.evidence = createEvidenceSection`, context);
  const token = `0x${'a'.repeat(40)}`, spender = `0x${'b'.repeat(40)}`;
  const result = context.evidence({}, { transactionSummary: { target: token }, effects: { approvals: [{ token, spender }] },
    scamAnalyses: [
      { token, riskLevel: 'CRITICAL', riskScore: 95, findings: [{ code: 'EXCESSIVE_SELL_TAX', title: 'Configured tax finding', source: 'ONCHAIN' }] },
      { token: spender, contract: { verified: true }, riskLevel: 'LOW', riskScore: 0, findings: [] },
    ],
    bnbIntelligence: { observations: [{ type: 'LATEST_BLOCK', value: '{"transactionHashes":["secret"]}' }] },
  });
  const groups = result.children[1].children.filter((node) => node.className === 'nalar-address-evidence');
  assert.equal(groups.length, 2);
  assert.match(uiText(groups[0]), /Transaction contract · Approval asset.*Configured tax finding/s);
  assert.doesNotMatch(uiText(groups[0]), /Spender \/ operator/);
  assert.match(uiText(groups[1]), /Spender \/ operator.*not a safety guarantee/s);
  assert.doesNotMatch(uiText(groups[1]), /Configured tax finding/);
  assert.doesNotMatch(uiText(result), /secret|transactionHashes|\[AI\]/);
});
