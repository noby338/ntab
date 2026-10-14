import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as vue from 'vue';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/services/storage.ts', import.meta.url), 'utf8');
const exports = {}, writes = [], values = new Map(), timers = new Map();
let fail = false, id = 0;
const clone = value => JSON.parse(JSON.stringify(value));
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports, console: { error() {}, warn() {} },
  require(name) {
    if (name === 'vue') return vue;
    if (name === './bookmarks') return { folderMap: vue.ref(new Map()), getFolderPath: () => '', findFolderByPathOrTitle: () => null };
    throw new Error(name);
  },
  localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
  chrome: { storage: { sync: { async set(data) { if (fail) throw new Error('storage unavailable'); writes.push(clone(data)); } } } },
  setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(key) { timers.delete(key); },
});
const oldSettings = clone(exports.DEFAULT_SETTINGS);
exports.columnLayout.value = { columns: [['1'], ['2']] };
const nextSettings = { ...oldSettings, theme: 'cream' };
fail = true;
await assert.rejects(exports.applyConfiguration(nextSettings, [['2']]), /storage unavailable/);
assert.equal(exports.userSettings.value.theme, 'system');
assert.deepEqual(clone(exports.columnLayout.value.columns), [['1'], ['2']]);
assert.equal(writes.length, 0, 'Failed restore must not persist either half');
fail = false;
await exports.saveSettings({ theme: 'dark' });
assert.equal(timers.size, 1);
await exports.applyConfiguration(nextSettings, [['2'], []]);
assert.equal(timers.size, 0, 'Restore must cancel the delayed old settings write');
assert.equal(writes.length, 1);
assert.deepEqual(writes[0].ntab_columns, [['2']]);
assert.equal(writes[0].ntab_settings.theme, 'cream');
assert.deepEqual(JSON.parse(values.get('ntab_columns')), [['2']]);
console.log('Configuration storage checks passed: atomic persistence, failed-restore protection and delayed-write cancellation.');
