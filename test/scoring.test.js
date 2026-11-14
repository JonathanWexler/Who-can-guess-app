const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreRound, closenessPoints, edgeSlots } = require('../src/scoring');

test('closeness points scale linearly and bottom out at 0', () => {
  assert.equal(closenessPoints(0, 10), 1000);
  assert.equal(closenessPoints(5, 10), 500);
  assert.equal(closenessPoints(10, 10), 0);
  assert.equal(closenessPoints(50, 10), 0);
  assert.equal(closenessPoints(Infinity, 10), 0);
});

test('edge slots depend on player count', () => {
  assert.equal(edgeSlots(2), 0);
  assert.equal(edgeSlots(3), 1);
  assert.equal(edgeSlots(5), 1);
  assert.equal(edgeSlots(6), 2);
});

test('closest guess gets winner bonus, exact gets bull\'s-eye bonus', () => {
  const { results } = scoreRound({
    answer: 50, tolerance: 50,
    entries: [{ id: 'a', guess: 40 }, { id: 'b', guess: 50 }, { id: 'c', guess: null }],
  });
  assert.deepEqual(results.map((r) => r.id), ['b', 'a', 'c']);
  assert.equal(results[0].points, 1000 + 250 + 250);
  assert.equal(results[1].points, 800);
  assert.equal(results[2].points, 0);
  assert.equal(results[2].guess, null);
});

test('ties share the win', () => {
  const { results } = scoreRound({ answer: 10, tolerance: 10, entries: [{ id: 'a', guess: 8 }, { id: 'b', guess: 12 }, { id: 'c', guess: 1 }] });
  assert.ok(results.find((r) => r.id === 'a').winner);
  assert.ok(results.find((r) => r.id === 'b').winner);
  assert.ok(!results.find((r) => r.id === 'c').winner);
});

test('float noise does not break ties (stopwatch)', () => {
  const { results } = scoreRound({ answer: 6.1, tolerance: 3, entries: [{ id: 'a', guess: 6.0 }, { id: 'b', guess: 6.2 }, { id: 'c', guess: 9 }] });
  assert.equal(results[0].error, 0.1);
  assert.equal(results[1].error, 0.1);
  assert.ok(results[0].winner && results[1].winner);
});

test('best finisher earns the edge', () => {
  const { edgeEarners } = scoreRound({ answer: 30, tolerance: 20, entries: [{ id: 'a', guess: 20 }, { id: 'b', guess: 29 }, { id: 'c', guess: 45 }] });
  assert.deepEqual(edgeEarners, ['b']);
});

test('edge user who wins does not keep the edge; it passes to the next best', () => {
  const { results, edgeEarners } = scoreRound({
    answer: 30, tolerance: 20,
    entries: [{ id: 'a', guess: 20 }, { id: 'b', guess: 30, hadEdge: true }, { id: 'c', guess: 45 }],
  });
  assert.equal(results[0].id, 'b');
  assert.deepEqual(edgeEarners, ['a']);
});

test('nobody earns the edge with a terrible guess or no guess', () => {
  const { edgeEarners } = scoreRound({ answer: 10, tolerance: 5, entries: [{ id: 'a', guess: 100 }, { id: 'b', guess: null }, { id: 'c', guess: -50 }] });
  assert.deepEqual(edgeEarners, []);
});

test('two edge slots with 6 players, ties at the cutoff included', () => {
  const entries = [
    { id: 'a', guess: 50 }, { id: 'b', guess: 48 }, { id: 'c', guess: 52 },
    { id: 'd', guess: 70 }, { id: 'e', guess: 10 }, { id: 'f', guess: null },
  ];
  const { edgeEarners } = scoreRound({ answer: 50, tolerance: 50, entries });
  assert.deepEqual(edgeEarners.sort(), ['a', 'b', 'c']);
});

test('head-to-head has no edge', () => {
  const { edgeEarners } = scoreRound({ answer: 5, tolerance: 5, entries: [{ id: 'a', guess: 5 }, { id: 'b', guess: 1 }] });
  assert.deepEqual(edgeEarners, []);
});

test('no winner bonus when everyone is way off', () => {
  const { results } = scoreRound({ answer: 10080, tolerance: 6000, entries: [{ id: 'a', guess: 24 }, { id: 'b', guess: 17 }, { id: 'c', guess: 10 }] });
  assert.ok(results.every((r) => !r.winner && r.points === 0));
});
