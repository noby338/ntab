import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/services/columnLayoutMovement.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, Set });
const move = (...args) => {
  const result = exports.moveLayoutCard(...args);
  return result === null ? null : JSON.parse(JSON.stringify(result));
};
// Regression: splitting a card creates a fifth occupied column without losing it.
const four = [['a', 'b'], ['c'], ['d'], ['e']];
assert.deepEqual(move(four, four, 'b', { type: 'column_slot', slotIndex: 4 }), [['a'], ['c'], ['d'], ['e'], ['b']]);
assert.deepEqual(four, [['a', 'b'], ['c'], ['d'], ['e']]);
// Moving the sole card creates no empty column, including when targeting itself.
assert.deepEqual(move(four, four, 'c', { type: 'column_slot', slotIndex: 4 }), [['a', 'b'], ['d'], ['e'], ['c']]);
assert.deepEqual(move(four, four, 'c', { type: 'card_slot', colIndex: 1, slotIndex: 1 }), four);
// Resolve destination before removing its first card; reorder within one column.
assert.deepEqual(move([['a','b','c']], [['a','b','c']], 'a', { type: 'card_slot', colIndex: 0, slotIndex: 2 }), [['b','a','c']]);
// Hidden columns/cards must not shift the visible drop destination or be deleted.
const hidden = [['hidden'], ['a','hidden2','b'], ['c']];
assert.deepEqual(move(hidden, [['a','b'], ['c']], 'b', { type: 'column_slot', slotIndex: 1 }), [['hidden'], ['a','hidden2'], ['b'], ['c']]);
assert.deepEqual(move(hidden, [['a','b'], ['c']], 'a', { type: 'card_slot', colIndex: 0, slotIndex: 1 }), [['hidden'], ['hidden2','a','b'], ['c']]);
const ten = Array.from({length:10}, (_,i) => [String(i)]);
ten[0].push('extra');
assert.equal(move(ten, ten, 'extra', { type: 'column_slot', slotIndex: 10 }), null);
assert.equal(ten[0].at(-1), 'extra');
assert.equal(move(ten, ten, '1', { type: 'column_slot', slotIndex: 10 }).length, 10);
assert.equal(move(ten, ten, 'extra', { type: 'card_slot', colIndex: 1, slotIndex: 1 }).length, 10);
assert.equal(move(ten, ten, 'nested', { type: 'column_slot', slotIndex: 10 }), null);
// Existing/imported oversized layouts stay recoverable and can still be rearranged.
const legacy = Array.from({length:11}, (_,i) => [String(i)]);
assert.equal(move(legacy, legacy, '0', { type: 'column_slot', slotIndex: 11 }).length, 11);
console.log('Column movement regression checks passed.');
