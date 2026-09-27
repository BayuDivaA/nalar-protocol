// Run with the extension loaded in Chromium using --remote-debugging-port=9229.
// NALAR_CDP_URL may point to a different local DevTools endpoint.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const endpoint = process.env.NALAR_CDP_URL ?? 'http://127.0.0.1:9229';
const extensionPath = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const extensionId = createHash('sha256').update(extensionPath).digest('hex').slice(0, 32)
  .replace(/./g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
const popupUrl = `chrome-extension://${extensionId}/popup.html`;
const targets = () => fetch(`${endpoint}/json/list`).then((r) => r.json());

async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const result = JSON.parse(event.data);
    pending.get(result.id)?.(result);
    pending.delete(result.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => reject(new Error(`Timed out: ${method}`)), 10000);
    pending.set(id, (response) => {
      clearTimeout(timeout);
      response.error ? reject(new Error(response.error.message)) : resolve(response.result);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => socket.close(), evaluate: async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  } };
}

const tab = await fetch(`${endpoint}/json/new?${popupUrl}`, { method: 'PUT' }).then((r) => r.json());
const controller = await connect(tab);
let popup;
try {
  const previous = new Set((await targets()).map((t) => t.id));
  await controller.evaluate('chrome.action.openPopup()');
  const target = (await targets()).find((t) => t.url === popupUrl && !previous.has(t.id));
  assert.ok(target, 'Chrome must open the actual extension action popup');
  popup = await connect(target);
  const dimensions = await popup.evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
    width: innerWidth, height: innerHeight,
    contentWidth: document.documentElement.scrollWidth,
    shellHeight: document.querySelector('.shell').offsetHeight
  }))))`);
  console.log('Action popup:', dimensions);
  console.log('Current site:', await popup.evaluate('document.getElementById("siteName").textContent'));
  // A short screen can add a native scrollbar beside the 380px content.
  assert.ok(dimensions.width >= 380 && dimensions.width <= 400, 'Popup must grow beyond Chrome’s initial 25px viewport');
  assert.ok(dimensions.height > 400 && dimensions.height <= 600, 'Popup content must establish its own height');
  assert.ok(dimensions.contentWidth <= dimensions.width, 'Popup must not scroll horizontally');
  if (process.env.NALAR_POPUP_SCREENSHOT) {
    const { data } = await popup.send('Page.captureScreenshot');
    writeFileSync(process.env.NALAR_POPUP_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  const footerVisible = await popup.evaluate(`(() => {
    const footer = document.getElementById('themeToggle');
    footer.scrollIntoView();
    const bounds = footer.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  })()`);
  assert.ok(footerVisible, 'Footer actions must remain reachable by scrolling');
  for (const width of [320, 360, 400]) {
    await controller.send('Emulation.setDeviceMetricsOverride', { width, height: 600, deviceScaleFactor: 1, mobile: false });
    const metrics = await controller.evaluate('({width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, body: document.body.offsetWidth})');
    assert.ok(metrics.body > 0 && metrics.body <= metrics.width, `Content must fit at ${width}px`);
    assert.ok(metrics.content <= metrics.width, `No horizontal overflow at ${width}px`);
    console.log(`Layout ${width}px: PASS`);
  }

  const interactions = await popup.evaluate(`(async () => {
    const byId = (id) => document.getElementById(id);
    const settle = () => new Promise(resolve => setTimeout(resolve, 80));
    byId('toggle').click();
    await settle();
    const paused = byId('systemStatus').textContent;
    byId('toggle').click();
    await settle();
    const active = byId('systemStatus').textContent;
    const themeBefore = document.documentElement.getAttribute('data-theme');
    byId('themeToggle').click();
    await settle();
    const themeAfter = document.documentElement.getAttribute('data-theme');
    byId('themeToggle').click();
    byId('intent').value = 'Mint one NFT';
    byId('save').click();
    await settle();
    const saved = byId('message').textContent;
    byId('clearIntent').click();
    await settle();
    const cleared = byId('message').textContent;
    byId('networkRetry').click();
    await settle();
    const retryError = byId('networkErrorTitle').textContent;
    byId('networkTestnet').click();
    await settle();
    const testnetError = byId('networkErrorTitle').textContent;
    byId('networkSelect').value = '56';
    byId('networkSelect').dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    return { paused, active, themeBefore, themeAfter, saved, cleared,
      retryError, testnetError, selected: byId('networkSelect').value,
      networkError: byId('networkErrorTitle').textContent };
  })()`);
  assert.equal(interactions.paused, 'PAUSED');
  assert.equal(interactions.active, 'ACTIVE');
  assert.notEqual(interactions.themeBefore, interactions.themeAfter);
  assert.match(interactions.saved, /saved/i);
  assert.match(interactions.cleared, /removed/i);
  assert.equal(interactions.retryError, 'NETWORK CONNECTION FAILED');
  assert.equal(interactions.testnetError, 'NETWORK CONNECTION FAILED');
  assert.equal(interactions.selected, '97');
  assert.equal(interactions.networkError, 'NETWORK CONNECTION FAILED');
  console.log('Popup controls: status, theme, save/clear intent, retry, Testnet fallback, Mainnet failure: PASS');
} finally {
  if (popup) { await popup.evaluate('window.close()').catch(() => {}); popup.close(); }
  await controller.send('Target.closeTarget', { targetId: tab.id });
  controller.close();
}
