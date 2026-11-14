const { BY_ID, pickQuestions, numberChoices } = require('./questions');
const { ACT_PROMPTS } = require('./actprompts');
const { isCorrect, scoreActOff, QUESTION_POINTS } = require('./scoring');

const PLAYER_COLORS = ['#ff5d73', '#ffb347', '#ffe156', '#6be38f', '#5ce1e6', '#7b9cff', '#c38bff', '#ff8ad8', '#b8f05a', '#f0a07a', '#9fe7ff', '#e0e0e0', '#ff9f9f', '#a0ffd8', '#d8b4ff', '#ffd6a0'];
const MAX_PLAYERS = 16;
const CARD_MS = 3000; // title card on the big screen before the animation starts
const ANSWER_MS = 20000; // time to answer once the animation has played
const MIN_ACTOFF_PLAYERS = 3; // two actors + at least one voter

// Phases:
//   lobby → question → answer → (repeat) → actoff → voting → actoff-result → … → final
const SCORE_VISIBLE = new Set(['lobby', 'actoff-result', 'final']);

class Room {
  /**
   * @param {string} code
   * @param {{emitTo:(socketId:string, event:string, payload:any)=>void, rng?:()=>number, timers?:{setTimeout:Function, clearTimeout:Function}, now?:()=>number}} deps
   */
  constructor(code, deps) {
    this.code = code;
    this.hostToken = globalThis.crypto.randomUUID();
    this.hostSocketId = null;
    this.emitTo = deps.emitTo;
    this.rng = deps.rng || Math.random;
    this.timers = deps.timers || { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (t) => clearTimeout(t) };
    this.now = deps.now || Date.now;
    this.players = new Map();
    this.phase = 'lobby';
    this.settings = { perSet: 3, sets: 3 };
    this.playlist = [];
    this.qIndex = -1;
    this.question = null;
    this.actoff = null;
    this.usedQuestions = new Set();
    this.usedPrompts = new Set();
    this.timer = null;
    this.leaderId = null; // the first player to join runs the game from their phone
    this.leaderTimer = null;
    this.lastActivity = this.now();
  }

  // ---- players -----------------------------------------------------------

  join({ playerId, name, socketId }) {
    this.lastActivity = this.now();
    const existing = playerId && this.players.get(playerId);
    if (existing) {
      existing.socketId = socketId;
      existing.connected = true;
      if (existing.id === this.leaderId) this.clearLeaderTimer();
      this.broadcast();
      return { player: existing };
    }
    name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
    if (!name) return { error: 'Please enter a name.' };
    if (this.players.size >= MAX_PLAYERS) return { error: 'This room is full.' };
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) return { error: 'That name is taken in this room.' };
    const used = new Set([...this.players.values()].map((p) => p.color));
    const player = {
      id: globalThis.crypto.randomUUID(),
      name,
      color: PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[this.players.size % PLAYER_COLORS.length],
      score: 0,
      correct: 0,
      edge: false,
      timesActed: 0,
      actWins: 0,
      socketId,
      connected: true,
    };
    this.players.set(player.id, player);
    if (!this.leaderId) this.leaderId = player.id;
    this.broadcast();
    return { player };
  }

  kick(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    this.players.delete(playerId);
    if (playerId === this.leaderId) this.passLeadership();
    if (p.socketId) this.emitTo(p.socketId, 'kicked', {});
    if (this.question) this.question.guesses.delete(playerId);
    if (this.actoff) {
      this.actoff.votes.delete(playerId);
      if (this.actoff.actors.includes(playerId) && (this.phase === 'actoff' || this.phase === 'voting')) {
        this.phase = 'actoff';
        this.pickActors();
      }
    }
    this.broadcast();
    this.checkEveryoneDone();
  }

  disconnectSocket(socketId) {
    if (socketId === this.hostSocketId) this.hostSocketId = null;
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        p.socketId = null;
        // Give the host's phone 30s to come back (screen lock, flaky Wi-Fi) before passing the crown.
        if (p.id === this.leaderId && !this.leaderTimer) {
          this.leaderTimer = this.timers.setTimeout(() => {
            this.leaderTimer = null;
            const leader = this.players.get(this.leaderId);
            if (!leader || !leader.connected) this.passLeadership();
          }, 30000);
        }
      }
    }
    this.broadcast();
    this.checkEveryoneDone();
  }

  passLeadership() {
    this.clearLeaderTimer();
    const next = this.connectedPlayers()[0] || [...this.players.values()][0];
    this.leaderId = next ? next.id : null;
    this.broadcast();
  }

  clearLeaderTimer() {
    if (this.leaderTimer) this.timers.clearTimeout(this.leaderTimer);
    this.leaderTimer = null;
  }

  // The TV screen or the host player's phone can run the game.
  canControl(playerId) {
    return !!playerId && playerId === this.leaderId;
  }

  connectedPlayers() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  // ---- game flow ---------------------------------------------------------

  configure({ perSet, sets } = {}) {
    if (this.phase !== 'lobby' && this.phase !== 'final') return;
    if ([3, 4].includes(Number(perSet))) this.settings.perSet = Number(perSet);
    if (Number(sets) >= 1 && Number(sets) <= 6) this.settings.sets = Number(sets);
    this.broadcast();
  }

  start() {
    if (this.phase !== 'lobby' && this.phase !== 'final') return { error: 'Game already running.' };
    if (this.players.size < 1) return { error: 'Need at least one player.' };
    const total = this.settings.perSet * this.settings.sets;
    if (this.usedQuestions.size + total > Object.keys(BY_ID).length) this.usedQuestions.clear();
    this.playlist = pickQuestions(total, this.rng, this.usedQuestions);
    this.playlist.forEach((id) => this.usedQuestions.add(id));
    this.qIndex = -1;
    this.actoff = null;
    for (const p of this.players.values()) Object.assign(p, { score: 0, correct: 0, edge: false, timesActed: 0, actWins: 0 });
    this.nextQuestion();
    return {};
  }

  setNumber() {
    return Math.floor(Math.max(0, this.qIndex) / this.settings.perSet) + 1;
  }

  nextQuestion() {
    this.clearTimer();
    this.qIndex += 1;
    const template = BY_ID[this.playlist[this.qIndex]];
    const made = template.create(this.rng);
    // Every question is answered by tapping one of 4 choices.
    if (template.kind === 'number') Object.assign(made, numberChoices(made.answer, this.rng));
    const durationMs = CARD_MS + (made.watchMs || 0) + ANSWER_MS;
    let removed = null;
    {
      const wrong = made.options.map((_, i) => i).filter((i) => i !== made.answer);
      removed = wrong[Math.floor(this.rng() * wrong.length)];
    }
    this.question = {
      template,
      ...made,
      prompt: made.prompt || template.prompt,
      removed, // the option crossed out for EDGE holders
      edgeHolders: new Set([...this.players.values()].filter((p) => p.edge).map((p) => p.id)),
      guesses: new Map(),
      results: null,
      endsAt: this.now() + durationMs,
      durationMs,
    };
    this.phase = 'question';
    this.broadcast();
    this.timer = this.timers.setTimeout(() => this.revealAnswer(), durationMs);
  }

  submitGuess(playerId, value) {
    const q = this.question;
    if (this.phase !== 'question' || !this.players.has(playerId)) return { error: 'Not taking answers right now.' };
    if (q.guesses.has(playerId)) return { error: 'You already locked in an answer.' };
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Answer with a whole number.' };
    if (n >= q.options.length || (n === q.removed && q.edgeHolders.has(playerId))) {
      return { error: 'Pick one of the options.' };
    }
    q.guesses.set(playerId, n);
    this.broadcast();
    this.checkEveryoneDone();
    return {};
  }

  checkEveryoneDone() {
    const active = this.connectedPlayers();
    if (!active.length) return;
    if (this.phase === 'question' && active.every((p) => this.question.guesses.has(p.id))) {
      this.clearTimer();
      this.timer = this.timers.setTimeout(() => this.revealAnswer(), 1200);
    }
    if (this.phase === 'voting') {
      const voters = active.filter((p) => !this.actoff.actors.includes(p.id));
      if (voters.length && voters.every((p) => this.actoff.votes.has(p.id))) {
        this.clearTimer();
        this.timer = this.timers.setTimeout(() => this.finishActOff(), 1200);
      }
    }
  }

  revealAnswer() {
    this.clearTimer();
    if (this.phase !== 'question') return;
    const q = this.question;
    q.results = new Map();
    for (const p of this.players.values()) {
      const guess = q.guesses.has(p.id) ? q.guesses.get(p.id) : null;
      const correct = isCorrect({ kind: 'choice', answer: q.answer }, guess);
      const points = correct ? QUESTION_POINTS : 0;
      p.score += points;
      if (correct) p.correct += 1;
      q.results.set(p.id, { guess, correct, points });
    }
    this.phase = 'answer';
    this.broadcast();
  }

  // Host pressed "Next" from the answer screen or act-off results.
  advance() {
    if (this.phase === 'answer') {
      const endOfSet = (this.qIndex + 1) % this.settings.perSet === 0;
      const endOfGame = this.qIndex + 1 >= this.playlist.length;
      if (endOfSet && this.connectedPlayers().length >= MIN_ACTOFF_PLAYERS) return this.startActOff();
      if (endOfGame) return this.finish();
      return this.nextQuestion();
    }
    if (this.phase === 'actoff') return this.openVoting();
    if (this.phase === 'voting') return this.finishActOff();
    if (this.phase === 'actoff-result') {
      if (this.qIndex + 1 >= this.playlist.length) return this.finish();
      return this.nextQuestion();
    }
    if (this.phase === 'question') return this.revealAnswer();
  }

  startActOff() {
    this.clearTimer();
    this.actoff = { actors: [], prompt: null, votes: new Map(), result: null, number: this.setNumber() };
    this.pickActors();
    this.pickPrompt();
    this.phase = 'actoff';
    this.broadcast();
  }

  // Two random connected players, preferring people who've acted the least.
  pickActors() {
    const avoid = new Set(this.actoff.actors);
    let pool = this.connectedPlayers();
    if (pool.length - avoid.size >= 2) pool = pool.filter((p) => !avoid.has(p.id));
    const shuffled = pool.map((p) => ({ p, r: this.rng() })).sort((a, b) => a.p.timesActed - b.p.timesActed || a.r - b.r);
    this.actoff.actors = shuffled.slice(0, 2).map((x) => x.p.id);
    this.actoff.votes.clear();
  }

  pickPrompt() {
    if (this.usedPrompts.size >= ACT_PROMPTS.length) this.usedPrompts.clear();
    const fresh = ACT_PROMPTS.filter((p) => !this.usedPrompts.has(p));
    this.actoff.prompt = fresh[Math.floor(this.rng() * fresh.length)];
    this.usedPrompts.add(this.actoff.prompt);
  }

  rerollActors() {
    if (this.phase !== 'actoff') return;
    this.pickActors();
    this.broadcast();
  }

  rerollPrompt() {
    if (this.phase !== 'actoff') return;
    this.pickPrompt();
    this.broadcast();
  }

  openVoting() {
    this.phase = 'voting';
    this.actoff.votes.clear();
    this.broadcast();
    this.checkEveryoneDone();
  }

  submitVote(playerId, actorId) {
    if (this.phase !== 'voting' || !this.players.has(playerId)) return { error: 'Voting isn’t open.' };
    if (this.actoff.actors.includes(playerId)) return { error: 'Actors can’t vote!' };
    if (!this.actoff.actors.includes(actorId)) return { error: 'Vote for one of the actors.' };
    this.actoff.votes.set(playerId, actorId);
    this.broadcast();
    this.checkEveryoneDone();
    return {};
  }

  finishActOff() {
    this.clearTimer();
    if (this.phase !== 'voting') return;
    const a = this.actoff;
    a.result = scoreActOff(a.actors, a.votes);
    for (const id of a.actors) {
      const p = this.players.get(id);
      if (!p) continue;
      p.score += a.result.points[id];
      p.timesActed += 1;
      if (a.result.winners.includes(id) && a.result.winners.length === 1) p.actWins += 1;
    }
    // The EDGE: act-off winner(s) get it for the next set of questions.
    const moreQuestions = this.qIndex + 1 < this.playlist.length;
    for (const p of this.players.values()) p.edge = moreQuestions && a.result.winners.includes(p.id);
    this.phase = 'actoff-result';
    this.broadcast();
  }

  finish() {
    this.clearTimer();
    for (const p of this.players.values()) p.edge = false;
    this.phase = 'final';
    this.question = null;
    this.broadcast();
  }

  backToLobby() {
    this.clearTimer();
    this.phase = 'lobby';
    this.question = null;
    this.actoff = null;
    for (const p of this.players.values()) Object.assign(p, { score: 0, correct: 0, edge: false });
    this.broadcast();
  }

  clearTimer() {
    if (this.timer) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  destroy() {
    this.clearTimer();
    this.clearLeaderTimer();
  }

  // ---- views -------------------------------------------------------------

  playerList() {
    const showScores = SCORE_VISIBLE.has(this.phase);
    const list = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, color: p.color, connected: p.connected, edge: p.edge,
      ...(showScores ? { score: p.score, correct: p.correct, actWins: p.actWins } : {}),
    }));
    if (showScores) list.sort((a, b) => b.score - a.score);
    return list;
  }

  baseView() {
    const total = this.playlist.length;
    return {
      code: this.code,
      phase: this.phase,
      settings: this.settings,
      players: this.playerList(),
      leaderId: this.leaderId,
      progress: total ? { question: this.qIndex + 1, total, set: this.setNumber(), sets: this.settings.sets, perSet: this.settings.perSet } : null,
    };
  }

  questionCommon() {
    const q = this.question;
    return {
      id: q.template.id,
      title: q.template.title,
      emoji: q.template.emoji,
      prompt: q.prompt,
      kind: 'choice',
      options: q.options || null,
      endsInMs: Math.max(0, q.endsAt - this.now()),
      durationMs: q.durationMs,
    };
  }

  // Big screen: shows the animation and who has answered — never who was right.
  hostView() {
    const view = this.baseView();
    const q = this.question;
    if (q && (this.phase === 'question' || this.phase === 'answer')) {
      view.question = {
        ...this.questionCommon(),
        data: q.data,
        watchMs: q.watchMs || 0,
        cardMs: CARD_MS,
        submitted: [...q.guesses.keys()],
        edgeHolders: [...q.edgeHolders],
      };
      if (this.phase === 'answer') {
        view.question.answer = q.answer;
        view.question.answerCount = q.guesses.size;
      }
    }
    if (this.actoff && ['actoff', 'voting', 'actoff-result'].includes(this.phase)) view.actoff = this.actoffView();
    return view;
  }

  actoffView() {
    const a = this.actoff;
    return {
      number: a.number,
      actors: a.actors,
      prompt: a.prompt,
      voted: [...a.votes.keys()],
      result: this.phase === 'actoff-result' ? a.result : null,
    };
  }

  // A phone: its own question, and privately whether it was right.
  playerView(player) {
    const view = this.baseView();
    view.you = { id: player.id, name: player.name, color: player.color, score: player.score, edge: player.edge, correct: player.correct };
    const q = this.question;
    if (q && (this.phase === 'question' || this.phase === 'answer')) {
      const hasEdge = q.edgeHolders.has(player.id);
      view.question = {
        ...this.questionCommon(),
        hasEdge,
        removed: hasEdge ? q.removed : null,
        locked: q.guesses.has(player.id),
        guess: q.guesses.has(player.id) ? q.guesses.get(player.id) : null,
      };
      if (this.phase === 'answer') {
        view.question.answer = q.answer;
        view.question.result = q.results.get(player.id) || { guess: null, correct: false, points: 0 };
      }
    }
    if (this.actoff && ['actoff', 'voting', 'actoff-result'].includes(this.phase)) {
      view.actoff = { ...this.actoffView(), yourVote: this.actoff.votes.get(player.id) || null, youAreActor: this.actoff.actors.includes(player.id) };
    }
    return view;
  }

  broadcast() {
    if (this.hostSocketId) this.emitTo(this.hostSocketId, 'state', this.hostView());
    for (const p of this.players.values()) {
      if (p.socketId) this.emitTo(p.socketId, 'state', this.playerView(p));
    }
  }
}

module.exports = { Room, MAX_PLAYERS, CARD_MS, ANSWER_MS, MIN_ACTOFF_PLAYERS };
