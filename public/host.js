const socket = io();
const app = document.getElementById('app');
let state = null;
let renderedKey = null;
let roundsChoice = 6;

function emit(event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res || {})));
}

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

function joinUrl() {
  return `${location.origin}/play?code=${state.code}`;
}

function newRoom() {
  store.del('wcg-host');
  location.reload();
}

// Re-render the whole screen only when something meaningful changes, so
// countdown timers and animations aren't reset by every update.
function render() {
  const r = state.round;
  const key = JSON.stringify([state.phase, r && r.number, state.players, r && r.submitted, state.totalRounds]);
  if (key === renderedKey) return;
  renderedKey = key;
  const view = { lobby: lobbyView, intro: introView, playing: playingView, reveal: revealView, final: finalView }[state.phase];
  app.replaceChildren(view());
}

function standingsList(players, { showEdge = true } = {}) {
  return h('ol.standings', players.map((p, i) =>
    h('li', { class: p.connected ? '' : 'muted' },
      h('span.rank', i + 1),
      swatch(p.color),
      h('span.name', p.name),
      showEdge && p.edge ? edgeBadge() : null,
      h('span.score', p.score.toLocaleString()),
    )));
}

function sidebar() {
  return h('aside.card',
    h('h3', 'Scores'),
    standingsList(state.players),
    h('p.muted', { style: { marginTop: '12px', fontSize: '.85rem' } }, 'Room ', h('strong', state.code), ' · join at ', location.host + '/play'),
  );
}

function lobbyView() {
  const players = state.players;
  const roundsOpts = [3, 6, 9, 12];
  return h('div.stack',
    h('div.row',
      h('h1.logo', 'Who Can ', h('span', 'Guess?')),
      h('div.spacer'),
      h('button.btn.secondary.small', { onclick: newRoom }, 'New room'),
    ),
    h('div.host-grid',
      h('section.card.center.stack',
        h('p.muted', 'Grab your phone and go to'),
        h('h2', location.host + '/play'),
        h('p.muted', 'and enter the room code'),
        h('div.code', state.code),
        h('h3', { style: { marginTop: '24px' } }, players.length ? `${players.length} player${players.length === 1 ? '' : 's'} in` : 'Waiting for players…'),
        h('div.chips', { style: { justifyContent: 'center' } },
          players.map((p) => h('button.chip', { class: p.connected ? '' : 'off', title: 'Click to remove', onclick: () => confirm(`Remove ${p.name}?`) && emit('host:kick', { playerId: p.id }) }, swatch(p.color), p.name))),
        h('div.row', { style: { justifyContent: 'center', marginTop: '20px' } },
          h('span.muted', 'Rounds:'),
          roundsOpts.map((n) => h('button.btn.small', {
            class: n === roundsChoice ? '' : 'secondary',
            onclick: () => { roundsChoice = n; renderedKey = null; render(); },
          }, n)),
        ),
        h('button.btn', {
          disabled: players.length < 1,
          onclick: () => emit('host:start', { rounds: roundsChoice }),
        }, '▶ Start game'),
      ),
      h('section.card',
        h('h3', 'How to play'),
        h('ol.how',
          h('li', 'Every round is a different quick mini-game: count flashing dots, stop a hidden stopwatch, eyeball an angle, estimate trivia…'),
          h('li', 'Everyone guesses on their own phone. Closest guess scores the most (up to 1,000 pts, +250 for closest, +250 more for a bull’s-eye).'),
          h('li', h('strong', { style: { color: 'var(--edge)' } }, '⚡ The EDGE: '), 'the best guesser(s) each round earn a slight advantage in the next round — a longer look, a slower blink, an extra clue.'),
          h('li', 'The EDGE can’t be earned two rounds in a row, so it keeps moving around the room.'),
        ),
        h('p.muted', { style: { marginTop: '12px', fontSize: '.9rem' } }, 'With 3–5 players, 1 player earns the EDGE each round; with 6+, 2 do. Head-to-head games have no EDGE.'),
      ),
    ),
  );
}

function roundHeader(r) {
  return h('div.round-tag', `Round ${r.number} of ${r.total}`);
}

function edgeHoldersLine(r) {
  const holders = state.players.filter((p) => r.edgeHolders.includes(p.id));
  if (!holders.length) return null;
  return h('div.edge-banner',
    h('strong', '\u26A1 ' + holders.map((p) => p.name).join(' & ') + (holders.length === 1 ? ' has' : ' have') + ' the EDGE: '),
    r.game.edgeText,
  );
}

function introView() {
  const r = state.round;
  return h('div.host-grid',
    h('section.card.center.stack.pop',
      roundHeader(r),
      h('div.big-emoji', r.game.emoji),
      h('h1', r.game.title),
      h('p', { style: { fontSize: '1.4rem' } }, r.game.instructions),
      edgeHoldersLine(r),
      h('p.muted', 'Get ready… eyes on your phones!'),
      h('div', h('button.btn.secondary.small', { onclick: () => emit('host:next') }, 'Skip intro')),
    ),
    sidebar(),
  );
}

function playingView() {
  const r = state.round;
  const timer = h('div.timer');
  startCountdown(timer, Date.now() + (r.endsInMs ?? 0));
  const connected = state.players.filter((p) => p.connected);
  return h('div.host-grid',
    h('section.card.center.stack',
      roundHeader(r),
      h('div.row', { style: { justifyContent: 'center' } }, h('span.big-emoji', { style: { fontSize: '3rem' } }, r.game.emoji), h('h1', { style: { margin: 0 } }, r.game.title)),
      h('h2', '\u{1F4F1} Look at your phones!'),
      timer,
      h('p.muted', `${r.submitted.length} of ${connected.length} locked in`),
      h('div.chips', { style: { justifyContent: 'center' } },
        state.players.map((p) => h('span.chip', { class: (r.submitted.includes(p.id) ? 'done ' : '') + (p.connected ? '' : 'off') },
          swatch(p.color), p.name, r.submitted.includes(p.id) ? ' ✔' : '', r.edgeHolders.includes(p.id) ? edgeBadge('') : null))),
      edgeHoldersLine(r),
      h('div', h('button.btn.secondary.small', { onclick: () => emit('host:next') }, 'Reveal now')),
    ),
    sidebar(),
  );
}

function revealView() {
  const r = state.round;
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]));
  const unit = r.game.input.unit;
  const earners = r.edgeEarners.map((id) => byId[id]).filter(Boolean);
  return h('div.host-grid',
    h('section.card.stack.pop',
      h('div.center.stack',
        roundHeader(r),
        r.revealText ? h('p', { style: { fontSize: '1.3rem' } }, r.revealText) : h('h2', `${r.game.emoji} ${r.game.title}`),
        h('div.muted', 'The answer was'),
        h('div.answer', withUnit(r.answer, unit)),
      ),
      h('table.results',
        h('thead', h('tr', h('th', ''), h('th', 'Player'), h('th.num', 'Guess'), h('th.num', 'Off by'), h('th.num', 'Points'))),
        h('tbody', r.results.map((res, i) => {
          const p = byId[res.id];
          if (!p) return null;
          return h('tr', { class: res.winner ? 'win' : '' },
            h('td', i + 1),
            h('td', h('span.row', { style: { gap: '8px', flexWrap: 'nowrap' } }, swatch(p.color), p.name,
              res.exact ? h('span.tag.gold', 'BULL’S-EYE') : res.winner ? h('span.tag.gold', 'CLOSEST') : null,
              res.hadEdge ? h('span.tag', '⚡ used edge') : null)),
            h('td.num', withUnit(res.guess, unit)),
            h('td.num', res.guess == null ? '—' : formatNum(res.error)),
            h('td.num', '+' + res.points.toLocaleString()),
          );
        })),
      ),
      earners.length
        ? h('div.edge-banner', h('strong', '⚡ EDGE earned: '), earners.map((p) => p.name).join(' & '), r.isLast ? ' (bragging rights only — that was the last round!)' : (earners.length === 1 ? ' gets' : ' get') + ' a slight advantage next round.')
        : (state.edgeSlots > 0 && !r.isLast ? h('p.muted', 'Nobody earned the EDGE this round.') : null),
      h('div.center', h('button.btn', { onclick: () => emit('host:next') }, r.isLast ? '\u{1F3C6} Final results' : 'Next round ▶')),
    ),
    sidebar(),
  );
}

function finalView() {
  const ps = state.players;
  const step = (p, cls, place) => p && h('div.step.' + cls, h('div.who', swatch(p.color), ' ', p.name), h('div.muted', p.score.toLocaleString()), h('div.block', place));
  return h('section.card.center.stack.pop',
    h('h1.logo', '\u{1F3C6} Final ', h('span', 'Results')),
    h('div.podium', step(ps[1], 'p2', '2'), step(ps[0], 'p1', '1'), step(ps[2], 'p3', '3')),
    h('div', { style: { maxWidth: '520px', margin: '0 auto', textAlign: 'left' } }, standingsList(ps, { showEdge: false })),
    (() => {
      const top = [...ps].sort((a, b) => b.edgesEarned - a.edgesEarned)[0];
      return top && top.edgesEarned > 0 ? h('p', '⚡ Most EDGEs earned: ', h('strong', top.name), ` (${top.edgesEarned})`) : null;
    })(),
    h('div.row', { style: { justifyContent: 'center' } },
      h('button.btn', { onclick: () => emit('host:start', { rounds: state.totalRounds }) }, 'Play again'),
      h('button.btn.secondary', { onclick: () => emit('host:lobby') }, 'Back to lobby'),
    ),
  );
}
