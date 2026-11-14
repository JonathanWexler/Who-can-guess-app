const socket = io();
const app = document.getElementById('app');
let state = null;
let current = { key: null, update: null };
let joinBase = location.origin;

function emit(event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res || {})));
}

// Phones can't reach "localhost", so swap in this computer's network address.
fetch('/api/info').then((r) => r.json()).then((info) => {
  const local = /^(localhost|127\.|\[?::1\]?$)/.test(location.hostname);
  joinBase = info.publicUrl || (local && info.lan[0]) || location.origin;
  current.key = null;
  if (state) render();
}).catch(() => {});

socket.on('connect', async () => {
  const saved = store.get('wcg-host');
  if (saved) {
    const res = await emit('host:resume', saved);
    if (!res.error) return;
  }
  const res = await emit('host:create');
  store.set('wcg-host', { code: res.code, hostToken: res.hostToken });
});

socket.on('state', (s) => {
  state = s;
  render();
});

const joinUrl = () => `${joinBase}/play?code=${state.code}`;
const byId = () => Object.fromEntries(state.players.map((p) => [p.id, p]));
const next = () => emit('host:next');

function newRoom() {
  store.del('wcg-host');
  location.reload();
}

// Each screen is built once per "key" (phase + question/act-off). Smaller
// changes (someone answered, someone voted) go through update() so animations
// on the big screen keep running.
function render() {
  const q = state.question;
  const a = state.actoff;
  const key = JSON.stringify([state.phase, q && q.id, state.progress && state.progress.question, a && a.actors, a && a.prompt, state.phase === 'lobby' ? [state.players.map((p) => [p.id, p.connected]), state.settings, joinBase] : null, state.phase === 'final' ? state.players : null]);
  if (key !== current.key) {
    const view = { lobby: lobbyView, question: questionView, answer: answerView, actoff: actoffView, voting: votingView, 'actoff-result': actoffResultView, final: finalView }[state.phase]();
    current = { key, update: view.update || null };
    app.replaceChildren(view.el);
  }
  if (current.update) current.update(state);
}

function progressTag() {
  const p = state.progress;
  return p ? `Question ${p.question} of ${p.total} · Round ${p.set} of ${p.sets}` : '';
}

function edgeLine(ids) {
  const names = state.players.filter((p) => ids.includes(p.id)).map((p) => p.name);
  if (!names.length) return null;
  return h('div.edge-banner', h('strong', `⚡ ${names.join(' & ')} ${names.length > 1 ? 'have' : 'has'} the EDGE`), ' — off-by-one still counts, and one wrong choice gets crossed out.');
}

// ---------------------------------------------------------------- lobby
function lobbyView() {
  const s = state.settings;
  const url = joinUrl();
  const opt = (label, active, onclick) => h('button.btn.small', { class: active ? '' : 'secondary', onclick }, label);
  const el = h('div.stack',
    h('div.row', h('h1.logo', 'Who Can ', h('span', 'Guess?')), h('div.spacer'), h('button.btn.secondary.small', { onclick: newRoom }, 'New room')),
    h('div.host-grid',
      h('section.card.center.stack',
        h('div.row', { style: { justifyContent: 'center', gap: '28px', alignItems: 'center' } },
          h('div.qr', h('img', { src: `/qr.svg?url=${encodeURIComponent(url)}`, alt: 'QR code to join' })),
          h('div.stack', { style: { textAlign: 'left' } },
            h('p.muted', { style: { margin: 0 } }, '\u{1F4F1} Scan to join, or go to'),
            h('div.join-url', joinBase.replace(/^https?:\/\//, '') + '/play'),
            h('p.muted', { style: { margin: 0 } }, 'Room code'),
            h('div.code', { style: { fontSize: 'clamp(2.5rem, 7vw, 5rem)' } }, state.code),
          ),
        ),
        h('h3', state.players.length ? `${state.players.length} player${state.players.length === 1 ? '' : 's'} in` : 'Waiting for players…'),
        h('div.chips', { style: { justifyContent: 'center' } },
          state.players.map((p) => h('button.chip', { class: p.connected ? '' : 'off', title: 'Click to remove', onclick: () => confirm(`Remove ${p.name}?`) && emit('host:kick', { playerId: p.id }) }, swatch(p.color), p.name))),
        h('div.settings-row', h('span.muted', 'Questions between act-offs:'),
          [3, 4].map((n) => opt(n, s.perSet === n, () => emit('host:configure', { perSet: n })))),
        h('div.settings-row', h('span.muted', 'Rounds:'),
          [2, 3, 4, 5].map((n) => opt(n, s.sets === n, () => emit('host:configure', { sets: n })))),
        h('p.muted', { style: { margin: 0 } }, `${s.perSet * s.sets} picture questions + ${s.sets} act-offs`),
        h('button.btn', { disabled: state.players.length < 1, onclick: () => emit('host:start') }, '▶ Start game'),
      ),
      h('section.card',
        h('h3', 'How to play'),
        h('ol.how',
          h('li', h('strong', 'Picture questions: '), 'watch the big screen — balloons popping, someone blinking, fireworks… then answer on your phone.'),
          h('li', h('strong', 'One guess only! '), 'It has to be exactly right. Your phone tells you privately if you got it.'),
          h('li', h('strong', '\u{1F3AD} Act-offs: '), `after every ${s.perSet} questions, two random players act something out. Everyone else votes for who did it better.`),
          h('li', h('strong', { style: { color: 'var(--edge)' } }, '⚡ The EDGE: '), 'win an act-off and you get a slight advantage for the next round — off-by-one counts as right, and one wrong choice gets crossed out.'),
        ),
        h('p.muted', { style: { marginTop: '12px', fontSize: '.9rem' } }, '1,000 pts per right answer · 1,500 for winning an act-off · 500 for being brave. Scores are revealed after each act-off.'),
      ),
    ),
  );
  return { el };
}

// ---------------------------------------------------------------- question
function questionView() {
  const q = state.question;
  const stage = h('div.stage16');
  const ring = h('div.ring', h('span'));
  const answered = h('div.answered');
  const promptEl = h('div.q-prompt', `${q.emoji} ${q.prompt}`);
  const el = h('div',
    h('div.game-top', h('div', h('div.round-tag', progressTag()), promptEl), ring),
    stage,
    answered,
    h('div.row', { style: { marginTop: '10px' } }, edgeLine(q.edgeHolders), h('div.spacer'), h('button.btn.secondary.small', { onclick: next }, 'End question')),
  );

  // Title card, then the animation.
  const card = h('div.s-title', h('div.e', q.emoji), h('div.t', q.title), h('div.p', q.prompt));
  stage.append(card);
  setTimeout(() => {
    if (!stage.isConnected) return;
    card.remove();
    playScene(stage, q.id, q.data);
  }, q.cardMs);

  const endsAt = Date.now() + q.endsInMs;
  const tick = setInterval(() => {
    if (!ring.isConnected) return clearInterval(tick);
    const left = Math.max(0, endsAt - Date.now());
    ring.firstChild.textContent = Math.ceil(left / 1000);
    ring.style.setProperty('--p', (left / q.durationMs) * 100 + '%');
    ring.classList.toggle('low', left < 5000);
  }, 200);

  return {
    el,
    update(s) {
      const sub = new Set(s.question.submitted);
      const connected = s.players.filter((p) => p.connected);
      answered.replaceChildren(
        h('strong', `${sub.size}/${connected.length} answered`),
        ...s.players.map((p) => h('span.chip', { class: (sub.has(p.id) ? 'done ' : '') + (p.connected ? '' : 'off') }, swatch(p.color), p.name, sub.has(p.id) ? ' ✔' : '')),
      );
    },
  };
}

function optionPill(o, right) {
  return h('span.option-pill', { class: right ? 'right' : '' }, o.color ? h('span.swatch-lg', { style: { background: o.color } }) : null, o.emoji ? h('span', { style: { fontSize: '1.6em' } }, o.emoji) : null, o.label || null);
}

function answerView() {
  const q = state.question;
  const p = state.progress;
  const endOfSet = p.question % p.perSet === 0;
  const last = p.question >= p.total;
  const connected = state.players.filter((x) => x.connected).length;
  const willActOff = endOfSet && connected >= 3;
  const nextLabel = willActOff ? '\u{1F3AD} Act-off time!' : last ? '\u{1F3C6} Final results' : 'Next question ▶';
  const el = h('section.card.center.stack.pop',
    h('div.round-tag', progressTag()),
    h('h2', `${q.emoji} ${q.title}`),
    h('p', { style: { fontSize: '1.3rem' } }, q.prompt),
    h('div.muted', 'The answer was'),
    q.kind === 'choice'
      ? h('div.option-row', { style: { fontSize: '1.6rem' } }, optionPill(q.options[q.answer], true))
      : h('div.answer', formatNum(q.answer)),
    h('p.muted', `${q.answerCount} of ${state.players.length} locked in an answer. Check your phone to see if you got it! \u{1F92B}`),
    h('div', h('button.btn', { onclick: next }, nextLabel)),
  );
  return { el };
}

// ---------------------------------------------------------------- act-off
function actorCards(a, { votes } = {}) {
  const ids = byId();
  const winners = a.result ? a.result.winners : [];
  return h('div.vs',
    h('div.actor-card', { class: winners.length === 1 && winners[0] === a.actors[0] ? 'winner' : '', style: { '--c': ids[a.actors[0]]?.color } }, h('div.nm', ids[a.actors[0]]?.name || '?'), votes ? h('div.votes', votes[0]) : null),
    h('div.vs-word', 'VS'),
    h('div.actor-card', { class: winners.length === 1 && winners[0] === a.actors[1] ? 'winner' : '', style: { '--c': ids[a.actors[1]]?.color } }, h('div.nm', ids[a.actors[1]]?.name || '?'), votes ? h('div.votes', votes[1]) : null),
  );
}

function actoffView() {
  const a = state.actoff;
  const el = h('section.card.center.stack.pop',
    h('div.round-tag', `Act-off ${a.number}`),
    h('h1.logo', '\u{1F3AD} ACT-', h('span', 'OFF!')),
    h('p.muted', 'Come on up! You both act out the same thing, one at a time:'),
    actorCards(a),
    h('div.act-prompt', `“${a.prompt}”`),
    h('p.muted', 'No time limit. When you’re both done, everyone votes on their phone for who did it better!'),
    h('div.row', { style: { justifyContent: 'center' } },
      h('button.btn.secondary.small', { onclick: () => emit('host:reroll-actors') }, '\u{1F500} Different actors'),
      h('button.btn.secondary.small', { onclick: () => emit('host:reroll-prompt') }, '\u{1F3B2} Different prompt'),
    ),
    h('div', h('button.btn', { onclick: next }, '✅ Done acting — vote!')),
  );
  return { el };
}

function votingView() {
  const a = state.actoff;
  const status = h('div');
  const el = h('section.card.center.stack.pop',
    h('div.round-tag', `Act-off ${a.number}`),
    h('h1', '\u{1F5F3}️ Vote on your phones!'),
    h('div.act-prompt', `“${a.prompt}”`),
    actorCards(a),
    status,
    h('div', h('button.btn.secondary.small', { onclick: next }, 'Close voting')),
  );
  return {
    el,
    update(s) {
      const voters = s.players.filter((p) => p.connected && !s.actoff.actors.includes(p.id));
      const voted = new Set(s.actoff.voted);
      status.replaceChildren(
        h('p', h('strong', `${voted.size}/${voters.length} voted`)),
        h('div.chips', { style: { justifyContent: 'center' } }, voters.map((p) => h('span.chip', { class: voted.has(p.id) ? 'done' : '' }, swatch(p.color), p.name, voted.has(p.id) ? ' ✔' : ''))),
      );
    },
  };
}

function scoreboard(players) {
  return h('ol.standings', players.map((p, i) =>
    h('li', h('span.rank', i + 1), swatch(p.color), h('span.name', p.name), p.edge ? edgeBadge() : null, h('span.score', (p.score || 0).toLocaleString()))));
}

function actoffResultView() {
  const a = state.actoff;
  const r = a.result;
  const ids = byId();
  const tie = r.winners.length === 2;
  const p = state.progress;
  const last = p.question >= p.total;
  const el = h('div.host-grid',
    h('section.card.center.stack.pop',
      h('div.round-tag', `Act-off ${a.number} results`),
      h('h1', tie ? '\u{1F91D} It’s a tie!' : `\u{1F451} ${ids[r.winners[0]]?.name} wins!`),
      actorCards(a, { votes: a.actors.map((id) => r.tally[id]) }),
      h('p', a.actors.map((id) => `${ids[id]?.name} +${r.points[id].toLocaleString()}`).join('   ·   ')),
      !last ? h('div.edge-banner', h('strong', '⚡ EDGE: '), r.winners.map((id) => ids[id]?.name).join(' & '), ' get', r.winners.length === 1 ? 's' : '', ' a slight advantage for the next round of questions!') : null,
      h('div', h('button.btn', { onclick: next }, last ? '\u{1F3C6} Final results' : 'Next round ▶')),
    ),
    h('aside.card', h('h3', '\u{1F4CA} Scores'), scoreboard(state.players)),
  );
  return { el };
}

// ---------------------------------------------------------------- final
function finalView() {
  const ps = state.players;
  const step = (p, cls, place) => p && h('div.step.' + cls, h('div.who', swatch(p.color), ' ', p.name), h('div.muted', p.score.toLocaleString()), h('div.block', place));
  const sharp = [...ps].sort((a, b) => b.correct - a.correct)[0];
  const star = [...ps].sort((a, b) => b.actWins - a.actWins)[0];
  const el = h('section.card.center.stack.pop',
    h('h1.logo', '\u{1F3C6} Final ', h('span', 'Results')),
    h('div.podium', step(ps[1], 'p2', '2'), step(ps[0], 'p1', '1'), step(ps[2], 'p3', '3')),
    h('div', { style: { maxWidth: '520px', margin: '0 auto', textAlign: 'left' } }, scoreboard(ps)),
    h('div.row', { style: { justifyContent: 'center' } },
      sharp && sharp.correct > 0 ? h('span.option-pill', '\u{1F441}️ Sharpest eyes: ', sharp.name, ` (${sharp.correct} right)`) : null,
      star && star.actWins > 0 ? h('span.option-pill', '\u{1F3AD} Star actor: ', star.name, ` (${star.actWins} win${star.actWins > 1 ? 's' : ''})`) : null,
    ),
    h('div.row', { style: { justifyContent: 'center' } },
      h('button.btn', { onclick: () => emit('host:start') }, 'Play again'),
      h('button.btn.secondary', { onclick: () => emit('host:lobby') }, 'Back to lobby'),
    ),
  );
  return { el };
}
