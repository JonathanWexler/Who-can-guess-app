const socket = createSocket();
const app = document.getElementById('app');
let state = null;
let renderedKey = null;
let joinError = '';

function emit(event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, (res) => resolve(res || {})));
}

// ---- joining ---------------------------------------------------------------

const params = new URLSearchParams(location.search);
const saved = store.get('wcg-player'); // { code, playerId, name }

// (Re)joining: whenever the socket (re)connects, take back our saved seat.
socket.on('connect', async () => {
  const seat = store.get('wcg-player');
  if (!seat || seat.code !== socket.code || !seat.playerId) return;
  const res = await emit('player:join', seat);
  if (res.error) {
    store.del('wcg-player');
    state = null;
    renderedKey = null;
    joinError = res.error;
    joinView();
  }
});

(function start() {
  // A QR code for a different room wins over a saved seat.
  const urlCode = (params.get('code') || '').toUpperCase();
  if (saved && saved.playerId && (!urlCode || urlCode === saved.code)) socket.connect(saved.code);
  else joinView();
})();

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
      const c = code.value.trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(c)) { err.textContent = 'Room codes are 4 letters.'; btn.disabled = false; return; }
      await socket.connect(c);
      const res = await emit('player:join', { code: c, name: name.value });
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
  const q = state.question;
  const a = state.actoff;
  const key = JSON.stringify([
    state.phase, state.progress && state.progress.question, q && q.locked, q && q.result,
    a && [a.actors, a.prompt && a.prompt.text, a.yourVote, a.yourRating, a.mode, a.result], state.you.edge, state.you.score,
    state.phase === 'lobby' || state.phase === 'final' ? state.players.map((p) => [p.name, p.score]) : null,
    state.leaderId === state.you.id, state.phase === 'lobby' ? state.settings : null,
    q && q.sabotagedBy, state.you.sabotages,
  ]);
  syncSabotage();
  if (key === renderedKey) return;
  renderedKey = key;
  const view = { lobby: lobbyView, question: questionView, answer: answerView, actoff: actoffView, voting: votingView, 'actoff-result': actoffResultView, final: finalView }[state.phase];
  const controls = hostControls();
  // In the lobby the host's Start button goes first so it's never below the fold.
  if (controls && state.phase === 'lobby') app.replaceChildren(youBar(), controls, view());
  else app.replaceChildren(youBar(), view(), controls || '');
}

function youBar() {
  const me = state.you;
  return h('div.you-bar',
    swatch(me.color),
    h('span.name', state.leaderId === me.id ? '\u{1F451} ' : '', me.name, ' ', me.edge ? edgeBadge() : null),
    h('strong', me.score.toLocaleString(), ' pts'),
  );
}

const nameOf = (id) => (state.players.find((p) => p.id === id) || {}).name || '?';
const colorOf = (id) => (state.players.find((p) => p.id === id) || {}).color || '#fff';

function lobbyView() {
  return h('div.stack.center',
    h('div.card.stack',
      h('h2', 'You’re in! \u{1F389}'),
      state.leaderId === state.you.id
        ? h('p', '\u{1F451} ', h('strong', 'You\u2019re the host!'), ' Pick the settings below and start when everyone\u2019s in.')
        : h('p.muted', 'Room ', h('strong', state.code), ` \u00b7 waiting for \u{1F451} ${nameOf(state.leaderId)} to start\u2026`),
      h('div.chips', { style: { justifyContent: 'center' } }, state.players.map((p) => h('span.chip', swatch(p.color), p.name))),
    ),
    h('div.card', { style: { textAlign: 'left' } },
      h('h3', 'Quick rules'),
      h('ul.how',
        h('li', '\u{1F440} Watch the big screen, then answer here.'),
        h('li', '☝️ Pick one of 4 answers, and no take-backs!'),
        h('li', '\u{1F3AD} You might get picked to act something out!'),
        h('li', '\u{1F608} You get 2 sabotages a round: send someone an evil smiley that blocks their answers!'),
        h('li', h('strong', { style: { color: 'var(--edge)' } }, '⚡ Win an act-off'), ' to get the EDGE for the next round.'),
      ),
    ),
    h('button.btn.secondary.small', { onclick: leave }, 'Leave'),
  );
}

function timerBar() {
  const q = state.question;
  const el = h('div.mini-timer', h('div'));
  startCountdown(el, Date.now() + q.endsInMs, { total: q.durationMs });
  return el;
}

function questionHeader(q) {
  return h('div.stack',
    h('div.row', h('span.round-tag', `Question ${state.progress.question} of ${state.progress.total}`), h('div.spacer'), q.hasEdge ? edgeBadge() : null),
    h('h2', { style: { margin: 0 } }, `${q.emoji} ${q.title}`),
    h('p.question', { style: { margin: 0 } }, q.prompt),
  );
}

function optionContent(o) {
  return [
    o.color ? h('span.swatch-lg', { style: { background: o.color } }) : null,
    o.emoji ? h('span.em', o.emoji) : null,
    o.label ? h('span', o.label) : null,
  ];
}

function questionView() {
  const q = state.question;
  if (q.locked) {
    const shown = q.kind === 'choice' ? h('div.option-row', h('span.option-pill', optionContent(q.options[q.guess]))) : h('strong', formatNum(q.guess));
    return h('div.stack.center.pop',
      questionHeader(q),
      h('div.card.locked', '\u{1F512} Locked in:', shown),
      h('p.muted', 'No take-backs! Wait for the reveal…'),
      timerBar(),
      sabotagePanel(),
    );
  }
  const err = h('p.error');
  const send = async (value) => {
    const res = await emit('player:guess', { value });
    if (res.error) err.textContent = res.error;
  };
  let input;
  if (q.kind === 'choice') {
    // Number answers (counts, totals) go in a big 2x2 grid; word/picture answers stack.
    const numeric = q.options.every((o) => !o.emoji && !o.color && /^[\d,]+$/.test(o.label || ''));
    input = h('div.choices', { class: numeric ? 'grid2' : '' }, q.options.map((o, i) => {
      const crossed = q.removed === i;
      return h('button.choice-btn', {
        class: crossed ? 'crossed' : '',
        disabled: crossed,
        onclick: (e) => {
          e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => (b.disabled = true));
          e.currentTarget.classList.add('sel');
          send(i);
        },
      }, optionContent(o));
    }));
  } else {
    input = keypad(send);
  }
  return h('div.stack',
    questionHeader(q),
    h('p.watch', '\u{1F440} Watch the big screen, then tap ONE answer. No take-backs!'),
    q.hasEdge ? h('div.edge-banner', h('strong', '⚡ EDGE: '), 'one wrong answer is crossed out for you.') : null,
    input,
    err,
    timerBar(),
    sabotagePanel(),
  );
}

function keypad(onSubmit) {
  let value = '';
  const display = h('div.keypad-display', ' ');
  const lock = h('button.btn.block', { disabled: true, onclick: () => { lock.disabled = true; onSubmit(Number(value)); } }, 'Lock it in \u{1F512}');
  const press = (k) => {
    if (k === '⌫') value = value.slice(0, -1);
    else if (k === 'C') value = '';
    else if (value.length < 6) value = (value === '0' ? '' : value) + k;
    display.textContent = value || ' ';
    lock.disabled = value === '';
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
  return h('div.stack', display, h('div.keypad', keys.map((k) => h('button', { type: 'button', onclick: () => press(k) }, k))), lock);
}

function answerView() {
  const q = state.question;
  const r = q.result;
  const answerShown = q.kind === 'choice' ? h('div.option-row', h('span.option-pill.right', optionContent(q.options[q.answer]))) : h('div.answer', formatNum(q.answer));
  const yours = r.guess == null ? 'You didn’t answer in time.' : q.kind === 'choice' ? ['You picked ', h('span.option-pill', { style: { fontSize: '1rem', padding: '4px 10px' } }, optionContent(q.options[r.guess]))] : ['You said ', h('strong', formatNum(r.guess))];
  return h('div.stack.center.pop',
    h('div.verdict', r.correct ? '✅' : '❌'),
    h('h1', r.correct ? 'You got it!' : r.guess == null ? 'Too slow!' : 'Not quite!'),
    r.correct ? h('div.result-big', '+' + r.points.toLocaleString()) : null,
    q.sabotagedBy ? h('p', '\u{1F608} ', h('strong', q.sabotagedBy), ' sabotaged you this time!') : null,
    h('div.card.stack', h('div.muted', 'The answer was'), answerShown, h('div', yours)),
    h('p.muted', '\u{1F92B} Only you can see this.'),
  );
}

function actoffView() {
  const a = state.actoff;
  const twoPlayer = state.players.filter((p) => p.connected).length <= 2;
  if (a.youAreActor) {
    const partner = a.actors.find((id) => id !== state.you.id);
    return h('div.stack.center.pop',
      h('h1', '\u{1F3AD} You\u2019re on stage!'),
      h('p', { style: { margin: 0 } }, 'You and ', h('strong', { style: { color: colorOf(partner) } }, nameOf(partner)), ' both act out:'),
      promptBlock(a.prompt),
      h('p.muted', twoPlayer
        ? 'Take turns, no time limit, so go big! Then you\u2019ll rate each other. Win for 1,500 pts and the \u26A1 EDGE.'
        : 'Take turns, no time limit, so go big! Win the vote for 1,500 pts and the \u26A1 EDGE.'),
    );
  }
  return h('div.stack.center.pop',
    h('h1', '\u{1F37F} Act-off!'),
    h('p', { style: { margin: 0 } }, h('strong', { style: { color: colorOf(a.actors[0]) } }, nameOf(a.actors[0])), ' vs ', h('strong', { style: { color: colorOf(a.actors[1]) } }, nameOf(a.actors[1]))),
    promptBlock(a.prompt),
    h('p.muted', 'Watch them both. Voting opens when they\u2019re done!'),
  );
}

function votingView() {
  const a = state.actoff;
  const err = h('p.error');
  if (a.mode === 'rate') {
    // 2-player game: rate the other actor.
    const partner = a.actors.find((id) => id !== state.you.id);
    return h('div.stack.center.pop',
      h('h1', '\u2B50 Rate ', h('span', { style: { color: colorOf(partner) } }, nameOf(partner))),
      promptBlock(a.prompt, { small: true }),
      h('p.muted', { style: { margin: 0 } }, `How good was ${nameOf(partner)}\u2019s acting? Be honest!`),
      h('div.star-row', [1, 2, 3, 4, 5].map((n) => h('button.star-btn', {
        class: a.yourRating && n <= a.yourRating ? 'on' : '',
        onclick: async () => { const res = await emit('player:rate', { stars: n }); if (res.error) err.textContent = res.error; },
      }, '\u2B50'))),
      a.yourRating ? h('p.muted', `You gave ${stars(a.yourRating)}. You can change it until rating closes.`) : h('p.muted', 'Tap 1 to 5 stars.'),
      err,
    );
  }
  if (a.youAreActor) {
    return h('div.stack.center.pop', h('div.big-emoji', '\u{1F91E}'), h('h1', 'Everyone\u2019s voting\u2026'), h('p.muted', 'Fingers crossed!'));
  }
  return h('div.stack.center.pop',
    h('h1', '\u{1F5F3}\uFE0F Who did it better?'),
    promptBlock(a.prompt, { small: true }),
    a.actors.map((id) => h('button.vote-btn', {
      class: a.yourVote === id ? 'sel' : '',
      style: { '--c': colorOf(id) },
      onclick: async () => { const res = await emit('player:vote', { actorId: id }); if (res.error) err.textContent = res.error; },
    }, nameOf(id))),
    a.yourVote ? h('p.muted', 'Vote counted! You can change it until voting closes.') : h('p.muted', 'Tap one.'),
    err,
  );
}

function actoffResultView() {
  const r = state.actoff.result;
  const me = state.you.id;
  const tie = r.winners.length === 2;
  const actor = state.actoff.actors.includes(me);
  const won = r.winners.includes(me);
  const place = state.players.findIndex((p) => p.id === me) + 1;
  return h('div.stack.center.pop',
    h('div.big-emoji', actor ? (won ? (tie ? '\u{1F91D}' : '\u{1F451}') : '\u{1F44F}') : '\u{1F3AD}'),
    h('h1', actor ? (tie ? 'It’s a tie!' : won ? 'You won the act-off!' : 'So brave!') : tie ? 'It’s a tie!' : `${nameOf(r.winners[0])} wins!`),
    actor ? h('div.result-big', '+' + r.points[me].toLocaleString()) : null,
    actor && state.actoff.mode === 'rate' ? h('p', `${nameOf(state.actoff.actors.find((id) => id !== me))} gave you ${stars(r.tally[me])}`) : null,
    state.you.edge ? h('div.edge-banner', h('strong', '⚡ You have the EDGE'), ' for the next round!') : null,
    h('div.card', h('p', { style: { margin: 0 } }, `You’re in `, h('strong', `#${place}`), ` with ${state.you.score.toLocaleString()} pts`)),
    h('p.muted', 'Check the big screen for the scoreboard!'),
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
    h('p.muted', `${me.correct} question${me.correct === 1 ? '' : 's'} right`),
    h('div.card', { style: { textAlign: 'left' } }, h('ol.standings', state.players.map((p, i) => h('li', h('span.rank', i + 1), swatch(p.color), h('span.name', p.name), h('span.score', p.score.toLocaleString()))))),
    state.leaderId === me.id ? null : h('p.muted', 'The host can start another game.'),
  );
}

// ---- host controls (first player to join runs the game from their phone) --

function hostControls() {
  if (state.leaderId !== state.you.id) return null;
  const go = async (event, payload) => {
    const res = await emit(event, payload);
    if (res.error) alert(res.error);
  };
  const btn = (label, event, opts = {}) => h('button.btn' + (opts.secondary ? '.secondary' : '') + (opts.small ? '.small' : '') + (opts.block ? '.block' : ''), { onclick: () => go(event, opts.payload) }, label);
  const p = state.progress;
  let body;
  switch (state.phase) {
    case 'lobby': {
      const s = state.settings;
      const opt = (label, active, payload) => h('button.btn.small', { class: active ? '' : 'secondary', onclick: () => go('host:configure', payload) }, label);
      body = [
        h('div.settings-row', h('span.muted', 'Questions per act-off:'), [3, 4].map((n) => opt(n, s.perSet === n, { perSet: n }))),
        h('div.settings-row', h('span.muted', 'Rounds:'), [2, 3, 4, 5].map((n) => opt(n, s.sets === n, { sets: n }))),
        h('p.muted', { style: { margin: 0 } }, `${s.perSet * s.sets} questions + ${s.sets} act-offs \u00b7 ${state.players.length} player${state.players.length === 1 ? '' : 's'} in`),
        btn('\u25B6 Start game', 'host:start', { block: true }),
      ];
      break;
    }
    case 'question':
      body = [btn('End this question now', 'host:next', { secondary: true, small: true })];
      break;
    case 'answer': {
      const endOfSet = p.question % p.perSet === 0;
      const last = p.question >= p.total;
      const willActOff = endOfSet && state.players.filter((x) => x.connected).length >= 2;
      body = [btn(willActOff ? '\u{1F3AD} Act-off time!' : last ? '\u{1F3C6} Final results' : 'Next question \u25B6', 'host:next', { block: true })];
      break;
    }
    case 'actoff':
      body = [
        h('div.row', { style: { justifyContent: 'center' } }, btn('\u{1F500} Different actors', 'host:reroll-actors', { secondary: true, small: true }), btn('\u{1F3B2} Different prompt', 'host:reroll-prompt', { secondary: true, small: true })),
        btn(state.players.filter((x) => x.connected).length <= 2 ? '\u2705 Done acting \u2014 rate!' : '\u2705 Done acting \u2014 vote!', 'host:next', { block: true }),
        btn('\u23ED\uFE0F Skip this act-off', 'host:skip-actoff', { secondary: true, small: true }),
      ];
      break;
    case 'voting':
      body = [
        btn(state.actoff.mode === 'rate' ? 'Close rating' : 'Close voting', 'host:next', { secondary: true, block: true }),
        btn('\u23ED\uFE0F Skip this act-off', 'host:skip-actoff', { secondary: true, small: true }),
      ];
      break;
    case 'actoff-result':
      body = [btn(p.question >= p.total ? '\u{1F3C6} Final results' : 'Next round \u25B6', 'host:next', { block: true })];
      break;
    case 'final':
      body = [btn('Play again', 'host:start', { block: true }), btn('Back to lobby', 'host:lobby', { secondary: true, block: true })];
      break;
    default:
      return null;
  }
  return h('div.card.host-controls.stack', { style: state.phase === 'lobby' ? { marginTop: 0, marginBottom: '16px' } : {} }, h('div.round-tag', '\u{1F451} Host controls'), body);
}

// ---- sabotage ---------------------------------------------------------------
// Once per round you can send an evil smiley to someone who hasn't answered.
// It bounces over their answer buttons until they tap it 3 times.

let pickerOpenFor = null;

function sabotagePanel() {
  const n = state.progress.question;
  const left = state.you.sabotages;
  if (left <= 0) return h('p.muted.center', { style: { fontSize: '.85rem', marginTop: '14px' } }, '\u{1F608} Both sabotages used — you get 2 more next round.');
  const msg = h('p.error', { style: { margin: 0 } });
  const list = h('div.chips', { style: { justifyContent: 'center' } });
  const fill = () => {
    const q = state.question;
    const targets = state.players.filter((p) => p.id !== state.you.id && p.connected && !q.answered.includes(p.id) && !q.sabotaged.includes(p.id));
    list.replaceChildren(...(targets.length
      ? targets.map((p) => h('button.chip', {
        onclick: async () => {
          const res = await emit('player:sabotage', { targetId: p.id });
          if (res.error) { msg.textContent = res.error; fill(); return; }
          pickerOpenFor = null;
          toast(`\u{1F608} Sent to ${p.name}!`);
        },
      }, swatch(p.color), p.name))
      : [h('span.muted', 'Nobody left to sabotage on this one!')]));
  };
  const wrap = h('div.stack', { class: pickerOpenFor === n ? '' : 'hidden' }, h('p.muted', { style: { margin: 0 } }, 'Who gets the evil smiley?'), list);
  if (pickerOpenFor === n) fill();
  const btn = h('button.btn.block.sabotage-btn', {
    onclick: () => {
      pickerOpenFor = pickerOpenFor === n ? null : n;
      if (pickerOpenFor === n) fill();
      wrap.classList.toggle('hidden', pickerOpenFor !== n);
    },
  }, `\u{1F608} Sabotage someone (${left} left)`);
  return h('div.card.stack.sabotage', btn, wrap, msg);
}

function toast(text) {
  const el = h('div.toast', text);
  document.body.append(el);
  el.animate([{ opacity: 0, transform: 'translate(-50%, -10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], 200);
  setTimeout(() => el.remove(), 1800);
}

let sabotageShownFor = null;

// Show the evil smiley once when we get hit; clear it when the question ends.
function syncSabotage() {
  const q = state.question;
  const n = state.progress && state.progress.question;
  if (state.phase !== 'question' || !q || q.locked) {
    document.querySelectorAll('.evil-layer').forEach((el) => el.remove());
    return;
  }
  if (q.sabotagedBy && sabotageShownFor !== n) {
    sabotageShownFor = n;
    showEvilSmiley(q.sabotagedBy);
  }
}

function showEvilSmiley(fromName) {
  const face = h('div.evil-face', '\u{1F608}');
  const counter = h('span', '3');
  const layer = h('div.evil-layer', h('div.evil-banner', h('strong', `${fromName} sabotaged you!`), h('div', 'Tap the evil face ', counter, ' times to get rid of it!')), face);
  document.body.append(layer);
  const move = () => {
    face.style.left = 8 + Math.random() * 62 + '%';
    face.style.top = 28 + Math.random() * 50 + '%';
  };
  move();
  const wander = setInterval(move, 1100);
  let hits = 0;
  const finish = () => {
    clearInterval(wander);
    clearTimeout(giveUp);
    face.textContent = '\u{1F4A5}';
    face.style.pointerEvents = 'none';
    setTimeout(() => layer.remove(), 450);
  };
  // Never lock anyone out for long.
  const giveUp = setTimeout(finish, 10000);
  face.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hits += 1;
    counter.textContent = String(3 - hits);
    face.animate([{ transform: 'translate(-50%,-50%) scale(1.5) rotate(25deg)' }, { transform: 'translate(-50%,-50%) scale(1)' }], 250);
    if (hits >= 3) finish();
    else move();
  });
}
