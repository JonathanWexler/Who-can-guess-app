const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { QUESTIONS, pickQuestions } = require('../src/questions');
const { ACT_PROMPTS } = require('../src/actprompts');

function seeded(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

test('there are 50 questions with unique ids', () => {
  assert.equal(QUESTIONS.length, 50);
  assert.equal(new Set(QUESTIONS.map((q) => q.id)).size, 50);
});

test('every question has a big-screen animation', () => {
  const scenes = fs.readFileSync(path.join(__dirname, '..', 'public', 'scenes.js'), 'utf8');
  for (const q of QUESTIONS) assert.match(scenes, new RegExp(`\\n  async ${q.id}\\(`), `missing scene for ${q.id}`);
});

test('every question generates valid rounds', () => {
  for (const q of QUESTIONS) {
    for (let seed = 1; seed <= 150; seed++) {
      const r = q.create(seeded(seed));
      assert.ok(Number.isInteger(r.answer) && r.answer >= 0, `${q.id} answer ${r.answer}`);
      assert.ok(r.data && typeof r.data === 'object', `${q.id} data`);
      assert.ok((r.watchMs || 0) <= 16000, `${q.id} animation too long: ${r.watchMs}`);
      assert.ok(r.prompt || q.prompt, `${q.id} prompt`);
      if (q.kind === 'choice') {
        assert.ok(r.options.length === 4 && r.answer < r.options.length, `${q.id} options: ${r.options.length}`);
        assert.equal(new Set(r.options.map((o) => (o.label || '') + (o.emoji || ''))).size, r.options.length, `${q.id} duplicate options`);
      }
    }
  }
});

test('counting answers match the animation data', () => {
  const rng = seeded(9);
  const get = (id) => QUESTIONS.find((q) => q.id === id).create(rng);
  const b = get('balloons');
  assert.equal(b.answer, b.data.count);
  const s = get('sheep');
  assert.equal(s.answer, s.data.seq.filter((x) => x === 's').length);
  const t = get('traffic');
  assert.equal(t.answer, t.data.seq.filter((c) => c === 'green').length);
  const sd = get('spotdiff');
  assert.equal(sd.answer, sd.data.left.filter((e, i) => e !== sd.data.right[i]).length);
  const bus = get('bus');
  assert.equal(bus.answer, bus.data.stops.reduce((n, st) => n + st.on - st.off, bus.data.start));
  const el = get('elevator');
  assert.equal(el.answer, el.data.moves.reduce((f, m) => f + m, el.data.start));
});

test('shell game answer follows the swaps', () => {
  const q = QUESTIONS.find((x) => x.id === 'shellgame');
  for (let seed = 1; seed < 50; seed++) {
    const r = q.create(seeded(seed));
    let pos = r.data.start;
    for (const [a, b] of r.data.swaps) pos = pos === a ? b : pos === b ? a : pos;
    assert.equal(r.answer, pos);
  }
});

test('photo finish: the winning option is the fastest racer', () => {
  const q = QUESTIONS.find((x) => x.id === 'photofinish');
  for (let seed = 1; seed < 50; seed++) {
    const r = q.create(seeded(seed));
    const fastest = r.data.finishMs.indexOf(Math.min(...r.data.finishMs));
    assert.equal(r.options[r.answer].emoji, r.data.racers[fastest]);
  }
});

test('pickQuestions avoids repeats until it runs out', () => {
  const first = pickQuestions(20, seeded(1));
  assert.equal(new Set(first).size, 20);
  const second = pickQuestions(20, seeded(2), new Set(first));
  assert.ok(second.every((id) => !first.includes(id)));
});

test('plenty of act-off prompts: animals and characters', () => {
  assert.ok(ACT_PROMPTS.length >= 60);
  assert.equal(new Set(ACT_PROMPTS.map((p) => p.text)).size, ACT_PROMPTS.length);
  assert.ok(ACT_PROMPTS.every((p) => ['Animal', 'Character'].includes(p.kind) && p.emoji && p.text));
  assert.ok(ACT_PROMPTS.filter((p) => p.kind === 'Animal').length >= 30);
  assert.ok(ACT_PROMPTS.filter((p) => p.kind === 'Character').length >= 30);
});

// Higher-quality seeded generator: neighbouring seeds give unrelated sequences.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('number answers become 4 close choices with the right one anywhere', () => {
  const { numberChoices } = require('../src/questions');
  const seen = [0, 0, 0, 0];
  for (let seed = 1; seed < 400; seed++) {
    const answer = seed % 70;
    const r = numberChoices(answer, mulberry32(seed));
    const values = r.options.map((o) => Number(o.label.replace(/,/g, '')));
    assert.equal(new Set(values).size, 4);
    assert.ok(values.every((v) => v >= 0));
    assert.equal(values[r.answer], answer);
    seen[r.answer]++;
  }
  assert.ok(seen.every((n) => n > 50), `answer position spread ${seen}`);
});
