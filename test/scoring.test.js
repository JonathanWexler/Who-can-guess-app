const test = require('node:test');
const assert = require('node:assert/strict');
const { isCorrect, scoreActOff } = require('../src/scoring');

test('number answers must be exact', () => {
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, 57), true);
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, 56), false);
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, null), false);
});

test('the EDGE lets off-by-one count, but no more', () => {
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, 56, true), true);
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, 58, true), true);
  assert.equal(isCorrect({ kind: 'number', answer: 57 }, 55, true), false);
});

test('choice answers match the option index (EDGE gives no wiggle room)', () => {
  assert.equal(isCorrect({ kind: 'choice', answer: 2 }, 2), true);
  assert.equal(isCorrect({ kind: 'choice', answer: 2 }, 1, true), false);
});

test('act-off: more votes wins 1500, the other gets 500', () => {
  const votes = new Map([['v1', 'a'], ['v2', 'a'], ['v3', 'b']]);
  const r = scoreActOff(['a', 'b'], votes);
  assert.deepEqual(r.tally, { a: 2, b: 1 });
  assert.deepEqual(r.winners, ['a']);
  assert.deepEqual(r.points, { a: 1500, b: 500 });
});

test('act-off tie splits the points and both win', () => {
  const r = scoreActOff(['a', 'b'], new Map([['v1', 'a'], ['v2', 'b']]));
  assert.deepEqual(r.winners, ['a', 'b']);
  assert.deepEqual(r.points, { a: 1000, b: 1000 });
});

test('act-off ignores votes for non-actors', () => {
  const r = scoreActOff(['a', 'b'], new Map([['v1', 'zzz'], ['v2', 'b']]));
  assert.deepEqual(r.winners, ['b']);
});
