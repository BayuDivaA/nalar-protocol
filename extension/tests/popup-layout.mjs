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
  await popup.evaluate('new Promise(resolve => setTimeout(resolve, 500))');
  const dimensions = await popup.evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
    width: innerWidth, height: innerHeight,
    contentWidth: document.documentElement.scrollWidth,
    contentHeight: document.documentElement.scrollHeight,
    shellHeight: document.querySelector('.shell').offsetHeight
  }))))`);
  console.log('Action popup:', dimensions);
  console.log('Current site:', await popup.evaluate('document.getElementById("siteName").textContent'));
  // The action popup must size to its content without a scrollbar.
  assert.ok(dimensions.width >= 380 && dimensions.width <= 400, 'Popup must grow beyond Chrome’s initial 25px viewport');
  assert.ok(dimensions.height > 400 && dimensions.height <= 600, 'Popup content must establish its own height');
  assert.ok(dimensions.contentWidth <= dimensions.width, 'Popup must not scroll horizontally');
  assert.ok(dimensions.contentHeight <= dimensions.height, 'Action popup must not scroll vertically');
  if (process.env.NALAR_POPUP_SCREENSHOT) {
    const { data } = await popup.send('Page.captureScreenshot');
    writeFileSync(process.env.NALAR_POPUP_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  const themeVisible = await popup.evaluate(`(() => {
    const bounds = document.getElementById('themeToggle').getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  })()`);
  assert.ok(themeVisible, 'Theme control must be visible without scrolling');
  assert.equal(await popup.evaluate('document.querySelectorAll("#themeToggle svg").length'), 2, 'Theme updates must preserve the sun and moon icons');
  assert.equal(await popup.evaluate('getComputedStyle(document.querySelector(".security-summary")).display'), 'none', 'Network failure must not repeat the security warning');
  for (const width of [320, 360, 400]) {
    await controller.send('Emulation.setDeviceMetricsOverride', { width, height: 510, deviceScaleFactor: 1, mobile: false });
    const metrics = await controller.evaluate('({width: document.documentElement.clientWidth, content: document.documentElement.scrollWidth, height: document.documentElement.clientHeight, contentHeight: document.documentElement.scrollHeight, body: document.body.offsetWidth})');
    assert.ok(metrics.body > 0 && metrics.body <= metrics.width, `Content must fit at ${width}px`);
    assert.ok(metrics.content <= metrics.width, `No horizontal overflow at ${width}px`);
    assert.ok(metrics.contentHeight <= metrics.height, `No vertical overflow at ${width}px`);
    const feedbackFits = await controller.evaluate(`(() => {
      document.getElementById('message').textContent = 'Intent saved for this site.';
      const fits = document.documentElement.scrollHeight <= innerHeight;
      document.getElementById('message').textContent = '';
      return fits;
    })()`);
    assert.ok(feedbackFits, `Feedback must also fit without scrolling at ${width}px`);
    console.log(`Layout ${width}px: PASS`);
  }
  await controller.send('Emulation.clearDeviceMetricsOverride');

  const key = async (key, code, windowsVirtualKeyCode) => {
    await popup.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(key === ' ' ? { text: ' ' } : {}) });
    await popup.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  };
  await popup.evaluate('document.getElementById("networkSelect").focus()');
  await key(' ', 'Space', 32);
  assert.ok(await popup.evaluate('document.getElementById("networkSelect").matches(":open")'), 'Network picker must open from the keyboard');
  await popup.evaluate('new Promise(resolve => setTimeout(resolve, 180))');
  if (process.env.NALAR_POPUP_PICKER_SCREENSHOT) {
    const { data } = await popup.send('Page.captureScreenshot');
    writeFileSync(process.env.NALAR_POPUP_PICKER_SCREENSHOT, Buffer.from(data, 'base64'));
  }
  await key('Escape', 'Escape', 27);
  assert.equal(await popup.evaluate('document.getElementById("networkSelect").matches(":open")'), false, 'Escape must close the network picker');
  assert.equal(await popup.evaluate('document.getElementById("networkSelect").value'), '97', 'Dismissing the picker must not switch network');

  const interactions = await popup.evaluate(`(async () => {
    const byId = (id) => document.getElementById(id);
    const settle = () => new Promise(resolve => setTimeout(resolve, 300));
    const initialStatus = byId('systemStatus').textContent;
    byId('toggle').click();
    await settle();
    const switchedStatus = byId('systemStatus').textContent;
    byId('toggle').click();
    await settle();
    const restoredStatus = byId('systemStatus').textContent;
    const themeBefore = document.documentElement.getAttribute('data-theme');
    byId('themeToggle').click();
    await settle();
    const themeAfter = document.documentElement.getAttribute('data-theme');
    const alternateThemeFits = document.documentElement.scrollHeight <= innerHeight;
    const alternateThemeSize = { content: document.documentElement.scrollHeight, popup: innerHeight, shell: document.querySelector('.shell').offsetHeight };
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
    return { initialStatus, switchedStatus, restoredStatus, themeBefore, themeAfter, saved, cleared,
      retryError, testnetError, selected: byId('networkSelect').value,
      networkError: byId('networkErrorTitle').textContent,
      alternateThemeFits, alternateThemeSize, finalContentHeight: document.documentElement.scrollHeight, popupHeight: innerHeight };
  })()`);
  assert.ok(['ACTIVE', 'PAUSED'].includes(interactions.initialStatus));
  assert.notEqual(interactions.switchedStatus, interactions.initialStatus);
  assert.equal(interactions.restoredStatus, interactions.initialStatus);
  assert.notEqual(interactions.themeBefore, interactions.themeAfter);
  assert.ok(interactions.alternateThemeFits, `Alternate theme must not scroll vertically: ${JSON.stringify(interactions.alternateThemeSize)}`);
  assert.match(interactions.saved, /saved/i);
  assert.match(interactions.cleared, /removed/i);
  assert.equal(interactions.retryError, 'Wallet not detected');
  assert.equal(interactions.testnetError, 'Wallet not detected');
  assert.equal(interactions.selected, '97');
  assert.equal(interactions.networkError, 'Wallet not detected');
  assert.ok(interactions.finalContentHeight <= interactions.popupHeight, 'Popup must still fit after feedback and network actions');
  assert.equal(await popup.evaluate('document.querySelectorAll("#themeToggle svg").length'), 2, 'Changing theme must not replace icons with text');
  if (process.env.NALAR_POPUP_ALT_SCREENSHOT) {
    await popup.evaluate('document.getElementById("themeToggle").click()');
    await popup.evaluate('new Promise(resolve => setTimeout(resolve, 200))');
    const { data } = await popup.send('Page.captureScreenshot');
    writeFileSync(process.env.NALAR_POPUP_ALT_SCREENSHOT, Buffer.from(data, 'base64'));
    await popup.evaluate('document.getElementById("themeToggle").click()');
  }
  await popup.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const reducedMotion = await popup.evaluate(`(async () => {
    document.getElementById('themeToggle').click();
    document.getElementById('toggle').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      icons: getComputedStyle(document.querySelector('.theme-icon')).transitionDuration,
      status: getComputedStyle(document.querySelector('.status-dot')).transitionDuration,
      picker: getComputedStyle(document.getElementById('networkSelect'), '::picker(select)').transitionDuration,
      animations: document.getAnimations().filter(animation => animation.playState === 'running').length,
      statusText: document.getElementById('systemStatus').textContent,
      theme: document.documentElement.getAttribute('data-theme')
    };
  })()`);
  assert.equal(reducedMotion.icons, '0s');
  assert.equal(reducedMotion.status, '0s');
  assert.equal(reducedMotion.picker, '0s');
  assert.equal(reducedMotion.animations, 0, 'Reduced motion must suppress animations while state still changes');
  assert.equal(reducedMotion.statusText, interactions.switchedStatus);
  assert.equal(reducedMotion.theme, interactions.themeAfter);
  await popup.evaluate('document.getElementById("themeToggle").click(); document.getElementById("toggle").click()');
  console.log('Keyboard picker, persistent theme icons, consolidated error, reduced motion: PASS');
  console.log('Popup controls: status, theme, save/clear intent, retry, Testnet fallback, Mainnet failure: PASS');
} finally {
  if (popup) { await popup.evaluate('window.close()').catch(() => {}); popup.close(); }
  await controller.send('Target.closeTarget', { targetId: tab.id });
  controller.close();
}
