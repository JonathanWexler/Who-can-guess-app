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
  const fire = () => pending.shift().fn();
  const lastFor = (sid) => [...sent].reverse().find((m) => m.sid === sid && m.ev === 'state').payload;
  const join = (...names) => names.map((n) => room.join({ name: n, socketId: 's-' + n }).player);
  return { room, sent, pending, fire, lastFor, join };
}

test('names must be unique; rejoin keeps your seat', () => {
  const { room, join } = makeRoom();
  const [ann] = join('Ann');
  assert.match(room.join({ name: 'ann', socketId: 'x' }).error, /taken/);
  room.disconnectSocket('s-Ann');
  assert.equal(room.join({ playerId: ann.id, socketId: 'new' }).player, ann);
  assert.equal(room.players.size, 1);
});

test('one guess only; exact answers score; phones see only their own result', () => {
  const { room, join, fire, lastFor } = makeRoom();
  const [a, b] = join('A', 'B');
  room.configure({ perSet: 3, sets: 1 });
  room.start();
  assert.equal(room.phase, 'question');
  const q = room.question;
  const right = q.answer;
  const wrong = (q.answer + 1) % q.options.length;

  assert.deepEqual(room.submitGuess(a.id, right), {});
  assert.match(room.submitGuess(a.id, wrong).error, /already/);
  room.submitGuess(b.id, wrong);
  fire(); // everyone answered → reveal
  assert.equal(room.phase, 'answer');
  assert.equal(a.score, 1000);
  assert.equal(b.score, 0);

  // Phones learn right/wrong privately…
  assert.equal(lastFor('s-A').question.result.correct, true);
  assert.equal(lastFor('s-B').question.result.correct, false);
  // …the big screen never says who was right, and hides scores mid-round.
  const host = JSON.stringify(lastFor('host'));
  assert.ok(!host.includes('"correct"'));
  assert.ok(!host.includes('"score"'));
});

test('the answer is never sent to anyone before the reveal', () => {
  const { room, join, lastFor } = makeRoom();
  join('A');
  room.start();
  assert.equal(lastFor('host').question.answer, undefined);
  assert.equal(lastFor('s-A').question.answer, undefined);
  assert.equal(lastFor('s-A').question.data, undefined);
});

test('after a set of questions comes an act-off; votes decide the winner, who gets the EDGE', () => {
  const { room, join, fire, lastFor } = makeRoom();
  const ps = join('A', 'B', 'C', 'D');
  room.configure({ perSet: 3, sets: 2 });
  room.start();
  for (let i = 0; i < 3; i++) {
    assert.equal(room.phase, 'question');
    room.advance(); // host ends the question
    assert.equal(room.phase, 'answer');
    room.advance();
  }
  assert.equal(room.phase, 'actoff');
  const [x, y] = room.actoff.actors;
  assert.notEqual(x, y);
  assert.ok(lastFor('s-' + room.players.get(x).name).actoff.youAreActor);

  room.advance(); // done acting → voting
  assert.equal(room.phase, 'voting');
  const voters = ps.filter((p) => p.id !== x && p.id !== y);
  assert.match(room.submitVote(x, y).error, /Actors/);
  room.submitVote(voters[0].id, x);
  room.submitVote(voters[1].id, x);
  fire(); // all voted
  assert.equal(room.phase, 'actoff-result');
  assert.equal(room.players.get(x).score, 1500);
  assert.equal(room.players.get(y).score, 500);
  assert.equal(room.players.get(x).edge, true);
  assert.equal(room.players.get(y).edge, false);
  assert.ok(lastFor('host').players[0].score !== undefined, 'scores revealed after act-off');

  room.advance();
  assert.equal(room.phase, 'question');
  assert.ok(room.question.edgeHolders.has(x));
  assert.equal(lastFor('s-' + room.players.get(x).name).question.hasEdge, true);
});

test('edge holders get a crossed-out option on choice questions and cannot pick it', () => {
  const { room, join } = makeRoom();
  const [a] = join('A', 'B', 'C');
  room.start();
  // Force a choice question with the EDGE.
  a.edge = true;
  room.playlist[room.qIndex + 1] = 'rainbow';
  room.nextQuestion();
  const q = room.question;
  assert.ok(q.edgeHolders.has(a.id));
  assert.notEqual(q.removed, q.answer);
  assert.equal(room.playerView(a).question.removed, q.removed);
  assert.match(room.submitGuess(a.id, q.removed).error, /option/);
});

test('2-player games still get act-offs: the actors rate each other 1-5 stars', () => {
  const { room, join, fire, lastFor } = makeRoom();
  const [a, b] = join('A', 'B');
  room.configure({ perSet: 3, sets: 2 });
  room.start();
  for (let i = 0; i < 3; i++) { room.advance(); room.advance(); }
  assert.equal(room.phase, 'actoff');
  assert.deepEqual([...room.actoff.actors].sort(), [a.id, b.id].sort());
  assert.ok(['Animal', 'Character'].includes(room.actoff.prompt.kind));
  room.advance(); // done acting
  assert.equal(room.phase, 'voting');
  assert.equal(room.actoff.mode, 'rate');
  assert.equal(lastFor('s-A').actoff.mode, 'rate');
  assert.match(room.submitRating(a.id, 9).error, /1 to 5/);
  room.submitRating(a.id, 2); // A gives B 2 stars
  room.submitRating(b.id, 5); // B gives A 5 stars
  fire();
  assert.equal(room.phase, 'actoff-result');
  assert.deepEqual(room.actoff.result.winners, [a.id]);
  assert.equal(a.score, 1500);
  assert.equal(b.score, 500);
  assert.equal(a.edge, true);
});

test('host can skip an act-off: no points, no EDGE, on to the next question', () => {
  const { room, join } = makeRoom();
  const ps = join('A', 'B', 'C');
  room.configure({ perSet: 3, sets: 2 });
  room.start();
  for (let i = 0; i < 3; i++) { room.advance(); room.advance(); }
  assert.equal(room.phase, 'actoff');
  room.skipActOff();
  assert.equal(room.phase, 'question');
  assert.equal(room.qIndex, 3);
  assert.ok(ps.every((p) => p.score === 0 && !p.edge));
});

test('skipping the last act-off goes to the final screen', () => {
  const { room, join } = makeRoom();
  join('A', 'B');
  room.configure({ perSet: 3, sets: 1 });
  room.start();
  for (let i = 0; i < 3; i++) { room.advance(); room.advance(); }
  room.advance(); // into voting
  room.skipActOff();
  assert.equal(room.phase, 'final');
});

test('final act-off leads to the final screen and leaves no EDGE behind', () => {
  const { room, join } = makeRoom();
  join('A', 'B', 'C');
  room.configure({ perSet: 3, sets: 1 });
  room.start();
  for (let i = 0; i < 3; i++) { room.advance(); room.advance(); }
  assert.equal(room.phase, 'actoff');
  room.advance();
  room.advance(); // close voting with no votes → tie
  assert.equal(room.phase, 'actoff-result');
  assert.ok([...room.players.values()].every((p) => !p.edge));
  room.advance();
  assert.equal(room.phase, 'final');
});

test('rerolling actors picks different people when possible', () => {
  const { room, join } = makeRoom();
  join('A', 'B', 'C', 'D', 'E');
  room.configure({ perSet: 3, sets: 1 });
  room.start();
  for (let i = 0; i < 3; i++) { room.advance(); room.advance(); }
  const before = [...room.actoff.actors];
  room.rerollActors();
  assert.ok(room.actoff.actors.every((id) => !before.includes(id)));
});

test('the first player to join is the host; the crown passes on if they leave', () => {
  const { room, join, lastFor } = makeRoom();
  const [a, b] = join('A', 'B');
  assert.equal(room.leaderId, a.id);
  assert.ok(room.canControl(a.id));
  assert.ok(!room.canControl(b.id));
  assert.equal(lastFor('s-B').leaderId, a.id);
  room.kick(a.id);
  assert.equal(room.leaderId, b.id);
});

test('a host whose phone drops gets 30s to come back before the crown moves', () => {
  const { room, join, pending } = makeRoom();
  const [a, b] = join('A', 'B');
  room.disconnectSocket('s-A');
  assert.equal(room.leaderId, a.id);
  const t = pending.find((x) => x.ms === 30000);
  room.join({ playerId: a.id, socketId: 's-A2' }); // back in time
  assert.ok(!pending.includes(t));
  assert.equal(room.leaderId, a.id);

  room.disconnectSocket('s-A2');
  pending.find((x) => x.ms === 30000).fn(); // stays away
  assert.equal(room.leaderId, b.id);
});

test('every question is multiple choice with exactly 4 answers', () => {
  const { room, join } = makeRoom();
  join('A');
  room.configure({ perSet: 4, sets: 5 });
  for (let game = 0; game < 3; game++) {
    room.phase = 'lobby';
    room.start();
    for (let i = 0; i < room.playlist.length; i++) {
      const q = room.question;
      assert.equal(q.options.length, 4, `${q.template.id} has ${q.options.length} options`);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.equal(new Set(q.options.map((o) => o.label + (o.emoji || ''))).size, 4, `${q.template.id} duplicate options`);
      assert.notEqual(q.removed, q.answer);
      assert.equal(room.playerView([...room.players.values()][0]).question.kind, 'choice');
      if (i < room.playlist.length - 1) room.nextQuestion();
    }
  }
});

test('sabotage: two per round, only on people who have not answered, never yourself', () => {
  const { room, join, lastFor } = makeRoom();
  const [a, b, c, d] = join('A', 'B', 'C', 'D');
  room.configure({ perSet: 3, sets: 2 });
  room.start();
  assert.equal(a.sabotages, 2);
  assert.match(room.sabotage(a.id, a.id).error, /someone else/);
  room.submitGuess(c.id, 0);
  assert.match(room.sabotage(a.id, c.id).error, /already answered/);
  assert.deepEqual(room.sabotage(a.id, b.id), {});
  assert.equal(a.sabotages, 1);
  assert.equal(lastFor('s-B').question.sabotagedBy, 'A');
  assert.equal(lastFor('s-A').question.sabotagedBy, null);
  assert.deepEqual(lastFor('host').question.sabotages, [{ from: a.id, to: b.id }]);
  assert.match(room.sabotage(d.id, b.id).error, /already sabotaged/);
  assert.deepEqual(room.sabotage(a.id, d.id), {}); // second one, same question, different target
  assert.equal(a.sabotages, 0);
  room.nextQuestion();
  assert.match(room.sabotage(a.id, b.id).error, /No sabotages left/); // still the same round
  // Next round (after the act-off) everyone gets two again.
  room.nextQuestion();
  room.nextQuestion();
  assert.equal(room.qIndex % 3, 0);
  assert.equal(a.sabotages, 2);
  assert.deepEqual(room.sabotage(a.id, b.id), {});
});

test('sabotage only works during a question', () => {
  const { room, join } = makeRoom();
  const [a, b] = join('A', 'B');
  assert.match(room.sabotage(a.id, b.id).error, /during a question/);
});
