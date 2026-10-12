import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';

// Exercise real service code with isolated browser and Google API responses.
const source = fs.readFileSync(new URL('../src/services/googleAuthService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function setup({ wrongState = false, lookupStatus = 200, lookupReason, cachedUser } = {}) {
  const values = new Map(cachedUser ? [['ntab_google_user', JSON.stringify(cachedUser)]] : []);
  const requests = [];
  const exports = {};
  const context = {
    exports, URL, URLSearchParams, Date, crypto: { randomUUID }, window: {},
    location: { protocol: 'chrome-extension:' },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key),
    },
    require(name) {
      if (name === 'vue') return { ref: value => ({ value }) };
      if (name === '../locales') return { t: key => key };
      if (name === './storage') return {
        buildAdaptiveExportData: () => ({ version: 2, settings: {}, layout: [] }),
        resolveAdaptiveImportData: () => ({ settings: {}, columns: [] }),
        saveSettings() {}, saveColumnLayout() {},
      };
      throw new Error(`Unexpected import: ${name}`);
    },
    chrome: {
      runtime: {},
      identity: {
        getRedirectURL: () => 'https://test-extension.chromiumapp.org/',
        launchWebAuthFlow({ url }, callback) {
          const request = new URL(url);
          assert.ok(request.searchParams.get('state'));
          const fragment = new URLSearchParams({
            access_token: 'test-token', expires_in: '3600',
            state: wrongState ? 'incorrect-state' : request.searchParams.get('state'),
          });
          callback(`${request.searchParams.get('redirect_uri')}#${fragment}`);
        },
      },
    },
    async fetch(url, options) {
      requests.push({ url, options });
      if (url.includes('/userinfo')) return {
        ok: true, json: async () => ({ sub: 'test-id', email: 'test@example.com', name: 'Test' }),
      };
      if (url.includes('/upload/')) return { ok: true };
      return { ok: lookupStatus === 200, status: lookupStatus, json: async () => lookupReason
        ? { error: { errors: [{ reason: lookupReason }], message: 'Request had insufficient authentication scopes.' } }
        : { files: [] } };
    },
  };
  vm.runInNewContext(compiled, context);
  return { service: exports, requests, values };
}

{
  const { service, requests } = setup();
  assert.equal((await service.loginWithGoogle()).success, true);
  assert.equal(requests.filter(r => r.url.includes('/upload/')).length, 1,
    'First login without a remote backup must create one');
}
{
  const { service, requests } = setup({ wrongState: true });
  assert.equal((await service.loginWithGoogle()).success, false);
  assert.equal(requests.length, 0, 'Unverified callbacks must not fetch a profile or Drive data');
  assert.equal(service.currentGoogleUser.value, null);
}
for (const lookupStatus of [403, 500]) {
  const { service, requests } = setup({ lookupStatus });
  assert.equal((await service.loginWithGoogle()).success, true);
  assert.equal(requests.filter(r => r.url.includes('/upload/')).length, 0,
    'A failed Drive lookup must not be treated as a missing backup');
  assert.match(service.syncStatusMessage.value, new RegExp(`auth.restoreFailed: Google Drive \\(${lookupStatus}\\)`));
}
{
  const { service, requests } = setup({ lookupStatus: 403, lookupReason: 'insufficientPermissions' });
  assert.equal((await service.loginWithGoogle()).success, true);
  assert.equal(service.syncStatusMessage.value, 'auth.restoreFailed: auth.drivePermissionRequired');
  assert.equal((await service.backupToGoogleCloud()).success, false);
  assert.equal(service.syncStatusMessage.value, 'auth.backupFailed: auth.drivePermissionRequired');
  assert.equal(requests.filter(r => r.url.includes('/upload/')).length, 0);
}
{
  const { service, requests } = setup();
  service.currentGoogleUser.value = { email: 'test@example.com', accessToken: 'old', expiresAt: Date.now() - 1 };
  assert.equal((await service.backupToGoogleCloud()).success, false);
  assert.equal(service.currentGoogleUser.value, null);
  assert.equal(requests.length, 0, 'Expired sessions must require sign-in before uploading');
  service.currentGoogleUser.value = { email: 'test@example.com', accessToken: 'old', expiresAt: Date.now() - 1 };
  assert.equal((await service.restoreFromGoogleCloud()).success, false);
  assert.equal(requests.length, 0);
}
{
  const { service, values } = setup({ cachedUser: { email: 'test@example.com', expiresAt: Date.now() - 1 } });
  assert.equal(service.currentGoogleUser.value, null);
  assert.equal(values.has('ntab_google_user'), false);
}
console.log('Google auth checks passed: first backup, callback state, Drive 403/500, expired sessions, expired cache.');
