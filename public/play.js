const socket = io();
const app = document.getElementById('app');
let state = null;
let renderedKey = null;
let joinError = '';
const roundEndsAt = {};

function emit(event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res || {})));
}

// ---- joining ---------------------------------------------------------------

const params = new URLSearchParams(location.search);
const saved = store.get('wcg-player'); // { code, playerId, name }

socket.on('connect', async () => {
  if (saved && saved.playerId) {
    const res = await emit('player:join', saved);
    if (!res.error) return;
    store.del('wcg-player');
  }
  if (!state) joinView();
});

socket.on('state', (s) => {
  state = s;
  render();
});

socket.on('kicked', () => {
  store.del('wcg-player');
  state = null;
  renderedKey = null;
  joinError = 'You were removed from the room.';
  joinView();
});

function joinView() {
  const code = h('input', { type: 'text', maxlength: 4, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'ABCD', value: (params.get('code') || (saved && saved.code) || '').toUpperCase(), style: { textTransform: 'uppercase', letterSpacing: '.3em', textAlign: 'center' } });
  const name = h('input', { type: 'text', maxlength: 16, autocomplete: 'nickname', placeholder: 'Your name', value: (saved && saved.name) || '' });
  const err = h('p.error', joinError);
  const btn = h('button.btn.block', { type: 'submit' }, 'Join game');
  const form = h('form.card', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true;
      const res = await emit('player:join', { code: code.value, name: name.value });
      btn.disabled = false;
      if (res.error) { err.textContent = res.error; return; }
      joinError = '';
      store.set('wcg-player', { code: res.code, playerId: res.playerId, name: name.value.trim() });
    },
  },
    h('label', 'Room code'), code,
    h('label', 'Your name'), name,
    err, btn,
  );
  app.replaceChildren(h('div.stack', h('h1.logo.center', 'Who Can ', h('span', 'Guess?')), form));
  (code.value ? name : code).focus();
}

async function leave() {
  if (!confirm('Leave this game?')) return;
  await emit('player:leave');
  store.del('wcg-player');
  location.href = '/play';
}

// ---- rendering -------------------------------------------------------------

function render() {
  const r = state.round;
  const yr = state.yourRound || {};
  const key = JSON.stringify([
    state.phase, r && r.number, yr.submitted, yr.hasEdge, state.you.edge,
    state.phase === 'lobby' || state.phase === 'final' ? state.players.map((p) => [p.name, p.score]) : null,
  ]);
  if (key === renderedKey) return;
  renderedKey = key;
  const view = { lobby: lobbyView, intro: introView, playing: playingView, reveal: revealView, final: finalView }[state.phase];
  app.replaceChildren(youBar(), view());
}

function youBar() {
  const me = state.you;
  return h('div.you-bar',
    swatch(me.color),
    h('span.name', me.name, ' ', me.edge ? edgeBadge() : null),
    h('strong', me.score.toLocaleString(), ' pts'),
  );
}

function lobbyView() {
  return h('div.stack.center',
    h('div.card.stack',
      h('h2', 'You’re in! \u{1F389}'),
      h('p.muted', 'Room ', h('strong', state.code), ' · waiting for the host to start…'),
      h('div.chips', { style: { justifyContent: 'center' } }, state.players.map((p) => h('span.chip', swatch(p.color), p.name))),
    ),
    h('div.card', { style: { textAlign: 'left' } },
      h('h3', 'Quick rules'),
      h('ul.how',
        h('li', 'Each round is a different mini guessing game on your phone.'),
        h('li', 'Closest guess wins the most points.'),
        h('li', h('strong', { style: { color: 'var(--edge)' } }, '⚡ Win a round to earn the EDGE'), ' — a slight advantage next round.'),
      ),
    ),
    h('button.btn.secondary.small', { onclick: leave }, 'Leave'),
  );
}

function edgeBox(game, hasEdge) {
  if (!hasEdge) return null;
  return h('div.edge-banner.pop', h('strong', '⚡ You have the EDGE! '), game.edgeText);
}

function introView() {
  const r = state.round;
  return h('div.stack.center.pop',
    h('div.round-tag', `Round ${r.number} of ${r.total}`),
    h('div.big-emoji', r.game.emoji),
    h('h1', r.game.title),
    h('p', { style: { fontSize: '1.2rem' } }, r.game.instructions),
    edgeBox(r.game, state.yourRound && state.yourRound.hasEdge),
    h('p.muted', 'Get ready…'),
  );
}

function timerBar(r) {
  if (!roundEndsAt[r.number]) roundEndsAt[r.number] = { at: Date.now() + (r.endsInMs ?? 0), total: r.endsInMs || 1 };
  const t = roundEndsAt[r.number];
  const el = h('div.mini-timer', h('div'));
  startCountdown(el, t.at, { total: t.total });
  return el;
}

function playingView() {
  const r = state.round;
  const yr = state.yourRound;
  if (yr.submitted) {
    return h('div.stack.center.pop',
      h('div.card.locked', 'Locked in:', h('strong', withUnit(yr.guess, r.game.input.unit))),
      h('p.muted', 'Waiting for everyone else…'),
      timerBar(r),
    );
  }
  const stim = yr.stimulus;
  const body = h('div.stack');
  const container = h('div.stack',
    h('div.row', h('strong', `${r.game.emoji} ${r.game.title}`), h('div.spacer'), yr.hasEdge ? edgeBadge() : null),
    body,
    timerBar(r),
  );

  if (stim.type === 'stopwatch') {
    body.append(stopwatchGame(stim, r.game));
  } else if (stim.type === 'clues' || stim.type === 'question') {
    body.append(...[
      stim.question ? h('p.question', stim.question) : null,
      ...(stim.clues || []).map((c) => h('div.clue', { class: c.startsWith('EDGE') ? 'edge' : '' }, c)),
      stim.hint ? h('div.clue.edge', stim.hint) : null,
      guessInput(r.game),
    ].filter(Boolean));
  } else {
    // Peek games: "get ready", flash the stimulus, then hide it and ask.
    const stage = h('div.stage', h('div.msg', 'Get ready…'));
    body.append(stage);
    runPeek(stage, stim).then(() => {
      if (!stage.isConnected) return;
      stage.replaceChildren(h('div.msg', '\u{1F914} What did you see?'));
      stage.style.aspectRatio = 'auto';
      stage.style.minHeight = '90px';
      body.append(guessInput(r.game));
    });
  }
  return container;
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function runPeek(stage, stim) {
  await sleep(1200);
  if (stim.type === 'dots') {
    stage.replaceChildren(s('svg', { viewBox: '0 0 100 100' }, stim.dots.map((d) => s('circle', { cx: d.x, cy: d.y, r: d.r, fill: d.c }))));
    await sleep(stim.showMs);
  } else if (stim.type === 'bar') {
    stage.replaceChildren(h('div.barbox', h('div.barfill', { style: { width: stim.percent + '%' } })));
    await sleep(stim.showMs);
  } else if (stim.type === 'angle') {
    stage.replaceChildren(angleSvg(stim));
    await sleep(stim.showMs);
  } else if (stim.type === 'blinks') {
    const lamp = h('div.lamp');
    stage.replaceChildren(lamp);
    await sleep(400);
    for (let i = 0; i < stim.count; i++) {
      lamp.classList.add('on');
      await sleep(stim.intervalMs);
      lamp.classList.remove('on');
      await sleep(stim.intervalMs);
    }
    await sleep(200);
  }
}

function angleSvg(stim) {
  const cx = 50, cy = 75, R = 42;
  const rad = (stim.degrees * Math.PI) / 180;
  const parts = [
    s('line', { x1: 4, y1: cy, x2: 96, y2: cy, stroke: '#6a63a8', 'stroke-width': 1.5 }),
    s('path', { d: `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`, fill: 'none', stroke: '#3a3370', 'stroke-width': 1 }),
  ];
  if (stim.ticks) {
    for (let a = 0; a <= 180; a += 15) {
      const t = (a * Math.PI) / 180;
      const inner = a % 45 === 0 ? R - 6 : R - 3;
      parts.push(s('line', { x1: cx + Math.cos(t) * inner, y1: cy - Math.sin(t) * inner, x2: cx + Math.cos(t) * R, y2: cy - Math.sin(t) * R, stroke: '#5ce1e6', 'stroke-width': a % 45 === 0 ? 1.2 : 0.7 }));
    }
  }
  parts.push(
    s('line', { x1: cx, y1: cy, x2: cx + Math.cos(rad) * R, y2: cy - Math.sin(rad) * R, stroke: '#ffd23f', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    s('circle', { cx, cy, r: 2.5, fill: '#ffd23f' }),
  );
  return s('svg', { viewBox: '0 0 100 100' }, parts);
}

function guessInput(game) {
  const { kind, min, max, step, unit } = game.input;
  const err = h('p.error');
  let input, getValue, field;
  if (kind === 'slider') {
    const mid = Math.round((min + max) / 2);
    const display = h('div.slider-value', withUnit(mid, unit));
    input = h('input', { type: 'range', min, max, step, value: mid, oninput: () => { display.textContent = withUnit(Number(input.value), unit); } });
    getValue = () => Number(input.value);
    field = h('div', display, input);
  } else {
    input = h('input', { type: 'number', inputmode: 'numeric', min, max, step, placeholder: unit ? `Your guess (${unit})` : 'Your guess', enterkeyhint: 'done' });
    getValue = () => (input.value === '' ? NaN : Number(input.value));
    field = input;
  }
  const btn = h('button.btn.block', { type: 'submit' }, 'Lock it in \u{1F512}');
  const form = h('form.stack.pop', {
    onsubmit: async (e) => {
      e.preventDefault();
      const v = getValue();
      if (!Number.isFinite(v)) { err.textContent = 'Enter a number first.'; return; }
      btn.disabled = true;
      const res = await emit('player:guess', { value: v });
      if (res.error) { err.textContent = res.error; btn.disabled = false; }
    },
  }, field, btn, err);
  if (kind !== 'slider') setTimeout(() => input.focus(), 50);
  return form;
}

function stopwatchGame(stim) {
  const face = h('div.stopwatch-face', '0.00');
  const btn = h('button.btn.block', 'START');
  let startedAt = null;
  let raf = null;
  const tick = () => {
    const elapsed = Date.now() - startedAt;
    face.textContent = elapsed < stim.visibleMs ? (elapsed / 1000).toFixed(2) : '??.??';
    raf = requestAnimationFrame(tick);
  };
  btn.addEventListener('click', async () => {
    if (startedAt == null) {
      startedAt = Date.now();
      btn.textContent = 'STOP';
      btn.style.background = 'var(--bad)';
      tick();
    } else {
      cancelAnimationFrame(raf);
      const elapsed = Math.round((Date.now() - startedAt) / 10) / 100;
      face.textContent = elapsed.toFixed(2);
      btn.disabled = true;
      await emit('player:guess', { value: elapsed });
    }
  });
  return h('div.stack.center',
    h('p.target', 'Stop at exactly ', h('strong', stim.target.toFixed(1) + 's')),
    h('div.stage', { style: { aspectRatio: 'auto', minHeight: '140px' } }, face),
    btn,
  );
}

function revealView() {
  const r = state.round;
  const me = state.you;
  const idx = r.results.findIndex((x) => x.id === me.id);
  const res = r.results[idx];
  const unit = r.game.input.unit;
  const earned = r.edgeEarners.includes(me.id);
  return h('div.stack.center.pop',
    h('div.round-tag', `Round ${r.number} of ${r.total}`),
    r.revealText ? h('p', r.revealText) : null,
    h('div.muted', 'Answer'),
    h('div.answer', withUnit(r.answer, unit)),
    res ? h('div.card.stack',
      h('div', 'You guessed ', h('strong', withUnit(res.guess, unit))),
      h('div.result-big', '+' + res.points.toLocaleString()),
      h('div.muted', res.exact ? '\u{1F3AF} BULL’S-EYE!' : res.winner ? '\u{1F947} Closest guess!' : `#${idx + 1} of ${r.results.length} this round`),
    ) : null,
    earned && !r.isLast ? h('div.edge-banner.pop', h('strong', '⚡ You earned the EDGE! '), 'You’ll get a slight advantage next round.') : null,
    res && res.hadEdge ? h('p.muted', 'You used your EDGE this round — it moves on to someone else now.') : null,
    h('p.muted', 'Watch the big screen for the scores…'),
  );
}

function finalView() {
  const me = state.you;
  const place = state.players.findIndex((p) => p.id === me.id) + 1;
  const medal = ['\u{1F947}', '\u{1F948}', '\u{1F949}'][place - 1] || '\u{1F44F}';
  return h('div.stack.center.pop',
    h('div.big-emoji', medal),
    h('h1', place === 1 ? 'You win!' : `You placed #${place}`),
    h('div.result-big', me.score.toLocaleString(), ' pts'),
    h('div.card', { style: { textAlign: 'left' } }, h('ol.standings', state.players.map((p, i) => h('li', h('span.rank', i + 1), swatch(p.color), h('span.name', p.name), h('span.score', p.score.toLocaleString()))))),
    h('p.muted', 'The host can start another game.'),
  );
}
