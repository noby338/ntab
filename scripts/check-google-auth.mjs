import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as vue from 'vue';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/services/googleAuthService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const clone = data => JSON.parse(JSON.stringify(data));
const payload = theme => ({ version: 2, exportedAt: '2026-10-14T00:00:00Z', settings: { theme, horizontalWhitespace: 30 }, layout: [['1'], ['2']] });

function setup({ wrongState = false, lookupStatus = 200, lookupReason, cachedUser, remote, shared } = {}) {
  const state = shared || { values: new Map(cachedUser ? [['ntab_google_user', JSON.stringify(cachedUser)]] : []), requests: [], files: new Map(), locks: new Map(), counter: { order: 0 } };
  const { values, requests, files, locks, counter } = state;
  const applied = [];
  const exports = {};
  const settings = vue.ref(clone(payload('system').settings)), columns = vue.ref([['1'], ['2']]);
  function addRemote(data, id = `file-${++counter.order}`, version = '1') {
    files.set(id, { id, version, modifiedTime: new Date(Date.UTC(2026, 9, 14, 0, 0, ++counter.order)).toISOString(), data: clone(data) });
    return files.get(id);
  }
  if (remote) addRemote(remote, 'existing');
  let uploadFailure = false, afterUpload = null;
  const timers = new Map(), intervals = new Map(); let timerId = 0;
  const listeners = new Map();
  const context = {
    exports, URL, URLSearchParams, Date, crypto: { randomUUID },
    navigator: { locks: { request(name, callback) {
      const previous = locks.get(name) || Promise.resolve();
      const result = previous.catch(() => {}).then(callback);
      locks.set(name, result);
      return result;
    } } },
    window: { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); } },
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn, ms) { intervals.set(++timerId, { fn, ms }); return timerId; }, clearInterval(id) { intervals.delete(id); },
    location: { protocol: 'chrome-extension:' },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
    require(name) {
      if (name === 'vue') return vue;
      if (name === '../locales') return { t: key => key };
      if (name === './storage') return {
        userSettings: settings, columnLayout: vue.computed({ get: () => ({ columns: columns.value }), set: value => { columns.value = clone(value.columns); } }),
        DEFAULT_SETTINGS: clone(payload('system').settings), applySettingsToDOM() {},
        buildAdaptiveExportData: () => ({ version: 2, exportedAt: new Date().toISOString(), settings: clone(settings.value), layout: clone(columns.value) }),
        resolveAdaptiveImportData: data => ({ settings: clone(data.settings), columns: clone(data.layout) }),
        async applyConfiguration(data, layout) { applied.push('settings', 'columns'); settings.value = clone(data); columns.value = clone(layout); },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
    chrome: { runtime: {}, identity: {
      getRedirectURL: () => 'https://test-extension.chromiumapp.org/',
      launchWebAuthFlow({ url }, callback) {
        const request = new URL(url);
        assert.ok(request.searchParams.get('state'));
        callback(`${request.searchParams.get('redirect_uri')}#${new URLSearchParams({ access_token: 'test-token', expires_in: '3600', state: wrongState ? 'incorrect-state' : request.searchParams.get('state') })}`);
      },
    } },
    async fetch(url, options) {
      requests.push({ url, options });
      if (url.includes('/userinfo')) return { ok: true, json: async () => ({ sub: 'test-id', email: 'test@example.com', name: 'Test' }) };
      if (url.includes('/upload/')) {
        if (uploadFailure) throw new Error('offline');
        assert.equal(options.method, 'POST', 'Cloud history must be immutable, never PATCH old data');
        const data = JSON.parse(options.body.split('Content-Type: application/json\r\n\r\n')[1].split('\r\n--')[0]);
        const file = addRemote(data);
        if (afterUpload) afterUpload();
        return { ok: true, json: async () => ({ id: file.id, version: file.version, modifiedTime: file.modifiedTime }) };
      }
      if (url.includes('?alt=media')) {
        const id = url.split('/files/')[1].split('?')[0];
        return { ok: files.has(id), json: async () => clone(files.get(id)?.data) };
      }
      return { ok: lookupStatus === 200, status: lookupStatus, json: async () => lookupReason
        ? { error: { errors: [{ reason: lookupReason }], message: 'Insufficient authentication scopes.' } }
        : { files: Array.from(files.values()).map(({ data, ...metadata }) => metadata).reverse() } };
    },
  };
  vm.runInNewContext(compiled, context);
  const uploadCount = () => requests.filter(r => r.url.includes('/upload/')).length;
  const flush = async () => { await vue.nextTick(); for (let i = 0; i < 60; i++) await Promise.resolve(); };
  const advance = async () => { const callbacks = [...timers.values()]; timers.clear(); for (const { fn } of callbacks) fn(); await flush(); };
  return { shared: state, service: exports, requests, values, applied, settings, columns, files, timers, listeners, addRemote, uploadCount, flush, advance,
    failUploads: () => { uploadFailure = true; }, concurrentUpload: fn => { afterUpload = fn; } };
}

{
  const h = setup();
  assert.equal((await h.service.loginWithGoogle()).success, true);
  assert.equal(h.uploadCount(), 0, 'Login must not create a backup implicitly');
  assert.equal(h.applied.length, 0, 'Login must never restore implicitly');
  assert.equal(h.service.automaticBackupEnabled.value, false);
  assert.equal((await h.service.backupToGoogleCloud()).success, true);
  assert.equal(h.uploadCount(), 1);
  assert.ok(h.service.lastBackupTime.value);
}
{
  const h = setup({ remote: payload('cream') });
  await h.service.loginWithGoogle();
  assert.equal(h.settings.value.theme, 'system');
  assert.equal(h.service.cloudDecisionRequired.value, true);
  assert.equal(h.uploadCount(), 0);
  assert.equal((await h.service.backupToGoogleCloud()).code, 'conflict');
  assert.equal((await h.service.restoreFromGoogleCloud()).success, false, 'Restore requires a confirmed version');
  const confirmed = h.service.remoteBackup.value.revision;
  assert.equal((await h.service.restoreFromGoogleCloud(confirmed)).success, true);
  assert.equal(h.settings.value.theme, 'cream');
  assert.equal(h.service.canUndoCloudRestore.value, true);
  assert.ok(h.service.lastRestoreTime.value);
  assert.equal((await h.service.undoCloudRestore()).success, true);
  assert.equal(h.settings.value.theme, 'system');
  assert.equal(h.service.automaticBackupEnabled.value, false);
  assert.equal(h.uploadCount(), 0, 'Undo changes local configuration only');
}
{
  const h = setup({ remote: payload('cream') });
  await h.service.loginWithGoogle();
  const confirmed = h.service.remoteBackup.value.revision;
  h.addRemote(payload('dark'));
  assert.equal((await h.service.restoreFromGoogleCloud(confirmed)).code, 'conflict');
  assert.equal(h.settings.value.theme, 'system', 'Cloud changes during confirmation must not be applied');
  assert.equal((await h.service.backupToGoogleCloud({ confirmedRevision: confirmed })).code, 'conflict');
  assert.equal(h.uploadCount(), 0, 'Stale confirmation must not supersede another device');
}
{
  const h = setup();
  await h.service.loginWithGoogle();
  const stop = h.service.startCloudBackupController(); await h.flush();
  await h.service.setAutomaticBackup(true);
  h.settings.value.theme = 'cream'; await h.flush();
  h.settings.value.theme = 'dark'; await h.flush();
  assert.equal(h.uploadCount(), 0);
  assert.equal(h.timers.size, 1, 'Changes must debounce to one 10-second upload');
  assert.equal([...h.timers.values()][0].ms, 10000);
  await h.advance();
  assert.equal(h.uploadCount(), 1);
  assert.equal([...h.files.values()][0].data.settings.theme, 'dark');
  h.addRemote(payload('nord'));
  h.settings.value.theme = 'light'; await h.flush(); await h.advance();
  assert.equal(h.uploadCount(), 1, 'Another device update pauses automatic upload');
  assert.equal(h.service.cloudDecisionRequired.value, true);
  assert.equal(h.settings.value.theme, 'light');
  stop();
}
{
  const h = setup(); await h.service.loginWithGoogle();
  const stop = h.service.startCloudBackupController(); await h.flush();
  await h.service.setAutomaticBackup(true);
  await h.advance();
  const confirmed = h.service.remoteBackup.value.revision;
  h.settings.value.theme = 'cream'; await h.flush();
  await h.service.restoreFromGoogleCloud(confirmed); await h.flush();
  assert.equal(h.timers.size, 0, 'Restore must not trigger an automatic upload');
  assert.equal(h.settings.value.theme, 'system');
  stop();
}
{
  const h = setup(); await h.service.loginWithGoogle();
  const stop = h.service.startCloudBackupController(); await h.flush();
  await h.service.setAutomaticBackup(true);
  h.failUploads(); await h.advance();
  assert.equal(h.service.hasUnbackedChanges.value, true);
  assert.equal(h.timers.size, 0, 'Network errors must not create a tight retry loop');
  assert.ok(h.values.get('ntab_pending_backup:test-id'));
  h.service.currentGoogleUser.value.expiresAt = Date.now() - 1;
  assert.equal((await h.service.backupToGoogleCloud()).success, false);
  assert.equal(h.service.currentGoogleUser.value, null);
  stop();
}
{
  const h = setup(); await h.service.loginWithGoogle();
  h.concurrentUpload(() => h.addRemote(payload('nord')));
  assert.equal((await h.service.backupToGoogleCloud()).code, 'conflict');
  assert.equal(h.files.size, 2, 'Simultaneous uploads preserve both versions');
  assert.equal(h.settings.value.theme, 'system');
}
{
  const h = setup({ wrongState: true });
  assert.equal((await h.service.loginWithGoogle()).success, false);
  assert.equal(h.requests.length, 0);
}
for (const lookupStatus of [403, 500]) {
  const h = setup({ lookupStatus });
  assert.equal((await h.service.loginWithGoogle()).success, true);
  assert.equal(h.uploadCount(), 0);
  assert.equal(h.applied.length, 0);
  assert.equal(h.service.cloudCheckComplete.value, false);
  assert.match(h.service.syncStatusMessage.value, new RegExp(`auth.checkFailed: Google Drive \\(${lookupStatus}\\)`));
}
{
  const h = setup({ lookupStatus: 403, lookupReason: 'insufficientPermissions' });
  await h.service.loginWithGoogle();
  assert.equal(h.service.syncStatusMessage.value, 'auth.checkFailed: auth.drivePermissionRequired');
  assert.equal((await h.service.backupToGoogleCloud()).success, false);
  assert.equal(h.uploadCount(), 0);
}
{
  const h = setup({ remote: { settings: { theme: 'dark' }, layout: 'bad' } });
  await h.service.loginWithGoogle();
  assert.equal(h.applied.length, 0);
  assert.match(h.service.syncStatusMessage.value, /invalidCloudConfig/);
}
{
  const h = setup({ cachedUser: { email: 'test@example.com', expiresAt: Date.now() - 1 } });
  assert.equal(h.service.currentGoogleUser.value, null);
  assert.equal(h.values.has('ntab_google_user'), false);
}
{
  const first = setup(); await first.service.loginWithGoogle();
  const stop1 = first.service.startCloudBackupController(); await first.flush();
  await first.service.setAutomaticBackup(true);
  first.settings.value.theme = 'cream'; await first.flush();
  const second = setup({ shared: first.shared });
  const stop2 = second.service.startCloudBackupController(); await second.flush();
  await Promise.all([first.advance(), second.advance()]);
  assert.equal(first.uploadCount(), 1, 'Two tabs must coordinate one upload, not publish stale tab settings');
  assert.equal([...first.files.values()][0].data.settings.theme, 'cream');
  assert.equal((await second.service.backupToGoogleCloud({ automatic: true })).success, true);
  assert.equal(first.uploadCount(), 1, 'Shared baseline prevents a duplicate automatic backup');
  stop1(); stop2();
}
{
  const h = setup(); await h.service.loginWithGoogle();
  await h.service.setAutomaticBackup(true);
  const other = { id: 'other-id', email: 'other@example.com', name: 'Other', accessToken: 'other-token', expiresAt: Date.now() + 3600000 };
  h.values.set('ntab_google_user', JSON.stringify(other));
  h.service.currentGoogleUser.value = other;
  const stop = h.service.startCloudBackupController(); await h.flush();
  assert.equal(h.service.automaticBackupEnabled.value, false, 'Automatic consent must not transfer between accounts');
  assert.equal(h.timers.size, 0);
  stop();
}
{
  const h = setup(); await h.service.loginWithGoogle();
  const stop = h.service.startCloudBackupController(); await h.flush();
  await h.service.setAutomaticBackup(true); await h.advance();
  h.settings.value.theme = 'cream'; await h.flush();
  h.service.currentGoogleUser.value.expiresAt = Date.now() - 1;
  assert.equal((await h.service.backupToGoogleCloud()).success, false);
  h.settings.value.theme = 'light'; await h.flush();
  await h.service.loginWithGoogle(); await h.advance();
  const latest = [...h.files.values()].at(-1);
  assert.equal(latest.data.settings.theme, 'light', 'Re-login must preserve and resume edits made after expiry');
  stop();
}
console.log('Google backup checks passed: safe login, confirmation, undo, debounce, remote conflicts, immutable history, expiry, offline edits and invalid data.');
