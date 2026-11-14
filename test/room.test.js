const test = require('node:test');
const assert = require('node:assert/strict');
const { Room } = require('../src/room');

function makeRoom() {
  const sent = [];
  const pending = [];
  const timers = {
    setTimeout: (fn, ms) => { const t = { fn, ms }; pending.push(t); return t; },
    clearTimeout: (t) => { const i = pending.indexOf(t); if (i >= 0) pending.splice(i, 1); },
  };
  const room = new Room('TEST', { emitTo: (sid, ev, payload) => sent.push({ sid, ev, payload }), timers });
  room.hostSocketId = 'host';
  const fire = () => { const t = pending.shift(); t.fn(); };
  const lastFor = (sid) => [...sent].reverse().find((m) => m.sid === sid && m.ev === 'state').payload;
  return { room, sent, pending, fire, lastFor };
}

test('players join, names must be unique', () => {
  const { room } = makeRoom();
  assert.ok(room.join({ name: 'Ann', socketId: 's1' }).player);
  assert.match(room.join({ name: 'ann', socketId: 's2' }).error, /taken/);
  assert.match(room.join({ name: '  ', socketId: 's2' }).error, /name/);
});

test('rejoining with a playerId reconnects the same player', () => {
  const { room } = makeRoom();
  const { player } = room.join({ name: 'Ann', socketId: 's1' });
  room.disconnectSocket('s1');
  assert.equal(player.connected, false);
  const again = room.join({ playerId: player.id, socketId: 's9' });
  assert.equal(again.player, player);
  assert.equal(player.connected, true);
  assert.equal(room.players.size, 1);
});

test('full round: intro -> playing -> reveal, edge awarded and shown only to holder', () => {
  const { room, fire, lastFor } = makeRoom();
  const a = room.join({ name: 'A', socketId: 'sa' }).player;
  const b = room.join({ name: 'B', socketId: 'sb' }).player;
  const c = room.join({ name: 'C', socketId: 'sc' }).player;
  room.start(3);
  assert.equal(room.phase, 'intro');

  // The host view never contains the answer or stimulus before the reveal.
  const hostIntro = JSON.stringify(lastFor('host'));
  assert.ok(!hostIntro.includes('"answer"'));

  fire(); // intro -> playing
  assert.equal(room.phase, 'playing');
  assert.ok(lastFor('sa').yourRound.stimulus);
  assert.ok(!JSON.stringify(lastFor('host')).includes('stimulus'));

  const ans = room.round.answer;
  room.submitGuess(a.id, ans);
  room.submitGuess(b.id, ans + 1000);
  room.submitGuess(c.id, ans + 1000);
  fire(); // early end after all guessed
  assert.equal(room.phase, 'reveal');
  assert.equal(lastFor('host').round.answer, ans);
  assert.ok(a.score >= 1250);
  assert.equal(a.edge, true);
  assert.equal(b.edge, false);

  room.nextRound();
  fire();
  const viewA = lastFor('sa');
  const viewB = lastFor('sb');
  assert.equal(viewA.yourRound.hasEdge, true);
  assert.equal(viewB.yourRound.hasEdge, false);
  assert.deepEqual(viewA.yourRound.stimulus, room.round.edgeStimulus);
  assert.deepEqual(viewB.yourRound.stimulus, room.round.stimulus);
});

test('guesses are rejected outside the playing phase and clamped to the input range', () => {
  const { room, fire } = makeRoom();
  const a = room.join({ name: 'A', socketId: 'sa' }).player;
  room.join({ name: 'B', socketId: 'sb' });
  room.start(1);
  assert.ok(room.submitGuess(a.id, 5).error);
  fire();
  assert.ok(room.submitGuess(a.id, 'abc').error);
  assert.deepEqual(room.submitGuess(a.id, 1e12), {});
  const { max = Infinity } = room.round.game.input;
  assert.ok(room.round.guesses.get(a.id) <= max);
});

test('no edge is handed out after the final round', () => {
  const { room, fire } = makeRoom();
  const ps = ['A', 'B', 'C'].map((n, i) => room.join({ name: n, socketId: 's' + i }).player);
  room.start(1);
  fire();
  for (const p of ps) room.submitGuess(p.id, room.round.answer);
  fire();
  assert.equal(room.phase, 'reveal');
  assert.ok(ps.every((p) => !p.edge));
  room.nextRound();
  assert.equal(room.phase, 'final');
});

test('timer runs out -> reveal even if not everyone guessed', () => {
  const { room, fire } = makeRoom();
  const a = room.join({ name: 'A', socketId: 'sa' }).player;
  room.join({ name: 'B', socketId: 'sb' });
  room.start(2);
  fire();
  room.submitGuess(a.id, 1);
  fire();
  assert.equal(room.phase, 'reveal');
});
