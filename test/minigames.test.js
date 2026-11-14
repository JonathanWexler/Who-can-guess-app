const test = require('node:test');
const assert = require('node:assert/strict');
const { MINIGAMES, buildPlaylist, describe, windowAround } = require('../src/minigames');

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

test('every mini-game produces a valid round with a better edge version', () => {
  for (const game of MINIGAMES) {
    for (let seed = 1; seed <= 200; seed++) {
      const r = game.create(seeded(seed));
      assert.ok(Number.isFinite(r.answer), `${game.id} answer`);
      assert.ok(r.tolerance > 0, `${game.id} tolerance`);
      assert.ok(r.stimulus && r.edgeStimulus, `${game.id} stimuli`);
      assert.equal(r.stimulus.type, r.edgeStimulus.type);
      assert.notDeepEqual(r.stimulus, r.edgeStimulus, `${game.id} edge must differ`);
      const { min = -Infinity, max = Infinity } = game.input;
      assert.ok(r.answer >= min && r.answer <= max, `${game.id} answer within input range`);
    }
  }
});

test('edge versions are strictly more generous', () => {
  const rng = seeded(42);
  const get = (id) => MINIGAMES.find((g) => g.id === id).create(rng);
  for (const id of ['dots', 'bar', 'angle']) {
    const r = get(id);
    assert.ok(r.edgeStimulus.showMs > r.stimulus.showMs, id);
  }
  const sw = get('stopwatch');
  assert.ok(sw.edgeStimulus.visibleMs > sw.stimulus.visibleMs);
  const bl = get('blinks');
  assert.ok(bl.edgeStimulus.intervalMs > bl.stimulus.intervalMs);
  const my = get('mystery');
  assert.ok(my.edgeStimulus.clues.length > my.stimulus.clues.length);
  assert.ok(get('estimate').edgeStimulus.hint);
});

test('dot count matches answer', () => {
  const r = MINIGAMES.find((g) => g.id === 'dots').create(seeded(7));
  assert.equal(r.stimulus.dots.length, r.answer);
});

test('clue windows always contain the answer', () => {
  for (let seed = 1; seed < 500; seed++) {
    const rng = seeded(seed);
    const v = Math.floor(rng() * 100) + 1;
    const w = windowAround(rng, v, 16, 1, 100);
    assert.ok(w.low <= v && v <= w.high && w.low >= 1 && w.high <= 100, `${v} in ${w.low}-${w.high}`);
  }
});

test('describe() never leaks the answer', () => {
  for (const g of MINIGAMES) {
    const d = describe(g);
    assert.equal(d.create, undefined);
    assert.equal(d.answer, undefined);
  }
});

test('playlist has requested length and no back-to-back repeats', () => {
  for (let seed = 1; seed < 100; seed++) {
    const list = buildPlaylist(20, seeded(seed));
    assert.equal(list.length, 20);
    for (let i = 1; i < list.length; i++) assert.notEqual(list[i], list[i - 1]);
  }
});
